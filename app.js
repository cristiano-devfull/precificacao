// app.js – Digital Precision Application Logic
import { supabaseClient } from './supabaseClient.js';
import { signUp, logIn, recoverPassword } from './auth.js';
import * as Calc from './calculations.js';

// Global state
let session = null;
let currentUser = null;
let configData = null;
let custosFixosData = [];
let insumosData = [];
let produtosData = [];
let fichaTecnicaData = [];
let precificacaoFab = [];
let precificacaoRev = [];
let dashboardChart = null;

// DOM Elements
const appContainer = document.getElementById('app');
const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard');
const tabContentSection = document.getElementById('tab-content');
const trialSection = document.getElementById('trial-section');

// Auth UI Elements
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authSubmit = document.getElementById('auth-submit');
const authToggleText = document.getElementById('auth-toggle-text');
const authToggleLink = document.getElementById('auth-toggle-link');

let isLoginMode = true;
let activeTab = 'custos-fixos';

// --- Notification Engine ---
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerText = message;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  console.log("%c SYSTEM: INITIALIZING CORE...", "color: #00F5FF; font-weight: bold;");
  initTheme();
  initAuthUI();
  initTabListeners();
  checkSession();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js')
        .then(reg => console.log('SW: SYSTEM_READY'))
        .catch(err => console.error('SW: SYSTEM_FAULT', err));
    });
  }
});

function initTheme() {
  const themeCheckbox = document.getElementById('theme-checkbox');
  const savedTheme = localStorage.getItem('theme') || 'dark';

  if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
    themeCheckbox.checked = true;
  }

  themeCheckbox.addEventListener('change', () => {
    const isLight = themeCheckbox.checked;
    document.body.classList.toggle('light-mode', isLight);
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
  });
}

function initTabListeners() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.tab;
      renderCRUDs();
    });
  });
}

function initAuthUI() {
  authToggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
      authTitle.innerText = "ENTRAR NO SISTEMA";
      authSubmit.innerText = "ENTRAR";
      authToggleText.innerText = "NÃO TEM UMA CONTA?";
      authToggleLink.innerText = "CRIAR CONTA";
    } else {
      authTitle.innerText = "CRIAR CONTA";
      authSubmit.innerText = "REGISTRAR AGORA";
      authToggleText.innerText = "JÁ TEM UMA CONTA?";
      authToggleLink.innerText = "ENTRAR";
    }
  });

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;

    authSubmit.disabled = true;
    authSubmit.innerText = "AUTENTICANDO...";

    try {
      if (isLoginMode) {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        showToast("Acesso Autorizado", "success");
      } else {
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) throw error;

        if (data.user && data.session) {
          showToast("Conta Criada", "success");
        } else {
          showToast("Verificação necessária", "success");
          isLoginMode = true;
          authTitle.innerText = "ENTRAR NO SISTEMA";
          authSubmit.innerText = "ENTRAR";
          authToggleText.innerText = "NÃO TEM UMA CONTA?";
          authToggleLink.innerText = "CRIAR CONTA";
        }
      }
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      authSubmit.disabled = false;
      authSubmit.innerText = isLoginMode ? "ENTRAR" : "REGISTRAR AGORA";
    }
  });
}

async function checkSession() {
  const { data } = await supabaseClient.auth.getSession();
  session = data.session;
  currentUser = session?.user;
  updateUIState();
  if (currentUser) loadData();
  supabaseClient.auth.onAuthStateChange((_event, _session) => {
    session = _session;
    currentUser = _session?.user;
    updateUIState();
    if (currentUser) loadData();
  });

  // Listener para sair via Paywall
  const paywallLogoutBtn = document.getElementById('logout-paywall');
  if (paywallLogoutBtn) {
    paywallLogoutBtn.addEventListener('click', () => {
      supabaseClient.auth.signOut().then(() => {
        window.location.href = 'index.html';
      });
    });
  }
}

function updateUIState() {
  const authDiv = document.getElementById('auth-buttons');
  const systemStatus = document.getElementById('system-status');

  if (currentUser) {
    authDiv.innerHTML = `<button id="logout-btn">DESCONECTAR</button>`;
    document.getElementById('logout-btn').addEventListener('click', () => {
      supabaseClient.auth.signOut().then(() => {
        window.location.href = 'index.html'; // Volta para Landing Page ao sair
      });
    });

    if (systemStatus) systemStatus.classList.remove('hidden');

    // Lógica de Trial (7 dias)
    const createdAt = new Date(currentUser.created_at);
    const now = new Date();
    const diffDays = Math.ceil((now - createdAt) / (1000 * 60 * 60 * 24));

    // Simulação de check de pagamento
    let isPaid = currentUser.app_metadata?.is_paid || false;

    // EXCEÇÃO ADMINISTRATIVA: Seu acesso é sempre liberado
    if (currentUser.email === 'contato@r2cautomacoes.com.br' || currentUser.email === 'cristiano112715@gmail.com') {
      isPaid = true;
    }

    if (diffDays > 7 && !isPaid) {
      // Bloqueio por Trial expirado
      dashboardSection.classList.add('hidden');
      appContainer.classList.add('hidden');
      authSection.classList.add('hidden');
      trialSection.classList.remove('hidden');
    } else {
      // Acesso liberado
      dashboardSection.classList.remove('hidden');
      appContainer.classList.remove('hidden');
      authSection.classList.add('hidden');
      trialSection.classList.add('hidden');
    }

    document.body.classList.remove('auth-flow');
  } else {
    authDiv.innerHTML = ``;
    if (systemStatus) systemStatus.classList.add('hidden');

    // Show Auth, Hide Workspace and Paywall
    dashboardSection.classList.add('hidden');
    appContainer.classList.add('hidden');
    trialSection.classList.add('hidden');
    authSection.classList.remove('hidden');
    document.body.classList.add('auth-flow');
  }
}

