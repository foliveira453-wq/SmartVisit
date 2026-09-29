import Papa from 'papaparse';
import { Produto, User, Cliente, ImportRecord } from '../types';
import { StorageService } from './storage';
import { supabase } from './supabaseClient';

/**
 * Downloads a model template CSV for Products
 */
export function downloadProdutosModelCSV(): void {
  const data = [
    {
      Codigo: 'P2001',
      Descricao: 'Sensor Infrvermelho de Barreira Industrial 24V',
      E: 'UN',
      PrecoBase: '890.00',
    },
    {
      Codigo: 'P2002',
      Descricao: 'IHM Touchscreen 7 Polegadas Colorida RS485',
      E: 'UN',
      PrecoBase: '2450.00',
    },
    {
      Codigo: 'P2003',
      Descricao: 'Relé de Segurança Categoria 4 SIL3',
      E: 'CX',
      PrecoBase: '620.00',
    },
  ];

  const csv = Papa.unparse(data, { delimiter: ';' });
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Modelo_Produtos_SmartVisit.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads a model template CSV for Clients
 */
export function downloadClientesModelCSV(): void {
  const data = [
    {
      Codigo: 'CLI001',
      RazaoSocial: 'Indústria Metalúrgica Vale do Aço Ltda',
      Endereco: 'Av. Industrial, 1500',
      Bairro: 'Distrito Industrial',
      Cidade: 'Campinas',
      UF: 'SP',
      CEP: '13050-000',
      Telefone: '(19) 3800-4000',
      CNPJ: '45.678.901/0001-22',
    },
    {
      Codigo: 'CLI002',
      RazaoSocial: 'Tecnologia Automotiva do Brasil S/A',
      Endereco: 'Rua das Nascenças, 450',
      Bairro: 'Jardim Primavera',
      Cidade: 'São José dos Campos',
      UF: 'SP',
      CEP: '12220-100',
      Telefone: '(12) 3944-5500',
      CNPJ: '12.890.345/0001-88',
    },
  ];

  const csv = Papa.unparse(data, { delimiter: ';' });
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Modelo_Clientes_SmartVisit.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads a model template CSV for Users
 */
export function downloadUsuariosModelCSV(): void {
  const data = [
    {
      Login: 'rodrigo.vendedor@empresa.com',
      Senha: '123',
      Nome: 'Rodrigo Alcantara',
      Setor: 'Vendas SP Interior',
    },
    {
      Login: 'camila.vendedora@empresa.com',
      Senha: '123',
      Nome: 'Camila Rodrigues',
      Setor: 'Vendas Região Sul',
    },
  ];

  const csv = Papa.unparse(data, { delimiter: ';' });
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Modelo_Usuarios_SmartVisit.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parses and imports Products from CSV / Excel-CSV file
 */
export async function importProdutosFromCSV(
  file: File,
  workspaceId: string,
  autorNome: string
): Promise<ImportRecord> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => {
        const rows = results.data as any[];
        let total = 0;
        let errosQtd = 0;
        const mensagensErro: string[] = [];

        // Helper para busca flexível de colunas (ignora acentos e maiúsculas/minúsculas)
        const getColumnVal = (rowObj: Record<string, any>, candidateNames: string[]) => {
          for (const name of candidateNames) {
            if (rowObj[name] !== undefined && rowObj[name] !== null && String(rowObj[name]).trim() !== '') {
              return rowObj[name];
            }
          }
          const rowKeys = Object.keys(rowObj);
          for (const candidate of candidateNames) {
            const normCandidate = candidate.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            const matchedKey = rowKeys.find(rk => {
              const normRk = rk.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
              return normRk === normCandidate;
            });
            if (matchedKey && rowObj[matchedKey] !== undefined && rowObj[matchedKey] !== null && String(rowObj[matchedKey]).trim() !== '') {
              return rowObj[matchedKey];
            }
          }
          return undefined;
        };

        const parseCurrencyValue = (raw: any): number => {
          if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
          if (!raw) return 0;
          let str = String(raw).trim().replace(/[R$\s]/g, '');
          if (str.includes(',') && str.includes('.')) {
            // Formato brasileiro padrão: 1.250,50 -> 1250.50
            str = str.replace(/\./g, '').replace(',', '.');
          } else if (str.includes(',')) {
            // Formato com vírgula: 250,50 -> 250.50
            str = str.replace(',', '.');
          }
          const parsed = parseFloat(str);
          return isNaN(parsed) ? 0 : parsed;
        };

        const prodsToUpsert: Produto[] = [];
        rows.forEach((row, idx) => {
          const codigo = getColumnVal(row, ['Codigo', 'codigo', 'CÓDIGO', 'Código', 'COD', 'Cod', 'ID']);
          const descricao = getColumnVal(row, ['Descricao', 'descricao', 'DESCRIÇÃO', 'Descrição', 'Produto', 'PRODUTO', 'Nome', 'NOME']);
          const embalagem = getColumnVal(row, ['E', 'e', 'Embalagem', 'embalagem', 'EMBALAGEM', 'E (Embalagem)', 'UN', 'Unidade']);
          const precoRaw = getColumnVal(row, [
            'PrecoBase', 'preco_base', 'PREÇO BASE', 'Preço Base', 'Preco Base',
            'Preço Unitário', 'Preço Unit', 'Preco Unitario', 'Preco Unit',
            'PREÇO UNITÁRIO', 'PREÇO UNIT', 'PRECO UNITARIO', 'PRECO UNIT',
            'Preço', 'PREÇO', 'Preco', 'PRECO',
            'Valor Unitário', 'Valor Unit', 'VALOR UNITÁRIO', 'VALOR UNIT',
            'Valor', 'VALOR', 'Vlr Unit', 'VLR UNIT', 'Vlr. Unit', 'Unitário', 'Unitario'
          ]);

          if (!codigo || !descricao) {
            errosQtd++;
            mensagensErro.push(`Linha ${idx + 2}: Código ou Descrição ausentes.`);
            return;
          }

          const preco = parseCurrencyValue(precoRaw);

          const newProd: Produto = {
            id: `prod-imp-${Date.now()}-${idx}`,
            workspace_id: workspaceId,
            codigo: String(codigo).trim().toUpperCase(),
            descricao: String(descricao).trim(),
            embalagem: String(embalagem || 'UN').trim().toUpperCase(),
            preco_base: preco,
          };

          prodsToUpsert.push(newProd);
          StorageService.saveProduto(newProd);
          total++;
        });

        // Batch persist in Supabase
        if (prodsToUpsert.length > 0) {
          const payloads = prodsToUpsert.map(p => ({
            id: p.id,
            workspace_id: p.workspace_id,
            filial_id: p.workspace_id,
            codigo: p.codigo,
            descricao: p.descricao,
            embalagem: p.embalagem,
            preco_base: p.preco_base,
          }));
          supabase.from('produtos').upsert(payloads, { onConflict: 'id' }).then(({ error }) => {
            if (error) console.error('Erro ao salvar lote de produtos no Supabase:', error.message);
          });
        }

        const record: ImportRecord = {
          id: `imp-${Date.now()}`,
          workspace_id: workspaceId,
          arquivo_nome: file.name,
          tipo: 'produtos',
          status: errosQtd === 0 ? 'sucesso' : total > 0 ? 'sucesso_parcial' : 'erro',
          total_registros: total,
          erros_qtd: errosQtd,
          mensagens_erro: mensagensErro,
          data: new Date().toISOString(),
          autor_nome: autorNome,
        };

        StorageService.saveImportRecord(record);
        StorageService.logAudit(workspaceId, autorNome, `Importação de ${total} produtos via arquivo ${file.name}`, 'Importação');
        resolve(record);
      },
      error: (err) => {
        const record: ImportRecord = {
          id: `imp-${Date.now()}`,
          workspace_id: workspaceId,
          arquivo_nome: file.name,
          tipo: 'produtos',
          status: 'erro',
          total_registros: 0,
          erros_qtd: 1,
          mensagens_erro: [`Erro ao ler arquivo: ${err.message}`],
          data: new Date().toISOString(),
          autor_nome: autorNome,
        };
        StorageService.saveImportRecord(record);
        resolve(record);
      },
    });
  });
}

