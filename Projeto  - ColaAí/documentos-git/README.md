# ColaAí

Plataforma web de **caronas colaborativas** para estudantes da **FATEC Araçatuba**.

O ColaAí reúne quem vai para a faculdade no mesmo turno, com ponto de encontro fixo e custo dividido entre os colegas. O objetivo é reduzir o custo do deslocamento, tirar carros ocupados só pelo motorista das ruas e fortalecer a comunidade acadêmica.

> **Status:** em desenvolvimento (projeto do Ideathon). Este repositório reúne, por enquanto, a **documentação**. O código da aplicação ainda não foi publicado aqui.

## O problema

- O custo de aplicativos de transporte privado pesa no orçamento de quem vai todos os dias à faculdade.
- Muitos carros circulam com assentos vazios (só o motorista), o que sobrecarrega o trânsito e o estacionamento no entorno da FATEC.
- O transporte público municipal tem pouca previsibilidade.

## A solução

- **Comunidade fechada:** o cadastro só aceita e-mails institucionais (`@aluno.cps.sp.gov.br` e `@fatec.sp.gov.br`).
- **Hubs de encontro:** rotas com pontos fixos (Centro, Shopping e FATEC), sem desvios longos. Nesta primeira versão, só a **FATEC** está ativa.
- **Rateio amigável:** os colegas dividem o custo entre si (por exemplo, via Pix). A plataforma **não cobra taxa** e não processa pagamentos.

## Como funciona

1. **Entrar:** o aluno ou professor cria a conta com o e-mail institucional e escolhe se quer carona ou se tem carro.
2. **Informar a viagem:** escolhe o hub, o sentido (ida ou volta) e o turno de estudo.
3. **Combinar:** a plataforma mostra os colegas compatíveis (mesmo hub e horário), e os dois confirmam a carona.

## Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Interface | HTML, CSS e JavaScript puros, responsivos, sem app de loja |
| Regras de negócio e API | Node.js |
| Banco de dados | MySQL |

## Documentação

| Documento | O que contém |
| --- | --- |
| [Escopo do MVP](docs/escopo-mvp.md) | O que entra na primeira versão e o que ficou de fora |
| [Arquitetura](docs/arquitetura.md) | Camadas, regras de negócio, fluxo do match e rascunho do modelo de dados |
| [Impacto e sustentabilidade](docs/impacto-sustentabilidade.md) | Benefícios ambientais e sociais e as premissas das estimativas |
| [Identidade visual](docs/identidade-visual.md) | Cores, tipografia e princípios da interface |
| [Decisões do projeto](docs/decisoes.md) | Escolhas feitas até aqui e o motivo de cada uma |
