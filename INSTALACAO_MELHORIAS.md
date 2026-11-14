# Instalação das melhorias — Logísticas Bill

## 1. Instalar dependências

No PowerShell, dentro da pasta do projeto:

```powershell
npm.cmd install
```

Se o PowerShell bloquear `npm.ps1`, use sempre `npm.cmd` ou execute:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

## 2. Aplicar o banco

Há duas opções. Em um banco existente, prefira a opção SQL manual, pois ela copia o nome dos produtos antigos para `descricaoLivre` antes de remover o catálogo.

### Opção A — Prisma (banco novo ou sem dados de produtos)

Configure `DATABASE_URL` no arquivo `.env` e rode:

```powershell
npx prisma db push
npx prisma generate
```

### Opção B — SQL manual

Abra `MELHORIAS_SQL.sql` no SQL Editor do Layerbase/PostgreSQL, execute todo o conteúdo e depois gere o cliente:

```powershell
npx prisma generate
```

> Atenção: esta versão remove deliberadamente a tabela `Produto` e a coluna de vínculo dos itens. Faça um backup antes de executar o SQL. Os carregamentos permanecem, e cada item passa a usar `descricaoLivre`.

O SQL é idempotente: pode ser executado novamente sem recriar as colunas já existentes.

## 3. Gerar o Prisma Client

PowerShell:

```powershell
.\scripts\gerar-prisma.ps1
```

CMD:

```cmd
scripts\gerar-prisma.bat
```

Ou diretamente:

```powershell
npx prisma generate
```

## 4. Validar e iniciar

```powershell
npx tsc --noEmit
npm.cmd run build
npm.cmd start
```

## Observações

- A senha mínima agora é de 4 caracteres.
- O vínculo de um usuário a um funcionário/motorista é feito na aba Usuários.
- Usuários comuns vinculados a um funcionário visualizam somente as cargas em que são motoristas.
- O administrador continua com acesso total.
- O motorista só recebe cargas cujo horário programado já chegou, no dia programado, e que estejam vinculadas ao seu funcionário.
- As permissões de abas e botões são validadas também no servidor; esconder o botão no navegador não é a única proteção.
- Os campos obrigatórios de cada item são: produto/descrição, número da ordem, nome do cliente, telefone e cidade. Bairro, localização, observação e nota fiscal são opcionais e só aparecem quando preenchidos.
- A nota fiscal aceita PDF opcional de até 10 MB por item. O conteúdo é salvo no campo `notaFiscalData` e o nome original em `notaFiscalNome`; execute a migração SQL antes de usar o anexo.
- Usuários e Painel usam os eventos realtime do canal `logistica-global` e não fazem consultas periódicas. A lista atualiza quando há cadastro, edição, logout ou mudança de presença.
- A alteração rápida de status do item usa uma operação direta e publica o evento depois da resposta, reduzindo a espera do motorista.
- `PRISMA_CONNECTION_LIMIT` é opcional e pode ser definido no `.env`; o padrão desta versão é 3 conexões por instância.