/**
 * Parses and imports Users (Vendedores) from CSV file
 */
export async function importUsuariosFromCSV(
  file: File,
  workspaceId: string,
  autorNome: string
): Promise<ImportRecord> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => {
        const rows = results.data as any[];
        let total = 0;
        let errosQtd = 0;
        const mensagensErro: string[] = [];

        const usersToUpsert: User[] = [];
        rows.forEach((row, idx) => {
          const login = row.Login || row.login || row['LOGIN'];
          const senha = row.Senha || row.senha || row['SENHA'] || '123';
          const nome = row.Nome || row.nome || row['NOME'] || row['Nome Completo'];
          const setor = row.Setor || row.setor || row['SETOR'] || 'Vendas';

          if (!login || !nome) {
            errosQtd++;
            mensagensErro.push(`Linha ${idx + 2}: Login ou Nome ausentes.`);
            return;
          }

          const cleanNome = String(nome).trim();
          const cleanLogin = String(login).trim().toLowerCase();

          if (StorageService.isDuplicateUserName(cleanNome)) {
            errosQtd++;
            mensagensErro.push(`Linha ${idx + 2}: O usuário "${cleanNome}" já existe no sistema com este nome.`);
            return;
          }

          if (StorageService.isDuplicateUserLogin(cleanLogin)) {
            errosQtd++;
            mensagensErro.push(`Linha ${idx + 2}: O usuário com o login "${cleanLogin}" já existe no sistema.`);
            return;
          }

          const newUser: User = {
            id: `usr-imp-${Date.now()}-${idx}`,
            login: cleanLogin,
            senha: String(senha).trim(),
            nome: cleanNome,
            setor: String(setor).trim(),
            role: 'vendedor',
            workspace_id: workspaceId,
            filialId: workspaceId,
            created_at: new Date().toISOString(),
          };

          usersToUpsert.push(newUser);
          StorageService.saveUser(newUser);
          total++;
        });

        // Batch persist to Supabase
        if (usersToUpsert.length > 0) {
          const userPayloads = usersToUpsert.map(u => ({
            id: u.id,
            workspace_id: u.workspace_id,
            filial_id: u.workspace_id,
            login: u.login,
            senha: u.senha || '123',
            nome: u.nome,
            setor: u.setor,
            role: u.role,
            ativo: true,
          }));
          supabase.from('usuarios').upsert(userPayloads, { onConflict: 'id' }).then(({ error }) => {
            if (error) console.error('Erro ao salvar lote de usuários no Supabase:', error.message);
          });
        }

        const record: ImportRecord = {
          id: `imp-${Date.now()}`,
          workspace_id: workspaceId,
          arquivo_nome: file.name,
          tipo: 'usuarios',
          status: errosQtd === 0 ? 'sucesso' : total > 0 ? 'sucesso_parcial' : 'erro',
          total_registros: total,
          erros_qtd: errosQtd,
          mensagens_erro: mensagensErro,
          data: new Date().toISOString(),
          autor_nome: autorNome,
        };

        StorageService.saveImportRecord(record);
        StorageService.logAudit(workspaceId, autorNome, `Importação de ${total} novos usuários vendedores via ${file.name}`, 'Importação');
        resolve(record);
      },
      error: (err) => {
        const record: ImportRecord = {
          id: `imp-${Date.now()}`,
          workspace_id: workspaceId,
          arquivo_nome: file.name,
          tipo: 'usuarios',
          status: 'erro',
          total_registros: 0,
          erros_qtd: 1,
          mensagens_erro: [`Erro ao ler arquivo: ${err.message}`],
          data: new Date().toISOString(),
          autor_nome: autorNome,
        };
        StorageService.saveImportRecord(record);
        resolve(record);
      },
    });
  });
}

