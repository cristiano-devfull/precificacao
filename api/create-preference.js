import { MercadoPagoConfig, Preference } from 'mercadopago';

export default async function handler(req, res) {

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
                    success: `${req.headers.origin || ('https://' + req.headers.host)}/app.html?status=success`,
                    failure: `${req.headers.origin || ('https://' + req.headers.host)}/app.html?status=failure`,
                    pending: `${req.headers.origin || ('https://' + req.headers.host)}/app.html?status=pending`
                },
                auto_return: 'approved'
            }
        });

        res.status(200).json({ id: response.id, init_point: response.init_point });
    } catch (error) {
        // Log de erro reduzido para produção
        console.error('Erro Mercado Pago:', error.message);

        // Se for erro de autenticação, vamos deixar isso claro
        const isUnauthorized = error.message?.includes('UNAUTHORIZED') || error.status === 401;

        res.status(isUnauthorized ? 401 : 500).json({
            message: isUnauthorized ? 'Erro de Autenticação no Mercado Pago' : 'Erro ao gerar pagamento',
            details: error.message,
            tip: isUnauthorized
                ? 'Seu ACCESS_TOKEN está sendo recusado. Verifique se ele começa com APP_USR- e se não há espaços extras.'
                : 'Verifique se seus dados de produto e valores estão corretos.'
        });
    }
}
