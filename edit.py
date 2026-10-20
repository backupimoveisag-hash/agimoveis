from pathlib import Path
p=Path('/mnt/data/ag_v109/site-publico/index.html')
s=p.read_text()
reps={
'Imóveis para viver novas histórias em Jaraguá do Sul e região.':'Cada conquista merece um endereço especial. Encontre seu imóvel em Jaraguá do Sul e região.',
'Curadoria imobiliária':'Seu novo capítulo começa aqui',
'Comece pela intenção.':'O imóvel ideal para cada momento da sua vida.',
'Não precisa saber exatamente o que procura. Escolha um ponto de partida e refine conforme você explora.':'Para morar, investir ou começar uma nova história, descubra oportunidades alinhadas ao seu momento.',
'Encontre pelo lugar.':'O endereço certo transforma sua rotina.',
'Veja os bairros e cidades com imóveis publicados e entre direto nas opções daquela região.':'Explore imóveis em Jaraguá do Sul e região e encontre oportunidades perto de tudo o que importa para você.',
'CURADORIA ATUAL':'OPORTUNIDADES PARA VOCÊ',
'<h2>Imóveis disponíveis</h2>':'<h2>Encontre seu próximo imóvel.</h2>',
'Os últimos imóveis que você abriu ficam aqui para facilitar a comparação e a retomada da busca.':'Revisite os imóveis que chamaram sua atenção e encontre o lugar perfeito com tranquilidade.',
'Da busca até a chave.':'Do primeiro contato à entrega das chaves.',
'O site organiza a descoberta. Quando você quiser avançar, a equipe assume a jornada para reduzir fricção em visitas, proposta, documentação e fechamento.':'Uma boa experiência imobiliária começa com confiança. Oferecemos atendimento próximo e orientação em cada etapa para ajudar você a fazer uma escolha segura.',
'<b>Curadoria</b><span>Refinamos opções conforme sua necessidade.</span>':'<b>Entendemos você</b><span>Conhecemos suas preferências para identificar as oportunidades ideais.</span>',
'<b>Visita</b><span>Agende o melhor horário para conhecer o imóvel.</span>':'<b>Apresentamos possibilidades</b><span>Selecionamos imóveis e organizamos visitas para você conhecer cada detalhe.</span>',
'<b>Negociação</b><span>Apoio para proposta, contraproposta e condições.</span>':'<b>Conduzimos a negociação</b><span>Acompanhamos propostas e condições com clareza e transparência.</span>',
'<b>Fechamento</b><span>Organização documental até a conclusão do negócio.</span>':'<b>Acompanhamos a conclusão</b><span>Orientamos as etapas documentais até a entrega das chaves.</span>',
'Planeje o financiamento.':'Seu novo imóvel pode estar mais perto.',
'Faça uma estimativa inicial de parcela para entender a ordem de grandeza antes de conversar com a instituição financeira.':'Planejar a compra é o primeiro passo para realizar seu sonho. Simule uma estimativa de parcelas e conheça as possibilidades para seu orçamento.',
'CURADORIA PERSONALIZADA':'BUSCA PERSONALIZADA',
'Seu próximo imóvel pode estar fora da vitrine.':'O imóvel que você procura merece uma busca exclusiva.',
'Conte o que você procura e deixe a AG fazer a curadoria por você. Sua preferência é enviada ao CRM, direcionada para um corretor e o atendimento continua pelo WhatsApp.':'Conte o que é importante para você. Nossa equipe poderá selecionar imóveis conforme suas preferências, localização desejada e orçamento.',
'Enviar minha busca para um especialista →':'Quero encontrar meu imóvel →',
'UMA BUSCA MAIS HUMANA':'POR QUE ESCOLHER A AG',
'Escolher um imóvel não deveria parecer preencher uma planilha.':'Uma experiência imobiliária feita para você.',
'Organizamos a informação para você comparar, favoritar e entender cada opção sem perder o contexto. Quando fizer sentido, nosso atendimento entra para simplificar o próximo passo.':'Acreditamos que cada cliente tem uma história. Unimos atendimento personalizado, informações claras e tecnologia para tornar sua jornada mais prática e tranquila.',
'<strong>Curadoria</strong><span>carteira organizada</span>':'<strong>Atendimento</strong><span>feito para você</span>',
'<strong>Contexto</strong><span>informação essencial</span>':'<strong>Transparência</strong><span>em cada etapa</span>',
'<strong>Comparação</strong><span>lado a lado</span>':'<strong>Praticidade</strong><span>na busca</span>',
'<strong>Atendimento</strong><span>sem fricção</span>':'<strong>Confiança</strong><span>para decidir</span>',
'Antes de avançar.':'Suas dúvidas, nossas respostas.',
'Algumas respostas rápidas para tornar a busca e o contato mais transparentes.':'Encontre respostas sobre visitas, financiamento e escolha do imóvel ideal.',
'O catálogo é sincronizado com os imóveis marcados como publicados no CRM. Disponibilidade e condições podem mudar; confirme antes de formalizar proposta.':'As informações são atualizadas conforme os imóveis cadastrados. Valores, condições e disponibilidade podem mudar e devem ser confirmados com nossa equipe.',
'Sim. Abra qualquer imóvel e use “Agendar visita”. Você escolhe data e horário preferencial e o pedido é enviado organizado para o atendimento pelo WhatsApp.':'Sim. Escolha o imóvel e clique em “Agendar visita”. Informe o horário de preferência e nossa equipe entrará em contato para confirmar a disponibilidade.',
'Uma experiência imobiliária mais simples, clara e próxima.':'Mais do que imóveis, conexões que transformam histórias. Compra, venda e locação em Jaraguá do Sul e região.',
'Catálogo sincronizado com o CRM':'Jaraguá do Sul e região',
'Posso ajudar na sua busca?':'Vamos encontrar o imóvel ideal?',
'Responda 4 perguntas rápidas e eu direciono seu atendimento.':'Conte o que procura e descubra como podemos ajudar.',
'Falar com um especialista':'Falar com um corretor',
}
for old,new in reps.items():
 if old not in s: print('NOT FOUND',old[:75])
 s=s.replace(old,new)
