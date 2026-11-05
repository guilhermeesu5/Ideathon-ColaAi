# Impacto ambiental e social

## Ambiental

O ColaAí quer reduzir a quantidade de carros com um único ocupante nas ruas de Araçatuba. Menos carros circulando para o mesmo destino significa **menor emissão de gases de efeito estufa (CO₂)** e menos pressão sobre o trânsito e o estacionamento no entorno da FATEC.

## Social

- **Economia direta** para os alunos, que dividem o custo do deslocamento em vez de pagar sozinhos por aplicativos de transporte.
- **Mais pontualidade** nas aulas, com um combinado de horário e ponto de encontro.
- **Comunidade acadêmica mais forte**, porque o acesso é restrito a quem tem e-mail institucional e as caronas acontecem entre colegas.

## Estimativas usadas no protótipo

Os números mostrados no protótipo são **ilustrativos** e partem de premissas simples. Elas precisam ser validadas antes de qualquer divulgação.

| Premissa | Valor no protótipo |
| --- | --- |
| Consumo médio do carro | 11 km por litro |
| Preço do combustível | R$ 6,30 por litro |
| Emissão evitada por carona | 1,9 kg de CO₂ |
| Meta mensal de caronas | 20 caronas |

**Rateio por pessoa:**

```
custo da viagem = (distância em km ÷ consumo) × preço do litro
valor por pessoa = custo da viagem ÷ (número de passageiros + 1)
```

O "+ 1" representa o motorista, que também divide o custo.

**Emissão evitada:** o valor de 1,9 kg corresponde, de forma aproximada, a uma viagem de 8 km de ida e volta com emissão de cerca de 0,12 kg de CO₂ por km.

> Os números de caronas e de CO₂ exibidos no protótipo (por exemplo, "12 caronas no mês") são dados simulados e não representam uso real.
