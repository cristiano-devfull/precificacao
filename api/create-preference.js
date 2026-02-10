import { MercadoPagoConfig, Preference } from 'mercadopago';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { email, userId } = req.body;

    // Configuração do Mercado Pago com Token de Ambiente
    const client = new MercadoPagoConfig({
        accessToken: process.env.MP_ACCESS_TOKEN || 'SUA_CHAVE_DE_TESTE_AQUI'
    });

    const preference = new Preference(client);

    try {
        const response = await preference.create({
            body: {
                items: [
                    {
                        id: 'plano-pro-anual',
                        title: 'PRECIFICAÇÃO PRO - Plano Anual (12 meses)',
                        quantity: 1,
                        unit_price: 49.90, // Valor de exemplo, ajuste conforme necessário
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
        console.error('Erro ao criar preferência:', error);
        res.status(500).json({ message: 'Erro interno ao criar pagamento' });
    }
}