// --- Data Loading ---
async function loadData() {
  try {
    const [cfg, custos, ins, prods, ficha, pFab, pRev] = await Promise.all([
      supabaseClient.from('configuracoes').select('*'),
      supabaseClient.from('custos_fixos').select('*'),
      supabaseClient.from('insumos').select('*'),
      supabaseClient.from('produtos').select('*'),
      supabaseClient.from('ficha_tecnica').select('*'),
      supabaseClient.from('precificacao_fabricacao').select('*'),
      supabaseClient.from('precificacao_revenda').select('*')
    ]);

    configData = (cfg.data && cfg.data.length > 0) ? cfg.data[0] : {};
    custosFixosData = custos.data || [];
    insumosData = ins.data || [];
    produtosData = prods.data || [];
    fichaTecnicaData = ficha.data || [];
    precificacaoFab = pFab.data || [];
    precificacaoRev = pRev.data || [];

    renderDashboard();
    renderCRUDs();
  } catch (error) {
    showToast("Erro na sincronização de dados", "error");
  }
}
window.loadData = loadData;

function renderDashboard() {
  const faturamento = Number(configData.faturamento_mensal) || 0;
  const totalCustos = Calc.sumCustosFixos(custosFixosData);
  const custoFixoPct = Calc.calcCustoFixoPercentual(faturamento, totalCustos);

  dashboardSection.innerHTML = `
    <div class="card">
      <h3>FATURAMENTO MENSAL ESTIMADO</h3>
      <p>R$ ${faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
    </div>
    <div class="card">
      <h3>TOTAL DE CUSTOS FIXOS</h3>
      <p>R$ ${totalCustos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
    </div>
    <div class="card">
      <h3>MARGEM DE CUSTO FIXO</h3>
      <p style="color: ${custoFixoPct > 0.3 ? 'var(--danger)' : 'var(--primary)'}">${(custoFixoPct * 100).toFixed(2)}%</p>
    </div>
    <div class="card">
      <h3>RELATÓRIOS DO SISTEMA</h3>
      <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap;">
        <button onclick="window.exportCSV()" class="btn-export-csv" title="Download CSV">CSV</button>
        <button onclick="window.exportExcel()" class="btn-export-excel" title="Download Excel">EXCEL</button>
        <button onclick="window.exportPDF()" class="btn-export-pdf" style="flex: 1 1 100%;" title="Download PDF">PDF</button>
      </div>
    </div>
    <div class="card chart-container-card hide-mobile" style="grid-column: 1 / -1;">
      <h3>DISTRIBUIÇÃO ANALÍTICA DE CUSTOS</h3>
      <div style="height: 250px; width: 100%;"><canvas id="dashboardChart"></canvas></div>
    </div>
  `;
  setTimeout(() => updateChart(), 100);
}

