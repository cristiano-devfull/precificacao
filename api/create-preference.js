import { MercadoPagoConfig, Preference } from 'mercadopago';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { email, userId, plan } = req.body;

    if (!email || !userId) {
        return res.status(400).json({ message: 'Email and UserId are required' });
    }

    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken || accessToken === 'SUA_CHAVE_DE_TESTE_AQUI') {
        console.error('ERRO: MP_ACCESS_TOKEN não configurado no Vercel');
        return res.status(500).json({ message: 'Erro de configuração no servidor (Token ausente)' });
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
                    success: `${req.headers.origin}/app.html?status=success`,
                    failure: `${req.headers.origin}/app.html?status=failure`,
                    pending: `${req.headers.origin}/app.html?status=pending`
                },
                auto_return: 'approved'
            }
        });

        res.status(200).json({ id: response.id, init_point: response.init_point });
    } catch (error) {
        console.error('Erro Mercado Pago:', error);
        res.status(500).json({
            message: 'Erro ao gerar pagamento',
            details: error.message,
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
}
