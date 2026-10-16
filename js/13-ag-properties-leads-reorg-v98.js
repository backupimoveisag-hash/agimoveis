/* AG CRM V98 — Cadastro completo em Imóveis + Leads simplificados */
(function(){
  const baseOpenModal = openModal;
  const baseSaveModal = saveModal;

  function v98PropertyForm(data={}){
    const brokers=(db.users||[]).filter(u=>u.active).map(u=>u.name);
    const photoCount=Array.isArray(data.photos)?data.photos.length:0;
    return `<form id="modalForm" class="form-grid prospecting-grid v98-property-form">
      ${formDivider('Identificação do imóvel','Cadastro completo da captação e das informações comerciais.')}
      ${field('id','Código',data.id||`IM${String((db.properties||[]).length+1).padStart(3,'0')}`,'text','required')}
      ${field('title','Título do imóvel',data.title||data.propertyTitle||'','text','required')}
      ${selectField('type','Tipo de imóvel',['Casa','Apartamento','Terreno','Sítio/Chácara','Comercial','Rural','Outro'],data.type||data.propertyType||'Casa')}
      ${selectField('purpose','Finalidade',['Venda','Locação'],data.purpose||'Venda')}
      ${selectField('status','Status',['Disponível','Reservado','Vendido','Alugado','Inativo'],data.status||'Disponível')}
      ${field('price','Valor do imóvel',data.price||'','number','required min="0" step="0.01"')}
      ${field('address','Endereço',data.address||'','text','full required')}
      ${field('referencePoint','Ponto de referência',data.referencePoint||'','text','')}
      ${field('unit','BL/Unidade',data.unit||'','text','')}
      ${field('district','Bairro',data.district||'','text','')}
      ${field('city','Cidade',data.city||'','text','')}
      ${selectField('state','Estado / UF',['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'],data.state||'SC')}

      ${formDivider('Informações gerais')}
      ${selectField('constructionStatus','Situação do imóvel',['Pronto','Na planta'],data.constructionStatus||'Pronto')}
      ${selectField('locationProfile','Localização/uso',['Residencial','Comercial','Rural','Outro'],data.locationProfile||'Residencial')}
      ${field('entryValue','Valor de entrada',data.entryValue||'','number','min="0" step="0.01"')}
      ${field('debtBalance','Saldo devedor',data.debtBalance||'','number','min="0" step="0.01"')}
      ${field('condoFee','Taxa de condomínio',data.condoFee||data.condo||'','number','min="0" step="0.01"')}
      ${field('iptu','IPTU anual',data.iptu||'','number','min="0" step="0.01"')}
      ${field('floorNumber','Andar',data.floorNumber||data.floor||'','text','')}
      ${field('landArea','Área de terreno (m²)',data.landArea||'','number','min="0" step="0.01"')}
      ${field('builtArea','Área construída / privativa (m²)',data.builtArea||data.area||'','number','min="0" step="0.01"')}
      ${field('yearBuilt','Ano de construção',data.yearBuilt||data.year||'','number','min="0" step="1"')}
      ${field('builder','Construtora',data.builder||'','text','')}
      ${field('realEstateAgency','Imobiliária',data.realEstateAgency||'','text','')}
      ${field('garageCovered','Vagas cobertas',data.garageCovered||'','number','min="0" step="1"')}
      ${field('garageUncovered','Vagas descobertas',data.garageUncovered||'','number','min="0" step="1"')}
      ${field('garageIndependent','Vagas independentes',data.garageIndependent||'','number','min="0" step="1"')}
      ${field('beds','Quartos',data.beds??data.bedrooms??'','number','min="0" step="1"')}
      ${field('suites','Suítes',data.suites||'','number','min="0" step="1"')}
      ${field('baths','Banheiros',data.baths||'','number','min="0" step="1"')}

      ${checkboxGroup('statusFlag','Condição / características',['Pode ser financiado','Desocupado','Quitado','Blindex','Acrílico','PVC'],data)}
      ${checkboxGroup('rooms','Compartimentos',['Cozinha','Área de serviço','Escritório','Banheiro social','Estar/Jantar','Lavabo','Despensa','DCE','Varanda','Varanda gourmet','Piscina privativa'],data)}
      ${checkboxGroup('leisure','Área comum / lazer',['Churrasqueira','Playground','Salão de jogos','Coworking','Salão de festas','Pet place','Quadra','Elevador','Cerca elétrica','Bicicletário','Portão automático','Piscina','Academia','Brinquedoteca'],data)}
      ${checkboxGroup('planned','Móveis projetados / embutidos',['Suíte master','Cozinha','Quarto 1','Área de serviço','Quarto 2','Banheiro','Quarto 3','Varanda','Sala','Escritório'],data)}
      ${checkboxGroup('disclosure','Autorização de divulgação',['Redes sociais','Site da imobiliária','Placa','Pintura','Proprietário','Outro'],data)}
      ${selectField('painting','Pintura',['Nova','Regular','Boa','Deficiente'],data.painting||'Boa')}
      ${selectField('floorFinish','Piso',['Mármore','Granito','Cerâmica','Porcelanato','Madeira','Outro'],data.floorFinish||'Porcelanato')}
      ${field('keysInfo','Chaves do imóvel',data.keysInfo||'','text','')}
      ${field('broker','Responsável',data.broker||brokers[0]||'','text','')}
      ${field('created','Data da captação',data.created||todayISO(),'date')}
      <div class="form-group full"><label>Observações</label><textarea class="form-control" name="notes">${safe(data.notes||'')}</textarea></div>

      ${formDivider('Fotos do imóvel','Você pode selecionar várias fotos agora. Depois também poderá organizar a galeria e definir a capa na ficha do imóvel.')}
      <div class="form-group full v98-photo-field">
        <label>Fotos do imóvel</label>
        <input id="propertyInitialPhotos" class="form-control" type="file" accept="image/*" multiple>
        <small>${photoCount?`${photoCount} foto${photoCount===1?'':'s'} já cadastrada${photoCount===1?'':'s'}. As novas serão adicionadas à galeria com marca d’água AG automática.`:'Selecione uma ou mais imagens. A primeira será usada como capa e todas recebem a marca d’água AG automaticamente.'}</small>
      </div>

      ${formDivider('Dados do proprietário')}
      ${field('owner','Nome do proprietário',data.owner||data.ownerName||'','text','required')}
      ${field('ownerProfession','Profissão',data.ownerProfession||'','text','')}
      ${field('ownerAddress','Endereço do proprietário',data.ownerAddress||'','text','full')}
      ${field('ownerPhone1','Telefone 1',data.ownerPhone1||'','tel','required')}
      ${field('ownerPhone2','Telefone 2',data.ownerPhone2||'','tel','')}
      ${field('ownerEmail','E-mail',data.ownerEmail||'','email','')}
      ${field('ownerRg','RG',data.ownerRg||'','text','')}
      ${field('ownerCpf','CPF',data.ownerCpf||'','text','')}
      ${field('ownerCivilStatus','Estado civil',data.ownerCivilStatus||'','text','')}
      ${field('spouseName','Nome do cônjuge',data.spouseName||'','text','')}
      ${field('spouseProfession','Profissão do cônjuge',data.spouseProfession||'','text','')}
      ${field('spouseRg','RG do cônjuge',data.spouseRg||'','text','')}
      ${field('spouseCpf','CPF do cônjuge',data.spouseCpf||'','text','')}
      ${field('spousePhone1','Telefone do cônjuge',data.spousePhone1||'','tel','')}

      ${formDivider('Comercial e publicação')}
      ${selectField('exclusiveSale','Venda com exclusividade',['Não','Sim'],data.exclusiveSale||'Não')}
      ${field('commission','Percentual de comissão',data.commission||'5','number','min="0" step="0.01"')}
      ${selectField('featured','Imóvel em destaque',['Não','Sim'],data.featured?'Sim':'Não')}
      ${selectField('published','Publicar no site',['Sim','Não'],data.published===false?'Não':'Sim')}
      <div class="form-group full"><label>Diferenciais <small style="font-weight:500;color:var(--muted)">separe por vírgula</small></label><input class="form-control" name="amenities" value="${safe(data.amenities||'')}" placeholder="Piscina, varanda gourmet, elevador..."></div>
      <div class="form-group full"><label>Observações complementares</label><textarea class="form-control" name="extraObs">${safe(data.extraObs||'')}</textarea></div>
    </form>`;
  }

  function v98LeadForm(data={}){
    return `<form id="modalForm" class="form-grid v98-lead-form">
      ${field('name','Nome',data.name||'','text','required')}
      ${field('phone','Telefone / WhatsApp',data.phone||'','tel','required')}
      ${field('email','E-mail',data.email||'','email','required')}
      ${selectField('interest','Interesse',[
        'Quero comprar um imóvel',
        'Quero alugar um imóvel',
        'Tenho imóvel para vender',
        'Tenho imóvel para alugar'
      ],data.interest||'Quero comprar um imóvel',true)}
    </form>`;
  }

  openModal=function(type,data={}){
    if(type==='prospecting') type='property';
    if(type==='quick'){
      editing={type:null,id:null};
      const body=`<div class="grid v98-quick-grid" style="grid-template-columns:repeat(2,1fr)">
        <button class="card" type="button" onclick="openModal('lead')">◎<br><b>Novo contato</b></button>
        <button class="card" type="button" onclick="openModal('property')">⌂<br><b>Novo imóvel</b></button>
        <button class="card" type="button" onclick="openModal('client')">♙<br><b>Novo cliente</b></button>
        <button class="card" type="button" onclick="openModal('appointment')">□<br><b>Compromisso</b></button>
      </div>`;
      showModal('Criar novo',body,'');
      return;
    }
    if(type==='property'){
      editing={type:'property',id:data.id||null};
      showModal(data.id?'Editar imóvel':'Cadastrar imóvel',v98PropertyForm(data),data.id?'Salvar alterações':'Cadastrar imóvel');
      return;
    }
    if(type==='lead'){
      editing={type:'lead',id:data.id||null};
      showModal(data.id?'Editar contato':'Novo contato',v98LeadForm(data),data.id?'Salvar alterações':'Salvar contato');
      return;
    }
    return baseOpenModal(type,data);
  };

  saveModal=async function(){
    if(editing.type==='lead'){
      const form=$('#modalForm');if(!form?.reportValidity())return;
      const fd=Object.fromEntries(new FormData(form).entries());
      const current=editing.id?(db.leads||[]).find(x=>x.id===editing.id):null;
      const record={
        ...(current||{}),
        ...fd,
        id:current?.id||('L'+uid().slice(-6).toUpperCase()),
        source:current?.source||'Cadastro manual',
        stage:current?.stage||'Novo',
        broker:current?.broker||(db.users||[]).find(u=>u.active)?.name||'',
        value:Number(current?.value||0),
        temp:current?.temp||'Morno',
        created:current?.created||todayISO()
      };
      if(current){const i=db.leads.findIndex(x=>x.id===current.id);db.leads[i]=record}else db.leads.push(record);
      pushActivity('◎',current?'Contato atualizado':'Novo contato',`${record.name} · ${record.interest}`);
      closeModal();
      try{saveDB();toast('Contato salvo com sucesso.')}catch(e){console.error(e);toast('Não foi possível salvar o contato.')}
      return;
    }

    if(editing.type==='property'){
      const form=$('#modalForm');if(!form?.reportValidity())return;
      const raw=new FormData(form),fd={};
      for(const [k,v] of raw.entries()){if(!(v instanceof File))fd[k]=v}
      form.querySelectorAll('input[type="checkbox"][name]').forEach(ch=>{fd[ch.name]=ch.checked?'on':''});
      const numeric=['price','entryValue','debtBalance','condoFee','iptu','landArea','builtArea','yearBuilt','garageCovered','garageUncovered','garageIndependent','beds','suites','baths','commission'];
      numeric.forEach(k=>{fd[k]=fd[k]===''?0:Number(fd[k]||0)});
      fd.area=Number(fd.builtArea||0);
      fd.year=Number(fd.yearBuilt||0);
      fd.floor=fd.floorNumber||'';
      fd.condo=Number(fd.condoFee||0);
      fd.bedrooms=Number(fd.beds||0);
      fd.parking=Number(fd.garageCovered||0)+Number(fd.garageUncovered||0)+Number(fd.garageIndependent||0);
      fd.featured=fd.featured==='Sim';
      fd.siteFeatured=fd.featured;
      fd.published=fd.published!=='Não';
      fd.ownerName=fd.owner;
      fd.propertyTitle=fd.title;
      fd.propertyType=fd.type;

      const oldId=editing.id;
      const current=oldId?(db.properties||[]).find(x=>x.id===oldId):null;
      if(!current && (db.properties||[]).some(x=>x.id===fd.id)){toast('Já existe um imóvel com este código.');return}
      const files=[...($('#propertyInitialPhotos')?.files||[])];
      let additions=[];
      if(files.length){
        const saveBtn=$('#modalSave');if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='Processando fotos…'}
        try{
          for(const file of files){
            const src=await compressPropertyImage(file);
            additions.push({id:'PH'+uid().slice(-8).toUpperCase(),room:'Capa',src,name:file.name.replace(/\.[^.]+$/,''),created:todayISO(),watermarked:true,watermark:'AG'});
          }
        }catch(e){console.error(e);toast('Não foi possível processar uma das fotos.');if(saveBtn){saveBtn.disabled=false;saveBtn.textContent=current?'Salvar alterações':'Cadastrar imóvel'}return}
      }

      const record={...(current||{}),...fd};
      record.photos=[...(current?.photos||[]),...additions];
      if(!record.photos.length){
        record.photos=[{id:'PH'+uid().slice(-8).toUpperCase(),room:'Capa',src:v5FallbackPropertyImage(record),name:'Imagem principal',created:todayISO()}];
      }
      if(!record.coverPhoto || !record.photos.some(x=>x.id===record.coverPhoto))record.coverPhoto=record.photos[0]?.id||'';
      if(current){const i=db.properties.findIndex(x=>x.id===oldId);db.properties[i]=record}else db.properties.push(record);

      pushActivity('⌂',current?'Imóvel atualizado':'Novo imóvel cadastrado',`${record.id} · ${record.title}`);
      closeModal();
      try{
        saveDB();
        toast(files.length?`Imóvel salvo com ${files.length} ${files.length===1?'foto':'fotos'}.`:'Imóvel salvo com sucesso.');
        if(files.length) setTimeout(()=>openPropertyDetails(record.id,'gallery',additions[0]?.id),120);
      }catch(e){console.error(e);toast('Os dados ou fotos excederam o espaço disponível no navegador.')}
      return;
    }
    return baseSaveModal();
  };

  renderLeads=function(){
    const q=$('#leadSearch')?.value.toLowerCase()||'';
    const interest=$('#leadSourceFilter')?.value||'';
    const list=(db.leads||[]).filter(l=>(!q||[l.name,l.phone,l.email,l.interest].join(' ').toLowerCase().includes(q))&&(!interest||l.interest===interest));
    const tbody=$('#leadTable');if(!tbody)return;
    tbody.innerHTML=list.map(l=>`<tr>
      <td><div class="row-avatar"><div class="avatar">${initials(l.name)}</div><div><b>${safe(l.name)}</b><small>${fmtPhone(l.phone)}</small></div></div></td>
      <td>${safe(l.email||'—')}</td>
      <td><b class="v98-interest">${safe(l.interest||'—')}</b></td>
      <td><div class="actions">${l.phone?`<button class="btn small primary" onclick="openLeadWhatsApp('${l.id}')">WhatsApp</button>`:''}<button class="btn small" onclick="editItem('lead','${l.id}')">Editar</button><button class="btn small danger" onclick="deleteItem('lead','${l.id}')">Excluir</button></div></td>
    </tr>`).join('')||'<tr><td colspan="4" class="empty">Nenhum contato encontrado.</td></tr>';
  };

  // Redesenha a listagem caso esta camada seja carregada após o primeiro render.
  try{renderLeads()}catch(e){}
})();