function updateChart() {
  const ctx = document.getElementById('dashboardChart');
  if (!ctx) return;

  const totalCustosF = Calc.sumCustosFixos(custosFixosData);
  const totalInsumos = insumosData.reduce((acc, i) => acc + Number(i.valor_total), 0);

  if (dashboardChart) dashboardChart.destroy();

  dashboardChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['CUSTOS FIXOS', 'MATÉRIA-PRIMA TOTAL'],
      datasets: [{
        label: 'Distribuição Financeira (R$)',
        data: [totalCustosF, totalInsumos],
        backgroundColor: ['rgba(56, 189, 248, 0.6)', 'rgba(16, 185, 129, 0.6)'],
        borderColor: ['#38BDF8', '#10B981'],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94A3B8' } },
        x: { grid: { display: false }, ticks: { color: '#94A3B8' } }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// --- Export Function ---

window.exportCSV = () => {
  try {
    const insumoMap = new Map(insumosData.map(i => [i.id, i]));
    let csv = "\uFEFF"; // BOM para Excel reconhecer caracteres especiais

    // 1. RESUMO
    const faturamento = Number(configData.faturamento_mensal) || 0;
    const totalCustos = Calc.sumCustosFixos(custosFixosData);
    csv += "--- RESUMO EXECUTIVO ---\n";
    csv += `Faturamento Mensal Estimado;${faturamento}\n`;
    csv += `Total de Custos Fixos;${totalCustos}\n`;
    csv += `Margem de Custo Fixo;${(Calc.calcCustoFixoPercentual(faturamento, totalCustos) * 100).toFixed(2)}%\n`;
    csv += "\n";

    // 2. CUSTOS FIXOS
    csv += "--- CUSTOS FIXOS ---\n";
    csv += "Descrição;Valor\n";
    custosFixosData.forEach(c => {
      csv += `${c.descricao};${c.valor}\n`;
    });
    csv += "\n";

    // 3. INSUMOS
    csv += "--- INSUMOS E MATÉRIAS-PRIMAS ---\n";
    csv += "Insumo;Unidade;Quantidade;Valor Total;Custo Unitário\n";
    insumosData.forEach(i => {
      csv += `${i.nome};${i.unidade};${i.quantidade};${i.valor_total};${Calc.calcCustoUnitario(i.valor_total, i.quantidade)}\n`;
    });
    csv += "\n";

    // 4. PRECIFICAÇÃO FABRICAÇÃO
    csv += "--- PRECIFICAÇÃO: FABRICAÇÃO ---\n";
    csv += "Produto;Custo Material;Markup;Preço Final\n";
    produtosData.forEach(p => {
      const pFicha = fichaTecnicaData.filter(ft => ft.produto_id === p.id);
      const custoMP = Calc.sumCustoInsumos(pFicha, insumoMap);
      const imp = (Number(configData.taxa_impostos) || 0) / 100;
      const out = (Number(configData.outras_taxas) || 0) / 100;
      const mar = (Number(configData.margem_lucro) || 0) / 100;
      const fat = Number(configData.faturamento_mensal) || 1;
      const tcf = Calc.sumCustosFixos(custosFixosData);
      const cpct = Calc.calcCustoFixoPercentual(fat, tcf);
      const mkp = Calc.calcMarkup(imp, cpct, out, mar);
      const pvenda = Calc.calcPrecoVenda(custoMP, mkp);
      csv += `${p.nome};${custoMP.toFixed(2)};${mkp.toFixed(2)};${pvenda.toFixed(2)}\n`;
    });
    csv += "\n";

    // 5. PRECIFICAÇÃO REVENDA
    csv += "--- PRECIFICAÇÃO: REVENDA ---\n";
    csv += "Produto;Valor Compra;Markup;Preço Venda\n";
    precificacaoRev.forEach(item => {
      const p = produtosData.find(prod => prod.id === item.produto_id);
      const vcompra = Number(item.valor_compra);
      const imp = (Number(configData.taxa_impostos) || 0) / 100;
      const out = (Number(configData.outras_taxas) || 0) / 100;
      const mar = (Number(configData.margem_lucro) || 0) / 100;
      const fat = Number(configData.faturamento_mensal) || 1;
      const tcf = Calc.sumCustosFixos(custosFixosData);
      const cpct = Calc.calcCustoFixoPercentual(fat, tcf);
      const mkp = Calc.calcMarkup(imp, cpct, out, mar);
      const pvenda = Calc.calcPrecoVenda(vcompra, mkp);
      csv += `${p?.nome || '???'};${vcompra.toFixed(2)};${mkp.toFixed(2)};${pvenda.toFixed(2)}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `RELATORIO_COMPLETO_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("CSV Completo gerado!", "success");
  } catch (err) {
    showToast("Erro ao exportar CSV", "error");
    console.error(err);
  }
};

window.exportExcel = () => {
  try {
    const wb = XLSX.utils.book_new();
    const insumoMap = new Map(insumosData.map(i => [i.id, i]));

    // 1. Aba de Resumo
    const faturamento = Number(configData.faturamento_mensal) || 0;
    const totalCustos = Calc.sumCustosFixos(custosFixosData);
    const summaryData = [
      ["RESUMO EXECUTIVO", ""],
      ["Data de Exportação", new Date().toLocaleString('pt-BR')],
      ["", ""],
      ["Indicador", "Valor"],
      ["Faturamento Mensal Estimado", faturamento],
      ["Total de Custos Fixos", totalCustos],
      ["Margem de Custo Fixo (%)", (Calc.calcCustoFixoPercentual(faturamento, totalCustos) * 100).toFixed(2) + "%"],
      ["Taxa de Impostos (%)", configData.taxa_impostos + "%"],
      ["Margem de Lucro Desejada (%)", configData.margem_lucro + "%"]
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo");

    // 2. Aba de Custos Fixos
    const custosRows = custosFixosData.map(c => ({
      "Descrição": c.descricao,
      "Valor Mensal (R$)": Number(c.valor)
    }));
    const wsCustos = XLSX.utils.json_to_sheet(custosRows);
    XLSX.utils.book_append_sheet(wb, wsCustos, "Custos Fixos");

    // 3. Aba de Insumos
    const insumosRows = insumosData.map(i => ({
      "Insumo": i.nome,
      "Unidade": i.unidade,
      "Quantidade": Number(i.quantidade),
      "Valor Total (R$)": Number(i.valor_total),
      "Custo Unitário (R$)": Calc.calcCustoUnitario(i.valor_total, i.quantidade)
    }));
    const wsInsumos = XLSX.utils.json_to_sheet(insumosRows);
    XLSX.utils.book_append_sheet(wb, wsInsumos, "Insumos");

    // 4. Aba de Precificação (Fabricação)
    const pricingRows = produtosData.map(p => {
      const pFicha = fichaTecnicaData.filter(ft => ft.produto_id === p.id);
      const custoMP = Calc.sumCustoInsumos(pFicha, insumoMap);
      const imp = (Number(configData.taxa_impostos) || 0) / 100;
      const out = (Number(configData.outras_taxas) || 0) / 100;
      const mar = (Number(configData.margem_lucro) || 0) / 100;
      const fat = Number(configData.faturamento_mensal) || 1;
      const tcf = Calc.sumCustosFixos(custosFixosData);
      const cpct = Calc.calcCustoFixoPercentual(fat, tcf);
      const mkp = Calc.calcMarkup(imp, cpct, out, mar);
      const pvenda = Calc.calcPrecoVenda(custoMP, mkp);
      return {
        "Produto": p.nome,
        "Custo Materia-Prima (R$)": custoMP,
        "Markup": mkp,
        "Preço de Venda (R$)": pvenda
      };
    });
    const wsPricing = XLSX.utils.json_to_sheet(pricingRows);
    XLSX.utils.book_append_sheet(wb, wsPricing, "Precificação Fabricação");

    // 5. Aba de Precificação (Revenda)
    const resaleRows = precificacaoRev.map(item => {
      const p = produtosData.find(prod => prod.id === item.produto_id);
      const vcompra = Number(item.valor_compra);
      const imp = (Number(configData.taxa_impostos) || 0) / 100;
      const out = (Number(configData.outras_taxas) || 0) / 100;
      const mar = (Number(configData.margem_lucro) || 0) / 100;
      const fat = Number(configData.faturamento_mensal) || 1;
      const tcf = Calc.sumCustosFixos(custosFixosData);
      const cpct = Calc.calcCustoFixoPercentual(fat, tcf);
      const mkp = Calc.calcMarkup(imp, cpct, out, mar);
      const pvenda = Calc.calcPrecoVenda(vcompra, mkp);
      return {
        "Produto": p?.nome || '???',
        "Valor de Compra (R$)": vcompra,
        "Markup": mkp,
        "Preço de Venda (R$)": pvenda
      };
    });
    const wsResale = XLSX.utils.json_to_sheet(resaleRows);
    XLSX.utils.book_append_sheet(wb, wsResale, "Precificação Revenda");

    // Gerar download
    XLSX.writeFile(wb, `ANALISE_PRECIFICACAO_PRO_${new Date().getTime()}.xlsx`);
    showToast("Planilha Excel gerada!", "success");
  } catch (err) {
    showToast("Erro ao exportar Excel", "error");
    console.error(err);
  }
};

window.exportPDF = () => {
  const insumoMap = new Map(insumosData.map(i => [i.id, i]));

  // Criar template do relatório profissional
  const reportContainer = document.createElement('div');
  reportContainer.style.padding = '20px';
  reportContainer.style.background = '#fff';
  reportContainer.style.color = '#000';
  reportContainer.style.fontFamily = 'Arial, sans-serif';

  const faturamento = Number(configData.faturamento_mensal) || 0;
  const totalCustos = Calc.sumCustosFixos(custosFixosData);
  const custoFixoPct = Calc.calcCustoFixoPercentual(faturamento, totalCustos);

  reportContainer.innerHTML = `
    <div style="border-bottom: 2px solid #38BDF8; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <h1 style="margin: 0; color: #0F172A; font-size: 24px;">RELATÓRIO DE PRECIFICAÇÃO ESTRATÉGICA</h1>
        <p style="margin: 5px 0 0; color: #64748B; font-size: 12px;">GERADO EM: ${new Date().toLocaleString('pt-BR')}</p>
      </div>
      <div style="text-align: right;">
        <span style="font-weight: bold; color: #38BDF8; font-size: 20px;">PRECIFICAÇÃO PRO</span>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px;">
      <div style="border: 1px solid #E2E8F0; padding: 15px; border-radius: 8px;">
        <p style="margin: 0; font-size: 10px; color: #64748B;">FATURAMENTO ESTIMADO</p>
        <p style="margin: 5px 0 0; font-size: 18px; font-weight: bold;">${Calc.formatCurrency(faturamento)}</p>
      </div>
      <div style="border: 1px solid #E2E8F0; padding: 15px; border-radius: 8px;">
        <p style="margin: 0; font-size: 10px; color: #64748B;">CUSTOS FIXOS TOTAIS</p>
        <p style="margin: 5px 0 0; font-size: 18px; font-weight: bold;">${Calc.formatCurrency(totalCustos)}</p>
      </div>
      <div style="border: 1px solid #E2E8F0; padding: 15px; border-radius: 8px;">
        <p style="margin: 0; font-size: 10px; color: #64748B;">MARGEM CUSTO FIXO</p>
        <p style="margin: 5px 0 0; font-size: 18px; font-weight: bold;">${(custoFixoPct * 100).toFixed(2)}%</p>
      </div>
    </div>
    <h2 style="font-size: 16px; border-left: 4px solid #64748B; padding-left: 10px; margin-bottom: 15px;">ESTRUTURA DE CUSTOS FIXOS</h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
      <thead>
        <tr style="background: #F8FAFC;">
          <th style="border: 1px solid #E2E8F0; padding: 10px; text-align: left; font-size: 11px;">DESCRIÇÃO</th>
          <th style="border: 1px solid #E2E8F0; padding: 10px; text-align: right; font-size: 11px;">VALOR MENSAL</th>
        </tr>
      </thead>
      <tbody>
        ${custosFixosData.map(c => `
          <tr>
            <td style="border: 1px solid #E2E8F0; padding: 10px; font-size: 11px;">${c.descricao}</td>
            <td style="border: 1px solid #E2E8F0; padding: 10px; text-align: right; font-size: 11px;">${Calc.formatCurrency(c.valor)}</td>
          </tr>`).join('')}
        <tr style="background: #F8FAFC; font-weight: bold;">
          <td style="border: 1px solid #E2E8F0; padding: 10px; font-size: 11px;">TOTAL CUSTOS FIXOS</td>
          <td style="border: 1px solid #E2E8F0; padding: 10px; text-align: right; font-size: 11px;">${Calc.formatCurrency(totalCustos)}</td>
        </tr>
      </tbody>
    </table>

    <h2 style="font-size: 16px; border-left: 4px solid #F59E0B; padding-left: 10px; margin-bottom: 15px;">INVENTÁRIO DE INSUMOS E MATÉRIAS-PRIMAS</h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
      <thead>
        <tr style="background: #F8FAFC;">
          <th style="border: 1px solid #E2E8F0; padding: 10px; text-align: left; font-size: 11px;">INSUMO</th>
          <th style="border: 1px solid #E2E8F0; padding: 10px; text-align: center; font-size: 11px;">UNIDADE</th>
          <th style="border: 1px solid #E2E8F0; padding: 10px; text-align: right; font-size: 11px;">CUSTO UNIT.</th>
        </tr>
      </thead>
      <tbody>
        ${insumosData.map(i => `
          <tr>
            <td style="border: 1px solid #E2E8F0; padding: 10px; font-size: 11px;">${i.nome}</td>
            <td style="border: 1px solid #E2E8F0; padding: 10px; text-align: center; font-size: 11px;">${i.unidade}</td>
            <td style="border: 1px solid #E2E8F0; padding: 10px; text-align: right; font-size: 11px;">${Calc.formatCurrency(Calc.calcCustoUnitario(i.valor_total, i.quantidade))}</td>
          </tr>`).join('')}
      </tbody>
    </table>

    <h2 style="font-size: 16px; border-left: 4px solid #38BDF8; padding-left: 10px; margin-bottom: 15px;">ANÁLISE DE FABRICAÇÃO (PRODUTOS ACABADOS)</h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
      <thead>
        <tr style="background: #F8FAFC;">
          <th style="border: 1px solid #E2E8F0; padding: 10px; text-align: left; font-size: 11px;">PRODUTO</th>
          <th style="border: 1px solid #E2E8F0; padding: 10px; text-align: right; font-size: 11px;">CUSTO MAT.</th>
          <th style="border: 1px solid #E2E8F0; padding: 10px; text-align: right; font-size: 11px;">MARKUP</th>
          <th style="border: 1px solid #E2E8F0; padding: 10px; text-align: right; font-size: 11px;">PREÇO FINAL</th>
        </tr>
      </thead>
      <tbody>
        ${produtosData.map(p => {
    const pFicha = fichaTecnicaData.filter(ft => ft.produto_id === p.id);
    const custoMP = Calc.sumCustoInsumos(pFicha, insumoMap);
    const imp = (Number(configData.taxa_impostos) || 0) / 100;
    const out = (Number(configData.outras_taxas) || 0) / 100;
    const mar = (Number(configData.margem_lucro) || 0) / 100;
    const fat = Number(configData.faturamento_mensal) || 1;
    const tcf = Calc.sumCustosFixos(custosFixosData);
    const cpct = Calc.calcCustoFixoPercentual(fat, tcf);
    const mkp = Calc.calcMarkup(imp, cpct, out, mar);
    const pvenda = Calc.calcPrecoVenda(custoMP, mkp);
    return `
            <tr>
              <td style="border: 1px solid #E2E8F0; padding: 10px; font-size: 11px;">${p.nome}</td>
              <td style="border: 1px solid #E2E8F0; padding: 10px; text-align: right; font-size: 11px;">${Calc.formatCurrency(custoMP)}</td>
              <td style="border: 1px solid #E2E8F0; padding: 10px; text-align: right; font-size: 11px;">${mkp.toFixed(2)}x</td>
              <td style="border: 1px solid #E2E8F0; padding: 10px; text-align: right; font-size: 11px; font-weight: bold; color: #0284C7;">${Calc.formatCurrency(pvenda)}</td>
            </tr>`;
  }).join('')}
      </tbody>
    </table>

    <h2 style="font-size: 16px; border-left: 4px solid #10B981; padding-left: 10px; margin-bottom: 15px;">ANÁLISE DE REVENDA</h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
      <thead>
        <tr style="background: #F8FAFC;">
          <th style="border: 1px solid #E2E8F0; padding: 10px; text-align: left; font-size: 11px;">PRODUTO</th>
          <th style="border: 1px solid #E2E8F0; padding: 10px; text-align: right; font-size: 11px;">VALOR COMPRA</th>
          <th style="border: 1px solid #E2E8F0; padding: 10px; text-align: right; font-size: 11px;">MARKUP</th>
          <th style="border: 1px solid #E2E8F0; padding: 10px; text-align: right; font-size: 11px;">PREÇO VENDA</th>
        </tr>
      </thead>
      <tbody>
        ${precificacaoRev.map(item => {
    const p = produtosData.find(prod => prod.id === item.produto_id);
    const vcompra = Number(item.valor_compra);
    const imp = (Number(configData.taxa_impostos) || 0) / 100;
    const out = (Number(configData.outras_taxas) || 0) / 100;
    const mar = (Number(configData.margem_lucro) || 0) / 100;
    const fat = Number(configData.faturamento_mensal) || 1;
    const tcf = Calc.sumCustosFixos(custosFixosData);
    const cpct = Calc.calcCustoFixoPercentual(fat, tcf);
    const mkp = Calc.calcMarkup(imp, cpct, out, mar);
    const pvenda = Calc.calcPrecoVenda(vcompra, mkp);
    return `
            <tr>
              <td style="border: 1px solid #E2E8F0; padding: 10px; font-size: 11px;">${p?.nome || '???'}</td>
              <td style="border: 1px solid #E2E8F0; padding: 10px; text-align: right; font-size: 11px;">${Calc.formatCurrency(vcompra)}</td>
              <td style="border: 1px solid #E2E8F0; padding: 10px; text-align: right; font-size: 11px;">${mkp.toFixed(2)}x</td>
              <td style="border: 1px solid #E2E8F0; padding: 10px; text-align: right; font-size: 11px; font-weight: bold; color: #059669;">${Calc.formatCurrency(pvenda)}</td>
            </tr>`;
  }).join('')}
      </tbody>
    </table>

    <div style="margin-top: 50px; text-align: center; border-top: 1px solid #E2E8F0; padding-top: 10px;">
      <p style="font-size: 9px; color: #94A3B8;">Este relatório é um documento técnico gerado automaticamente pelo sistema Precificação Pro. Os valores são baseados nos custos e configurações fornecidos pelo usuário.</p>
    </div>
  `;

  const opt = {
    margin: [15, 15],
    filename: `RELATORIO_PROFISSIONAL_${new Date().getTime()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  showToast("Preparando relatório técnico...", "info");

  html2pdf().set(opt).from(reportContainer).save().then(() => {
    showToast("Relatório PDF gerado com sucesso!", "success");
  }).catch(err => {
    showToast("Erro ao gerar relatório", "error");
    console.error(err);
  });
};

function renderCRUDs() {
  const insumoMap = new Map(insumosData.map(i => [i.id, i]));
  const productMap = new Map(produtosData.map(p => [p.id, p]));

  let html = '';

  switch (activeTab) {
    case 'configuracoes':
      html = `
        <div class="card">
          <h2>CONFIGURAÇÕES GERAIS</h2>
          <form id="config-form">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
                <div>
                  <label>FATURAMENTO MENSAL (R$)</label>
                  <input type="number" step="0.01" id="cfg-fat" value="${configData.faturamento_mensal || ''}" placeholder="0,00">
                </div>
                <div>
                  <label>TAXA DE IMPOSTOS (%)</label>
                  <input type="number" step="0.01" id="cfg-imp" value="${configData.taxa_impostos || ''}" placeholder="0,00">
                </div>
                <div>
                  <label>OUTRAS TAXAS (%)</label>
                  <input type="number" step="0.01" id="cfg-out" value="${configData.outras_taxas || ''}" placeholder="0,00">
                </div>
                <div>
                  <label>MARGEM DE LUCRO (%)</label>
                  <input type="number" step="0.01" id="cfg-mar" value="${configData.margem_lucro || ''}" placeholder="0,00">
                </div>
            </div>
            <button type="submit">SALVAR CONFIGURAÇÕES</button>
          </form>
        </div>`;
      break;

    case 'custos-fixos':
      html = `
      <div class="card">
          <h2>GESTÃO DE CUSTOS FIXOS</h2>
          <table>
            <thead>
              <tr>
                <th>DESCRIÇÃO</th>
                <th style="text-align: right;">VALOR</th>
                <th style="text-align: right;">AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              ${custosFixosData.map(c => `
                <tr>
                  <td data-label="DESCRIÇÃO"><strong>${c.descricao}</strong></td>
                  <td data-label="VALOR" style="text-align: right; color: var(--primary); font-weight: 600;">${Calc.formatCurrency(c.valor)}</td>
                  <td data-label="AÇÕES" style="text-align: right;"><button onclick="window.deleteCusto('${c.id}')" class="btn-danger">EXCLUIR</button></td>
                </tr>`).join('')}
            </tbody>
          </table>
          <form id="custo-form" style="grid-template-columns: 1fr 1fr auto;">
            <input type="text" placeholder="DESCRIÇÃO" id="custo-desc" required>
            <input type="number" placeholder="VALOR (R$)" id="custo-val" required step="0.01">
            <button type="submit">ADICIONAR CUSTO</button>
          </form>
        </div>`;
      break;

    case 'insumos':
      html = `
        <div class="card">
          <h2>GESTÃO DE INSUMOS</h2>
          <table>
            <thead>
              <tr>
                <th>INSUMO</th>
                <th style="text-align: right;">CUSTO UNI.</th>
                <th style="text-align: right;">AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              ${insumosData.map(i => `
                <tr>
                  <td data-label="INSUMO">
                    <strong>${i.nome}</strong><br>
                    <small style="color: var(--text-muted);">${i.unidade}</small>
                  </td>
                  <td data-label="CUSTO UNI." style="text-align: right; color: var(--accent); font-weight: 600;">${Calc.formatCurrency(Calc.calcCustoUnitario(i.valor_total, i.quantidade))}</td>
                  <td data-label="AÇÕES" style="text-align: right;"><button onclick="window.deleteInsumo('${i.id}')" class="btn-danger">EXCLUIR</button></td>
                </tr>`).join('')}
            </tbody>
          </table>
          <form id="insumo-form" style="grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)) auto;">
            <input type="text" placeholder="NOME" id="ins-nome" required>
            <input type="text" placeholder="UNIDADE" id="ins-uni" required>
            <input type="number" placeholder="QTD" id="ins-qtd" required step="0.01">
            <input type="number" placeholder="VALOR TOTAL" id="ins-total" required step="0.01">
            <button type="submit">ADICIONAR</button>
          </form>
        </div>`;
      break;

    case 'produtos':
      html = `
        <div class="card">
          <h2>GESTÃO DE PRODUTOS</h2>
          <table>
            <thead>
              <tr>
                <th>PRODUTO/CATÁLOGO</th>
                <th style="text-align: right;">AÇÕES</th>
              </tr>
            </thead>
            <tbody>
               ${produtosData.map(p => `
                 <tr>
                   <td data-label="PRODUTO"><strong>${p.nome}</strong></td>
                   <td data-label="AÇÕES" style="text-align: right;"><button onclick="window.deleteProduto('${p.id}')" class="btn-danger">EXCLUIR</button></td>
                 </tr>`).join('')}
            </tbody>
          </table>
          <form id="produto-form" style="grid-template-columns: 1fr auto;">
            <input type="text" placeholder="NOME DO PRODUTO" id="prod-nome" required>
            <button type="submit">CADASTRAR PRODUTO</button>
          </form>
        </div>`;
      break;

    case 'ficha-tecnica':
      html = `
        <div class="card">
          <h2>COMPOSIÇÃO DE PRODUTOS (FICHA TÉCNICA)</h2>
          <form id="ficha-form" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)) auto; background: var(--bg-surface); padding: 1rem;">
            <select id="ficha-prod">
                <option value="">SELECIONE O PRODUTO...</option>
                ${produtosData.map(p => `<option value="${p.id}">${p.nome}</option>`).join('')}
            </select>
            <select id="ficha-insumo">
                <option value="">SELECIONE O INSUMO...</option>
                ${insumosData.map(i => `<option value="${i.id}">${i.nome} (${i.unidade})</option>`).join('')}
            </select>
            <input type="number" placeholder="QUANTIDADE" id="ficha-qtd" required step="0.01">
            <button type="submit">ADICIONAR ITEM</button>
          </form>
          <div id="ficha-list" style="margin-top: 2rem;">
            ${renderFichaList(insumoMap, productMap)}
          </div>
        </div>`;
      break;

    case 'precificacao-fabricacao':
      html = `
        <div class="card">
          <h2>ANÁLISE DE PREÇOS (FABRICAÇÃO)</h2>
          <div style="overflow-x: auto;">
            <table>
              <thead>
                  <tr>
                      <th>PRODUTO</th>
                      <th>CUSTO MATERIAL</th>
                      <th>MARKUP</th>
                      <th>PREÇO FINAL</th>
                  </tr>
              </thead>
              <tbody>
                  ${renderPricingRows(insumoMap)}
              </tbody>
            </table>
          </div>
        </div>`;
      break;

    case 'precificacao-revenda':
      html = `
        <div class="card">
          <h2>ANÁLISE DE PREÇOS (REVENDA)</h2>
          <form id="revenda-form" style="grid-template-columns: 1fr 1fr auto; background: var(--bg-surface); padding: 1rem;">
            <select id="revenda-prod">
                <option value="">SELECIONE O PRODUTO...</option>
                ${produtosData.map(p => `<option value="${p.id}">${p.nome}</option>`).join('')}
            </select>
            <input type="number" placeholder="VALOR DE COMPRA" id="revenda-valor" required step="0.01">
            <button type="submit">PRECIFICAR</button>
          </form>
          <div style="overflow-x: auto;">
            <table>
              <thead>
                  <tr>
                      <th>PRODUTO</th>
                      <th>COMPRA</th>
                      <th>MARKUP</th>
                      <th>VENDA</th>
                      <th>AÇÕES</th>
                  </tr>
              </thead>
              <tbody>
                  ${renderResaleRows()}
              </tbody>
            </table>
          </div>
        </div>`;
      break;
  }

  tabContentSection.innerHTML = html;

  if (activeTab === 'configuracoes') document.getElementById('config-form').addEventListener('submit', saveConfig);
  if (activeTab === 'custos-fixos') document.getElementById('custo-form').addEventListener('submit', addCusto);
  if (activeTab === 'insumos') document.getElementById('insumo-form').addEventListener('submit', addInsumo);
  if (activeTab === 'produtos') document.getElementById('produto-form').addEventListener('submit', addProduto);
  if (activeTab === 'ficha-tecnica') document.getElementById('ficha-form').addEventListener('submit', addFichaItem);
  if (activeTab === 'precificacao-revenda') document.getElementById('revenda-form').addEventListener('submit', saveRevendaItem);
}

// --- Helpers for Rendering ---

function renderFichaList(insumoMap, productMap) {
  if (!fichaTecnicaData.length) return '<p style="color: var(--text-muted); font-size: 0.85rem;">Nenhum componente cadastrado.</p>';
  const grouped = {};
  fichaTecnicaData.forEach(ft => {
    if (!grouped[ft.produto_id]) grouped[ft.produto_id] = [];
    grouped[ft.produto_id].push(ft);
  });
  let html = '';
  for (const [pid, items] of Object.entries(grouped)) {
    const pName = productMap.get(pid)?.nome || '???';
    html += `
      <div style="margin-top: 1.5rem;">
        <h4 style="margin-bottom: 0.5rem; font-size: 0.9rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.5rem;">
          <span style="width: 8px; height: 8px; background: var(--primary); border-radius: 50%;"></span>
          ${pName}
        </h4>
        <table>
          <thead>
            <tr>
              <th>INSUMO / COMPONENTE</th>
              <th style="text-align: right;">QUANTIDADE</th>
              <th style="text-align: right;">AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(ft => {
      const ins = insumoMap.get(ft.insumo_id);
      return `
                <tr>
                  <td data-label="INSUMO"><strong>${ins?.nome || '???'}</strong></td>
                  <td data-label="QUANTIDADE" style="text-align: right;">${ft.quantidade} ${ins?.unidade || ''}</td>
                  <td data-label="AÇÕES" style="text-align: right;"><button onclick="window.deleteFicha('${ft.id}')" class="btn-danger">REMOVER</button></td>
                </tr>`;
    }).join('')}
          </tbody>
        </table>
      </div>`;
  }
  return html;
}

function renderPricingRows(insumoMap) {
  return produtosData.map(p => {
    const pFicha = fichaTecnicaData.filter(ft => ft.produto_id === p.id);
    const custoMP = Calc.sumCustoInsumos(pFicha, insumoMap);
    const imp = (Number(configData.taxa_impostos) || 0) / 100;
    const out = (Number(configData.outras_taxas) || 0) / 100;
    const mar = (Number(configData.margem_lucro) || 0) / 100;
    const faturamento = Number(configData.faturamento_mensal) || 1;
    const totalCustosFixos = Calc.sumCustosFixos(custosFixosData);
    const cfPct = Calc.calcCustoFixoPercentual(faturamento, totalCustosFixos);
    const markup = Calc.calcMarkup(imp, cfPct, out, mar);
    const precoVenda = Calc.calcPrecoVenda(custoMP, markup);
    return `
        <tr>
            <td data-label="PRODUTO"><strong>${p.nome}</strong></td>
            <td data-label="CUSTO MATERIAL">${Calc.formatCurrency(custoMP)}</td>
            <td data-label="MARKUP">${markup.toFixed(2)}x</td>
            <td data-label="PREÇO FINAL"><strong style="color: var(--primary);">${Calc.formatCurrency(precoVenda)}</strong></td>
        </tr>`;
  }).join('');
}

function renderResaleRows() {
  return precificacaoRev.map(item => {
    const p = produtosData.find(prod => prod.id === item.produto_id);
    const valCompra = Number(item.valor_compra);
    const imp = (Number(configData.taxa_impostos) || 0) / 100;
    const out = (Number(configData.outras_taxas) || 0) / 100;
    const mar = (Number(configData.margem_lucro) || 0) / 100;
    const faturamento = Number(configData.faturamento_mensal) || 1;
    const totalCustosFixos = Calc.sumCustosFixos(custosFixosData);
    const cfPct = Calc.calcCustoFixoPercentual(faturamento, totalCustosFixos);
    const markup = Calc.calcMarkup(imp, cfPct, out, mar);
    const precoVenda = Calc.calcPrecoVenda(valCompra, markup);
    return `
    <tr>
        <td data-label="PRODUTO"><strong>${p?.nome || '???'}</strong></td>
        <td data-label="COMPRA">${Calc.formatCurrency(valCompra)}</td>
        <td data-label="MARKUP">${markup.toFixed(2)}x</td>
        <td data-label="VENDA"><strong style="color: var(--primary);">${Calc.formatCurrency(precoVenda)}</strong></td>
        <td data-label="AÇÕES"><button onclick="window.deleteRevenda('${item.id}')" class="btn-danger">EXCLUIR</button></td>
    </tr>`;
  }).join('');
}

// --- Action Handlers ---
async function saveConfig(e) {
  e.preventDefault();
  const payload = {
    user_id: currentUser.id,
    faturamento_mensal: document.getElementById('cfg-fat').value,
    taxa_impostos: document.getElementById('cfg-imp').value,
    outras_taxas: document.getElementById('cfg-out').value,
    margem_lucro: document.getElementById('cfg-mar').value
  };
  let error;
  if (configData.id) {
    ({ error } = await supabaseClient.from('configuracoes').update(payload).eq('id', configData.id));
  } else {
    ({ error } = await supabaseClient.from('configuracoes').insert(payload));
  }
  if (!error) { showToast("Configurações salvas", "success"); loadData(); }
  else showToast(error.message, "error");
}

async function addCusto(e) {
  e.preventDefault();
  const { error } = await supabaseClient.from('custos_fixos').insert({
    user_id: currentUser.id,
    descricao: document.getElementById('custo-desc').value,
    valor: document.getElementById('custo-val').value
  });
  if (!error) { showToast("Custo adicionado", "success"); document.getElementById('custo-form').reset(); loadData(); }
}

async function addInsumo(e) {
  e.preventDefault();
  const { error } = await supabaseClient.from('insumos').insert({
    user_id: currentUser.id,
    nome: document.getElementById('ins-nome').value,
    unidade: document.getElementById('ins-uni').value,
    quantidade: document.getElementById('ins-qtd').value,
    valor_total: document.getElementById('ins-total').value
  });
  if (!error) { showToast("Insumo cadastrado", "success"); document.getElementById('insumo-form').reset(); loadData(); }
}

async function addProduto(e) {
  e.preventDefault();
  const { error } = await supabaseClient.from('produtos').insert({
    user_id: currentUser.id,
    nome: document.getElementById('prod-nome').value
  });
  if (!error) { showToast("Produto cadastrado", "success"); document.getElementById('produto-form').reset(); loadData(); }
}

async function addFichaItem(e) {
  e.preventDefault();
  const pid = document.getElementById('ficha-prod').value;
  const iid = document.getElementById('ficha-insumo').value;
  const qtd = document.getElementById('ficha-qtd').value;
  if (!pid || !iid) return showToast("Selecione produto e insumo", "info");
  const { error } = await supabaseClient.from('ficha_tecnica').insert({
    user_id: currentUser.id,
    produto_id: pid,
    insumo_id: iid,
    quantidade: qtd
  });
  if (!error) { showToast("Item vinculado", "success"); document.getElementById('ficha-form').reset(); loadData(); }
}

async function saveRevendaItem(e) {
  e.preventDefault();
  const pid = document.getElementById('revenda-prod').value;
  const val = document.getElementById('revenda-valor').value;
  if (!pid) return showToast("Selecione o produto", "info");
  const { error } = await supabaseClient.from('precificacao_revenda').insert({
    user_id: currentUser.id,
    produto_id: pid,
    valor_compra: val,
    markup: 0,
    preco_venda: 0
  });
  if (!error) { showToast("Cálculo salvo", "success"); document.getElementById('revenda-form').reset(); loadData(); }
  else showToast(error.message, "error");
}

// Global exposure
window.deleteCusto = async (id) => { if (confirm("Deseja realmente excluir este custo?")) { await supabaseClient.from('custos_fixos').delete().eq('id', id); showToast("Custo removido", "info"); loadData(); } };
window.deleteInsumo = async (id) => { if (confirm("Deseja realmente excluir este insumo?")) { await supabaseClient.from('insumos').delete().eq('id', id); showToast("Insumo removido", "info"); loadData(); } };
window.deleteProduto = async (id) => { if (confirm("Deseja realmente excluir este produto?")) { await supabaseClient.from('produtos').delete().eq('id', id); showToast("Produto removido", "info"); loadData(); } };
window.deleteFicha = async (id) => { if (confirm("Deseja realmente excluir este item?")) { await supabaseClient.from('ficha_tecnica').delete().eq('id', id); showToast("Item removido", "info"); loadData(); } };
window.deleteRevenda = async (id) => { if (confirm("Deseja realmente excluir esta precificação?")) { await supabaseClient.from('precificacao_revenda').delete().eq('id', id); showToast("Precificação removida", "info"); loadData(); } };

