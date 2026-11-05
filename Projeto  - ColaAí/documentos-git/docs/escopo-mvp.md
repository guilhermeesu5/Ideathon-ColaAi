# Escopo do MVP

Este documento define o que a primeira versão do ColaAí entrega e o que ficou de fora de propósito.

## O que entra

### 1. Autenticação institucional

Cadastro e login restritos a e-mails institucionais, para formar um "condomínio fechado" e seguro de estudantes.

- Domínios aceitos: `@aluno.cps.sp.gov.br` e `@fatec.sp.gov.br`.
- Qualquer outro e-mail é recusado, com uma mensagem clara no próprio campo.
- No cadastro, a pessoa escolhe o perfil: **quero carona** (passageiro) ou **tenho carro** (motorista). Quem tem carro informa o modelo e quantas vagas oferece.

### 2. Cadastro e busca de rotas (hubs)

Tela em que o usuário, como passageiro ou motorista, informa:

- o **hub** de origem ou destino (nesta versão, somente a **FATEC**);
- o **horário**, que corresponde ao turno de estudo (manhã, tarde ou noite).

### 3. Mecanismo de match

Filtro lógico no servidor que cruza as ofertas e as demandas de carona que têm o **mesmo hub e o mesmo horário**. O resultado mostra o perfil do colega para confirmação.

### Rateio de custos

O custo é dividido entre os colegas, de forma independente (por exemplo, via Pix). A plataforma só ajuda com uma **estimativa** do valor por pessoa.

## O que ficou fora (limitações intencionais)

| Item | Motivo |
| --- | --- |
| Rastreamento GPS em tempo real e mapas interativos | Evita custos com APIs de terceiros |
| Processamento e retenção de pagamentos dentro do app (gateway) | A divisão do custo é feita direto entre os usuários |
| Validação automática de CNH e checagem de antecedentes | Os dados são simulados no escopo do Ideathon |
| Cálculo dinâmico de desvios e rotas porta a porta | O foco são pontos fixos de encontro |

## Próximas etapas previstas

- Ativar os hubs **Centro** e **Shopping**, que já estão previstos na interface como "em breve".
- Publicar a aplicação neste repositório.

## Critérios de qualidade

- Interface totalmente responsiva e leve, rodando no navegador do celular ou do computador.
- Foco rigoroso em usabilidade e acessibilidade.
