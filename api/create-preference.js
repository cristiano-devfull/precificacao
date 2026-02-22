import { MercadoPagoConfig, Preference } from 'mercadopago';

export default async function handler(req, res) {
    // Log inicial para debugar o método que chega no Vercel
    console.log(`DEBUG: Requisição ${req.method} recebida em /api/create-preference`);

    // Habilitar CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Responder ao Preflight do CORS (OPTIONS)
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({
            message: 'Method not allowed',
            receivedMethod: req.method,
            tip: 'Certifique-se de que a chamada fetch no app.js está usando method: POST'
        });
    }

    const { email, userId, plan } = req.body || {};

    console.log('DEBUG: Requisição recebida', {
        hasBody: !!req.body,
        email,
        userId,
        plan,
        method: req.method,
        hasToken: !!process.env.MP_ACCESS_TOKEN
    });

    if (!email || !userId) {
        return res.status(400).json({ message: 'Email e UserId são obrigatórios no corpo da requisição.' });
    }

    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken || accessToken === 'SUA_CHAVE_DE_TESTE_AQUI') {
        console.error('ERRO: MP_ACCESS_TOKEN não está definido nas variáveis de ambiente do Vercel.');
        return res.status(500).json({ message: 'Erro de configuração: Variável MP_ACCESS_TOKEN ausente ou padrão.' });
    }

    // Log mascarado para verificação (Apenas primeiros 8 e últimos 4 caracteres)
    const maskedToken = accessToken.substring(0, 8) + '...' + accessToken.substring(accessToken.length - 4);
    console.log(`DEBUG: Usando Token: ${maskedToken} | Usuário: ${userId}`);

    let title = 'PRECIFICAÇÃO PRO - Plano Anual';
    let unitPrice = 159.90;

    if (plan === 'promo') {
        title = 'PRECIFICAÇÃO PRO - Mês Promocional (30 dias)';
        unitPrice = 19.90;
    }

    console.log('DEBUG: Criando preferência Mercado Pago', { title, unitPrice });

    // Configuração do Mercado Pago com Token de Ambiente
    const client = new MercadoPagoConfig({
        accessToken: accessToken
    });

    const preference = new Preference(client);

    // Validação extra: Testar se o token é aceito pela API do Mercado Pago
    try {
        const testResponse = await fetch('https://api.mercadopago.com/v1/users/me', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!testResponse.ok) {
            const errorData = await testResponse.json();
            console.error('ERRO CRÍTICO: Token inválido detectado pelo teste direto!', errorData);
            return res.status(401).json({
                message: 'Token do Mercado Pago Inválido',
                details: errorData.message || 'O Mercado Pago recusou seu Access Token.',
                tip: 'Verifique se você copiou o ACCESS TOKEN de PRODUÇÃO corretamente e se ele começa com APP_USR-.'
            });
        }
        const userData = await testResponse.json();
        console.log('DEBUG: Token validado com sucesso para o usuário MP:', userData.nickname);
    } catch (testErr) {
        console.warn('DEBUG: Não foi possível testar o token diretamente, prosseguindo...', testErr.message);
    }

    try {
        const response = await preference.create({
            body: {
                items: [
                    {
                        id: plan === 'promo' ? 'plano-pro-promo' : 'plano-pro-full',
                        title: title,
                        quantity: 1,
                        unit_price: Number(unitPrice),
                        currency_id: 'BRL'
                    }
                ],
                payer: {
                    email: email
                },
                external_reference: userId,
                back_urls: {
                    success: `${req.headers.origin || ('https://' + req.headers.host)}/app.html?status=success`,
                    failure: `${req.headers.origin || ('https://' + req.headers.host)}/app.html?status=failure`,
                    pending: `${req.headers.origin || ('https://' + req.headers.host)}/app.html?status=pending`
                },
                auto_return: 'approved'
            }
        });

        console.log('DEBUG: Preferência criada com sucesso', { id: response.id });
        res.status(200).json({ id: response.id, init_point: response.init_point });
    } catch (error) {
        console.error('DEBUG: Erro detalhado Mercado Pago:', {
            message: error.message,
            stack: error.stack,
            cause: error.cause,
            headers: req.headers
        });
        res.status(500).json({
            message: 'Erro ao gerar pagamento no Mercado Pago',
            details: error.message,
            tip: 'Verifique se o seu MP_ACCESS_TOKEN é válido para o ambiente de produção.'
        });
    }
}
