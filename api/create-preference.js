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
                    success: `${req.headers.origin}/app.html?status=success`,
                    failure: `${req.headers.origin}/app.html?status=failure`,
                    pending: `${req.headers.origin}/app.html?status=pending`
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
            cause: error.cause
        });
        res.status(500).json({
            message: 'Erro ao gerar pagamento no Mercado Pago',
            details: error.message
        });
    }
}
