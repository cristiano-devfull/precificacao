// calculations.js – business logic for pricing

// Helper to calculate custo fixo percentual
export function calcCustoFixoPercentual(faturamentoMensal, totalCustosFixos) {
    if (!faturamentoMensal) return 0;
    return totalCustosFixos / faturamentoMensal;
}

// Custo unitário do insumo
export function calcCustoUnitario(valorTotal, quantidade) {
    if (!quantidade) return 0;
    return valorTotal / quantidade;
}

// Custo insumo na ficha técnica
export function calcCustoInsumo(quantidadeUtilizada, custoUnitario) {
    return quantidadeUtilizada * custoUnitario;
}

// Markup calculation (percentage as decimal, e.g., 0.07 for 7%)
export function calcMarkup(impostos, custosFixos, outrasTaxas, margem) {
    const total = impostos + custosFixos + outrasTaxas + margem;
    if (total >= 1) return 0; // avoid division by zero or negative markup
    return 1 / (1 - total);
}

// Preço de venda final
export function calcPrecoVenda(custoTotal, markup) {
    return custoTotal * markup;
}

// Aggregate total fixed costs
export function sumCustosFixos(custosArray) {
    return custosArray.reduce((sum, item) => sum + Number(item.valor || 0), 0);
}

// Aggregate total insumo cost from ficha técnica
export function sumCustoInsumos(fichaArray, insumosMap) {
    return fichaArray.reduce((sum, ft) => {
        const insumo = insumosMap.get(ft.insumo_id);
        const custoUnitario = insumo ? calcCustoUnitario(insumo.valor_total, insumo.quantidade) : 0;
        return sum + calcCustoInsumo(ft.quantidade, custoUnitario);
    }, 0);
}
// Formatting
export function formatCurrency(value) {
    return Number(value || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    });
}