about='''\n  <section class="ag-editorial-section shell" id="about">\n    <div class="ag-editorial-inner reveal">\n      <div class="eyebrow">NOSSA ESSÊNCIA · QUEM SOMOS</div>\n      <h2>Relações de confiança, escolhas que transformam.</h2>\n      <p>A AG Imobiliária nasceu com o propósito de oferecer uma experiência imobiliária mais próxima, transparente e personalizada. Sabemos que escolher um imóvel vai muito além de uma negociação: envolve conquistas, planejamento e novos começos.</p>\n      <p>Com atuação voltada a Jaraguá do Sul e região, buscamos compreender os objetivos de cada cliente e conectar pessoas a oportunidades de compra, venda e locação, com atenção aos detalhes e acompanhamento em cada etapa.</p>\n      <strong>Nosso compromisso é cuidar de cada negociação com a atenção que ela merece.</strong>\n    </div>\n  </section>\n  <section class="ag-editorial-section ag-editorial-owner shell" id="owners">\n    <div class="ag-editorial-inner reveal">\n      <div class="eyebrow">PARA PROPRIETÁRIOS</div>\n      <h2>Seu patrimônio merece atenção especial.</h2>\n      <p>Pensando em vender ou alugar seu imóvel? A AG Imobiliária conecta seu patrimônio às pessoas certas, com atenção à apresentação, divulgação e acompanhamento das oportunidades de negociação.</p>\n      <p>Converse com nossa equipe e descubra como podemos ajudar você a dar o próximo passo com tranquilidade.</p>\n      <a class="ag-owner-action" href="#preference">Conversar com a AG <span aria-hidden="true">→</span></a>\n    </div>\n  </section>\n'''
s=s.replace('  <section class="faq-section shell" id="faq">',about+'\n  <section class="faq-section shell" id="faq">')
s=s.replace('<div><h4>Região</h4>', '<div><h4>Sobre a AG</h4><a href="#about" style="display:block;padding:4px 0">Quem somos</a><a href="#owners" style="display:block;padding:4px 0">Anuncie seu imóvel</a>')
s=s.replace('</head>','<link rel="stylesheet" href="./css/13-ag-editorial-v109.css">\n</head>',1)
p.write_text(s)
css='''/* AG Imobiliária | Conteúdo institucional v109 */\n.ag-editorial-section{padding:84px 0 26px}\n.ag-editorial-inner{max-width:900px;margin:0 auto;padding:54px 62px;background:#f7f6f3;border:1px solid #e7e4dc;border-radius:20px}\n.ag-editorial-inner .eyebrow{color:#97783e;margin-bottom:18px}\n.ag-editorial-inner h2{font-size:clamp(31px,4vw,52px);line-height:1.13;letter-spacing:-.035em;color:#142339;margin:0 0 24px}\n.ag-editorial-inner p{font-size:16px;line-height:1.8;color:#4b5664;margin:0 0 15px}\n.ag-editorial-inner strong{display:block;margin-top:22px;font-size:16px;line-height:1.6;color:#142339}\n.ag-editorial-owner .ag-editorial-inner{background:#101e30;border-color:#24364d}\n.ag-editorial-owner h2,.ag-editorial-owner strong{color:#fff}\n.ag-editorial-owner p{color:#d6dce3}\n.ag-owner-action{display:inline-flex;margin-top:12px;padding:14px 23px;border-radius:9px;background:#cfb17d;color:#101e30;font-weight:700;text-decoration:none;gap:18px;align-items:center}\n@media(max-width:700px){.ag-editorial-section{padding:38px 15px 0}.ag-editorial-inner{padding:31px 23px;border-radius:15px}.ag-editorial-inner p{font-size:15px}.ag-editorial-inner h2{font-size:30px}}\n'''
Path('/mnt/data/ag_v109/site-publico/css/13-ag-editorial-v109.css').write_text(css)
print('html bytes',p.stat().st_size)
