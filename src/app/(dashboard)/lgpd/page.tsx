"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";

const SECTIONS = [
  {
    title: "1. Introdução e compromisso",
    body: `A Logísticas Bill trata dados pessoais em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD). Este documento descreve, de forma clara, quais dados são tratados, para quais finalidades, bases legais, direitos do titular e medidas de segurança adotadas no sistema.`,
  },
  {
    title: "2. Controlador e canal de contato",
    body: `O controlador dos dados é a organização que opera esta instância do sistema. Para exercer direitos ou esclarecer dúvidas sobre privacidade, utilize o e-mail de suporte: support.logisticasbill@gmail.com.`,
  },
  {
    title: "3. Dados pessoais tratados",
    body: `Podem ser tratados, conforme o uso do sistema:
• Dados de identificação e acesso: nome, nome de usuário, e-mail, cargo/perfil.
• Dados profissionais: vínculo com funcionário/motorista, registros de diárias, faltas, carregamentos e rotas.
• Dados técnicos de sessão: endereço IP em logs de autenticação, data/hora de acesso, dispositivo (quando informado em push).
• Documentos operacionais: notas fiscais em PDF anexadas a itens de carga (armazenadas de forma privada e com retenção limitada).
Não coletamos dados sensíveis (origem racial, religião, saúde, vida sexual, etc.), salvo se o cliente inserir voluntariamente em campos de texto livre — o que não é recomendado.`,
  },
  {
    title: "4. Finalidades e bases legais",
    body: `• Execução de contrato / legítimo interesse (art. 7º, V e IX): operação logística, controle de frota, diárias, relatórios internos e auditoria.
• Consentimento ou legítimo interesse: notificações push, quando habilitadas pelo usuário.
• Cumprimento de obrigação legal: retenção mínima de registros fiscais/operacionais quando aplicável ao negócio do cliente.
Os dados não são utilizados para marketing de terceiros nem vendidos.`,
  },
  {
    title: "5. Compartilhamento e subprocessadores",
    body: `O sistema pode utilizar provedores de infraestrutura (hospedagem, banco de dados, armazenamento de arquivos e envio de e-mail). Esses prestadores atuam como operadores, sob instruções do controlador, e devem manter medidas de segurança adequadas. Não há compartilhamento com terceiros para fins comerciais.`,
  },
  {
    title: "6. Armazenamento e retenção",
    body: `• Contas de usuário e registros operacionais: mantidos enquanto a conta estiver ativa e pelo período necessário às finalidades do contrato.
• PDFs de notas fiscais no armazenamento de objetos: excluídos automaticamente após 7 (sete) dias corridos.
• Tokens de redefinição de senha: validade de 30 minutos; descartados após uso ou expiração.
• Sessões autenticadas: expiração configurável (padrão de 7 dias de inatividade/validade do token).`,
  },
  {
    title: "7. Segurança da informação",
    body: `Medidas adotadas incluem, entre outras:
• Senhas armazenadas com algoritmo Argon2id (não reversível).
• Sessões com JWT em cookie HttpOnly, Secure em produção e SameSite.
• Controle de acesso por perfil (RBAC) e permissões granulares.
• Comunicação HTTPS em produção.
• Auditoria de ações sensíveis (quando habilitada).
• Acesso administrativo restrito à gestão de usuários e logs.`,
  },
  {
    title: "8. Direitos do titular (art. 18 da LGPD)",
    body: `O titular pode solicitar:
• Confirmação da existência de tratamento;
• Acesso aos dados;
• Correção de dados incompletos, inexatos ou desatualizados;
• Anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos;
• Portabilidade, quando aplicável;
• Informação sobre compartilhamentos;
• Revogação de consentimento, quando esta for a base legal.
Pedidos podem ser enviados ao canal de contato indicado. A resposta observará os prazos legais.`,
  },
  {
    title: "9. Cookies e tecnologias semelhantes",
    body: `O sistema utiliza cookie de sessão essencial à autenticação. Preferências de tema/layout podem ser guardadas localmente no navegador. Não utilizamos cookies de publicidade de terceiros.`,
  },
  {
    title: "10. Incidentes de segurança",
    body: `Em caso de incidente de segurança que possa acarretar risco ou dano relevante aos titulares, o controlador avaliará a necessidade de comunicação à ANPD e aos titulares afetados, nos termos da LGPD e orientações da autoridade.`,
  },
  {
    title: "11. Atualizações desta política",
    body: `Este texto pode ser atualizado para refletir mudanças legais ou do sistema. A versão vigente permanece acessível nesta página. Recomenda-se a leitura periódica.`,
  },
  {
    title: "12. Observação operacional",
    body: `Este documento orienta o uso do software Logísticas Bill em conformidade com a LGPD. A adequação completa depende também das práticas da organização cliente (contratos com motoristas, políticas internas, DPO quando exigido, etc.). Em caso de dúvida jurídica específica, consulte um profissional de proteção de dados.`,
  },
];

export default function LgpdPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-16">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10"><Shield className="h-7 w-7 text-blue-600 dark:text-blue-400" /></div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Privacidade e LGPD</h1>
          <p className="text-sm text-muted-foreground">
            Lei nº 13.709/2018 — informações sobre o tratamento de dados no sistema.
          </p>
        </div>
      </div>

      {SECTIONS.map((section) => (
        <Card key={section.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{section.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {section.body}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
