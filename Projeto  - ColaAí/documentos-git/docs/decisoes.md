# Decisões do projeto

Registro das escolhas feitas até aqui, com o motivo de cada uma.

## 1. Somente o hub da FATEC na primeira versão

- **Decisão:** apenas o hub FATEC fica ativo. Centro e Shopping aparecem como "em breve".
- **Motivo:** reduzir o escopo para entregar um fluxo completo e testável.

## 2. Rateio feito entre os usuários, sem taxa

- **Decisão:** a plataforma não processa nem retém pagamentos. Ela só mostra uma estimativa do valor por pessoa.
- **Motivo:** evita custos e responsabilidades de um gateway de pagamento e mantém o serviço gratuito para os alunos.

## 3. Cadastro restrito a e-mail institucional

- **Decisão:** apenas `@aluno.cps.sp.gov.br` e `@fatec.sp.gov.br`.
- **Motivo:** cria uma comunidade fechada, mais segura e com identidade acadêmica.

## 4. Front-end em HTML, CSS e JavaScript puros

- **Decisão:** sem frameworks de interface.
- **Motivo:** página leve, que roda no navegador do celular ou do computador, sem instalação, e fácil de manter por quem está aprendendo.

## 5. Mapa dos hubs sem custo de API

- **Decisão:** o protótipo exibe um mapa real de Araçatuba com os hubs, usando mapas abertos do OpenStreetMap, sem chave de API e sem GPS em tempo real.
- **Motivo:** o escopo evita custos com APIs de terceiros, e o mapa serve só para mostrar onde ficam os pontos de encontro.
- **Atenção:** o traçado da rota no protótipo usa um serviço público de demonstração, adequado só para testes. Em produção, será preciso uma solução própria ou contratada.

## 6. Sentido da viagem (ida e volta)

- **Decisão:** além de hub e turno, o match considera o sentido da viagem.
- **Motivo:** quem vai para a FATEC e quem sai dela têm horários diferentes e não devem ser cruzados.

## 7. Dados simulados no protótipo

- **Decisão:** perfis, caronas, CNH e números de impacto são fictícios.
- **Motivo:** o protótipo valida o design e o fluxo. A verificação real de CNH e antecedentes está fora do escopo desta versão.