/**
 * Parses and imports Clients from CSV / Excel-CSV file
 */
export async function importClientesFromCSV(
  file: File,
  workspaceId: string,
  autorNome: string
): Promise<ImportRecord> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => {
        const rows = results.data as any[];
        let total = 0;
        let errosQtd = 0;
        const mensagensErro: string[] = [];

        const clisToUpsert: Cliente[] = [];
        rows.forEach((row, idx) => {
          const codigo = row.Codigo || row.codigo || row['CÓDIGO'] || row['Código'];
          const razaoSocial = row.RazaoSocial || row.razao_social || row['RAZÃO SOCIAL'] || row['Razão Social'] || row.Nome || row.nome;
          const endereco = row.Endereco || row.endereco || row['ENDEREÇO'] || row['Endereço'] || '';
          const bairro = row.Bairro || row.bairro || row['BAIRRO'] || '';
          const cidade = row.Cidade || row.cidade || row['CIDADE'] || row['Município'] || row['Municipio'] || '';
          const uf = row.UF || row.uf || row['ESTADO'] || row['Estado'] || 'SP';
          const cep = row.CEP || row.cep || row['Cep'] || '';
          const telefone = row.Telefone || row.telefone || row['TELEFONE'] || row['Tel'] || '';
          const cnpj = row.CNPJ || row.cnpj || row['CNPJ'] || row['Cnpj'] || row.CPF_CNPJ || row.cpf_cnpj || row['CPF/CNPJ'] || '';

          if (!razaoSocial) {
            errosQtd++;
            mensagensErro.push(`Linha ${idx + 2}: Razão Social ausente.`);
            return;
          }

          const clientCode = codigo ? String(codigo).trim().toUpperCase() : `CLI${String(total + 1).padStart(3, '0')}`;

          const newCli: Cliente = {
            id: `cli-imp-${Date.now()}-${idx}`,
            workspace_id: workspaceId,
            filialId: workspaceId,
            codigo: clientCode,
            razao_social: String(razaoSocial).trim(),
            cnpj: String(cnpj).trim() || undefined,
            endereco: String(endereco).trim(),
            bairro: String(bairro).trim(),
            cidade: String(cidade).trim(),
            uf: String(uf).trim().toUpperCase(),
            cep: String(cep).trim(),
            telefone: String(telefone).trim(),
          };

          clisToUpsert.push(newCli);
          StorageService.saveCliente(newCli);
          total++;
        });

        // Batch persist to Supabase
        if (clisToUpsert.length > 0) {
          const cliPayloads = clisToUpsert.map(c => ({
            id: c.id,
            workspace_id: c.workspace_id,
            filial_id: c.filialId || c.workspace_id,
            codigo: c.codigo,
            razao_social: c.razao_social,
            cnpj: c.cnpj || null,
            cpf_cnpj: c.cnpj || null,
            endereco: c.endereco || null,
            bairro: c.bairro || null,
            cidade: c.cidade || null,
            uf: c.uf || null,
            cep: c.cep || null,
            telefone: c.telefone || null,
          }));
          supabase.from('clientes').upsert(cliPayloads, { onConflict: 'id' }).then(({ error }) => {
            if (error) console.error('Erro ao salvar lote de clientes no Supabase:', error.message);
          });
        }

        const record: ImportRecord = {
          id: `imp-${Date.now()}`,
          workspace_id: workspaceId,
          arquivo_nome: file.name,
          tipo: 'clientes',
          status: errosQtd === 0 ? 'sucesso' : total > 0 ? 'sucesso_parcial' : 'erro',
          total_registros: total,
          erros_qtd: errosQtd,
          mensagens_erro: mensagensErro,
          data: new Date().toISOString(),
          autor_nome: autorNome,
        };

        StorageService.saveImportRecord(record);
        StorageService.logAudit(workspaceId, autorNome, `Importação de ${total} clientes via arquivo ${file.name}`, 'Importação');
        resolve(record);
      },
      error: (err) => {
        const record: ImportRecord = {
          id: `imp-${Date.now()}`,
          workspace_id: workspaceId,
          arquivo_nome: file.name,
          tipo: 'clientes',
          status: 'erro',
          total_registros: 0,
          erros_qtd: 1,
          mensagens_erro: [`Erro ao ler arquivo: ${err.message}`],
          data: new Date().toISOString(),
          autor_nome: autorNome,
        };
        StorageService.saveImportRecord(record);
        resolve(record);
      },
    });
  });
}

