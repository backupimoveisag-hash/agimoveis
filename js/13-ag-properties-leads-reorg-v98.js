/* AG CRM V98 — Cadastro completo em Imóveis + Leads simplificados */
(function(){
  const baseOpenModal = openModal;
  const baseSaveModal = saveModal;

  // Incremental code independent of the length of the property list (which may have gaps).
  function nextPropertyCode(){
    const used=new Set((db.properties||[]).map(p=>String(p.id||'').trim().toUpperCase()));
    const next=1+Math.max(0,...[...used].map(code=>/^IM\d+$/.test(code)?Number(code.slice(2)):0));
    let candidate=next;
    while(used.has(`IM${String(candidate).padStart(3,'0')}`))candidate++;
    return `IM${String(candidate).padStart(3,'0')}`;
  }

  function normalizePropertyText(value){
    return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  }

  // V115 — invariant: property code is unique across the CRM state.
  function normalizedPropertyCode(value){
    return String(value||'').trim().toUpperCase();
  }
  function propertyCompletenessScore(p){
    if(!p||typeof p!=='object')return 0;
    let score=0;
    for(const [k,v] of Object.entries(p)){
      if(k==='photos'&&Array.isArray(v)){score+=v.length*8;continue}
      if(Array.isArray(v)){score+=v.length;continue}
      if(v!==null&&v!==undefined&&String(v).trim()!=='')score++;
    }
    return score;
  }
  function propertyUpdatedAtMs(p){
    const raw=p?.updatedAt||p?.modifiedAt||p?.lastModified||'';
    const ms=Date.parse(raw);
    return Number.isFinite(ms)?ms:0;
  }
  function mergeDuplicatePropertyRecords(a,b){
    // V135: the newest edited record must always win. Completeness is used only
    // for legacy records that do not have an update timestamp.
    const aTime=propertyUpdatedAtMs(a),bTime=propertyUpdatedAtMs(b);
    const primary=aTime!==bTime?(bTime>aTime?b:a):(propertyCompletenessScore(a)>=propertyCompletenessScore(b)?a:b);
    const secondary=primary===a?b:a;
    const merged={...secondary,...primary};
    const photos=[...(secondary?.photos||[]),...(primary?.photos||[])];
    const seenPhotos=new Set();
    merged.photos=photos.filter(ph=>{
      const key=String(ph?.id||ph?.driveFileId||ph?.src||'');
      if(!key)return true;
      if(seenPhotos.has(key))return false;
      seenPhotos.add(key);return true;
    });
    if(!merged.coverPhoto||!merged.photos.some(ph=>String(ph.id)===String(merged.coverPhoto)))merged.coverPhoto=merged.photos[0]?.id||'';
    return merged;
  }
  function dedupePropertiesByCode(list=db.properties||[]){
    const out=[],indexByCode=new Map();
    for(const item of (Array.isArray(list)?list:[])){
      const code=normalizedPropertyCode(item?.id);
      if(!code){out.push(item);continue}
      if(!indexByCode.has(code)){indexByCode.set(code,out.length);out.push(item);continue}
      const idx=indexByCode.get(code);
      out[idx]=mergeDuplicatePropertyRecords(out[idx],item);
    }
    return out;
  }
  function enforceUniqueProperties(){
    const before=Array.isArray(db.properties)?db.properties.length:0;
    db.properties=dedupePropertiesByCode(db.properties||[]);
    return before-db.properties.length;
  }

  function propertyDuplicate(candidate,editingId){
    const code=normalizePropertyText(candidate.id);
    const address=normalizePropertyText(candidate.address);
    const unit=normalizePropertyText(candidate.unit);
    const title=normalizePropertyText(candidate.title);
    const owner=normalizePropertyText(candidate.owner);
    const ownerPhone=String(candidate.ownerPhone1||'').replace(/\D/g,'');
    const ownerCpf=String(candidate.ownerCpf||'').replace(/\D/g,'');
    return (db.properties||[]).find(other=>{
      if(editingId && String(other.id)===String(editingId))return false;
      if(code && code===normalizePropertyText(other.id))return true;
      if(!address || address!==normalizePropertyText(other.address) || unit!==normalizePropertyText(other.unit))return false;
      if(normalizePropertyText(candidate.type)!==normalizePropertyText(other.type) ||
         normalizePropertyText(candidate.purpose)!==normalizePropertyText(other.purpose))return false;
      const sameOwner=owner && owner===normalizePropertyText(other.owner);
      const sameCpf=ownerCpf && ownerCpf===String(other.ownerCpf||'').replace(/\D/g,'');
      const samePhone=ownerPhone && ownerPhone===String(other.ownerPhone1||'').replace(/\D/g,'');
      const sameTitle=title && title===normalizePropertyText(other.title);
      return Boolean(sameOwner || sameCpf || samePhone || sameTitle);
    })||null;
  }

  function currentPropertyProfile(){
    try{
      const p=window.EIFirebaseCRM?.getProfile?.();
      if(p)return p;
      return JSON.parse(localStorage.getItem('nexoSessionV1')||'null')||null;
    }catch(e){return null}
  }

  let propertyBrokerDirectoryCache={at:0,users:[]};
  function normalizeBrokerRole(v){
    return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  }
  function isPropertyBrokerUser(u){
    const role=normalizeBrokerRole(u?.role);
    return !!(u&&u.active!==false&&role.includes('corretor')&&String(u.name||'').trim());
  }
  function propertyBrokerUsersFromLocal(){
    const list=Array.isArray(db.users)?db.users:[];
    return list.filter(isPropertyBrokerUser);
  }
  function currentProfileIsAdmin(profile=currentPropertyProfile()){
    return normalizeBrokerRole(profile?.role).includes('administrador');
  }
  async function loadPropertyBrokerDirectory(force=false){
    const profile=currentPropertyProfile();
    if(!currentProfileIsAdmin(profile))return profile?[{uid:profile.uid||profile.firebaseUid||'',name:profile.name||'',email:profile.email||'',role:profile.role,active:profile.active!==false}]:[];
    const now=Date.now();
    if(!force&&propertyBrokerDirectoryCache.users.length&&now-propertyBrokerDirectoryCache.at<5*60*1000)return propertyBrokerDirectoryCache.users;
    let users=[];
    try{
      // Fonte principal: usuários cadastrados no CRM/Firebase. A leitura ocorre
      // somente quando o Administrador abre o cadastro/edição do imóvel.
      const remote=await window.EIFirebaseCRM?.listUsers?.();
      if(Array.isArray(remote))users=remote;
    }catch(e){console.warn('AG CRM: não foi possível carregar o diretório de corretores do sistema.',e)}
    if(!users.length)users=propertyBrokerUsersFromLocal();
    users=(users||[]).filter(isPropertyBrokerUser);
    const seen=new Set();
    users=users.filter(u=>{
      const k=String(u.uid||u.firebaseUid||u.id||u.email||u.name).trim().toLowerCase();
      if(!k||seen.has(k))return false;
      seen.add(k);return true;
    }).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR'));
    propertyBrokerDirectoryCache={at:now,users};
    return users;
  }
  function brokerOption(u,selected=''){
    const name=String(u?.name||'').trim();
    const uid=String(u?.uid||u?.firebaseUid||u?.id||'').trim();
    const email=String(u?.email||'').trim().toLowerCase();
    const selectedUid=String(selected?.uid||'').trim();
    const selectedEmail=String(selected?.email||'').trim().toLowerCase();
    const selectedName=String(selected?.name||selected||'').trim();
    const isSelected=(selectedUid&&uid===selectedUid)||(selectedEmail&&email===selectedEmail)||(!selectedUid&&!selectedEmail&&name===selectedName);
    const label=email?`${name} · ${email}`:name;
    return `<option value="${safe(name)}" data-uid="${safe(uid)}" data-email="${safe(email)}" ${isSelected?'selected':''}>${safe(label)}</option>`;
  }
  function propertyBrokerField(data={}){
    const profile=currentPropertyProfile();
    const isAdmin=currentProfileIsAdmin(profile);
    const currentName=String(profile?.name||'').trim();
    const selected={name:String(data.brokerName||data.responsibleBroker||data.broker||(!data.id&&!isAdmin?currentName:'')||'').trim(),uid:String(data.brokerUid||data.responsibleBrokerUid||'').trim(),email:String(data.brokerEmail||data.responsibleBrokerEmail||'').trim().toLowerCase()};
    if(isAdmin){
      return `<div class="form-group full ag-property-broker-field"><label>Corretor responsável pela captação</label><input class="form-control" type="search" id="propertyBrokerSearch" placeholder="Buscar corretor por nome ou e-mail" autocomplete="off" autocapitalize="off" spellcheck="false"><select class="form-control" id="propertyBrokerSelect" name="broker" required><option value="">Carregando corretores cadastrados no sistema…</option></select><input type="hidden" name="brokerUid" id="propertyBrokerUid" value="${safe(selected.uid)}"><input type="hidden" name="brokerEmail" id="propertyBrokerEmail" value="${safe(selected.email)}"><small class="muted-note" id="propertyBrokerDirectoryNote">Buscando usuários ativos com perfil Corretor/Corretora cadastrados no CRM.</small></div>`;
    }
    const locked=selected.name||currentName;
    return `<div class="form-group full ag-property-broker-field"><label>Corretor responsável pela captação</label><input type="hidden" name="broker" value="${safe(locked)}"><input type="hidden" name="brokerUid" value="${safe(profile?.uid||profile?.firebaseUid||selected.uid||'')}"><input type="hidden" name="brokerEmail" value="${safe(profile?.email||selected.email||'')}"><input class="form-control" value="${safe(locked)}" readonly aria-label="Corretor responsável pela captação"><small class="muted-note">Preenchido automaticamente com o corretor autenticado.</small></div>`;
  }
  function syncBrokerHiddenFields(){
    const sel=document.getElementById('propertyBrokerSelect');if(!sel)return;
    const opt=sel.options[sel.selectedIndex];
    const uid=document.getElementById('propertyBrokerUid'),email=document.getElementById('propertyBrokerEmail');
    if(uid)uid.value=opt?.dataset?.uid||'';
    if(email)email.value=opt?.dataset?.email||'';
  }
  async function hydratePropertyBrokerField(data={}){
    const profile=currentPropertyProfile();
    if(!currentProfileIsAdmin(profile))return;
    const sel=document.getElementById('propertyBrokerSelect');if(!sel)return;
    const search=document.getElementById('propertyBrokerSearch');
    const note=document.getElementById('propertyBrokerDirectoryNote');
    const selected={name:String(data.brokerName||data.responsibleBroker||data.broker||'').trim(),uid:String(data.brokerUid||data.responsibleBrokerUid||'').trim(),email:String(data.brokerEmail||data.responsibleBrokerEmail||'').trim().toLowerCase()};
    const users=await loadPropertyBrokerDirectory(true);
    if(!document.body.contains(sel))return;
    const render=(q='')=>{
      const needle=String(q||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
      const filtered=!needle?users:users.filter(u=>{
        const hay=`${u.name||''} ${u.email||''}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
        return hay.includes(needle);
      });
      sel.innerHTML='<option value="">Selecione o corretor responsável</option>'+filtered.map(u=>brokerOption(u,selected)).join('');
      if(selected.name&&!users.some(u=>String(u.name||'').trim()===selected.name||String(u.uid||u.firebaseUid||u.id||'').trim()===selected.uid||String(u.email||'').trim().toLowerCase()===selected.email)){
        const o=document.createElement('option');o.value=selected.name;o.textContent=`${selected.name} · vínculo anterior`;o.dataset.uid=selected.uid;o.dataset.email=selected.email;o.selected=true;sel.appendChild(o);
      }
      if(!sel.value&&users.length===1&&!needle)sel.value=String(users[0].name||'');
      syncBrokerHiddenFields();
      if(note)note.textContent=users.length?`${users.length} corretor${users.length===1?'':'es'} ativo${users.length===1?'':'s'} encontrado${users.length===1?'':'s'} no sistema.`:'Nenhum usuário ativo com perfil Corretor/Corretora foi encontrado em Ajustes → Usuários e permissões.';
    };
    render('');
    search?.addEventListener('input',()=>render(search.value));
    sel.addEventListener('change',syncBrokerHiddenFields,{passive:true});
  }

  function v98PropertyForm(data={}){
    const photoCount=Array.isArray(data.photos)?data.photos.length:0;
    return `<form id="modalForm" class="form-grid prospecting-grid v98-property-form">
      ${formDivider('Identificação do imóvel','Cadastro completo da captação e das informações comerciais.')}
      ${field('id','Código',data.id||nextPropertyCode(),'text','required')}
      ${field('title','Título do imóvel',data.title||data.propertyTitle||'','text','required')}
      ${selectField('type','Tipo de imóvel',['Casa','Apartamento','Terreno','Sítio/Chácara','Comercial','Rural','Outro'],data.type||data.propertyType||'Casa')}
      ${selectField('purpose','Finalidade',['Venda','Locação'],data.purpose||'Venda')}
      ${selectField('status','Status',['Disponível','Reservado','Vendido','Alugado','Inativo'],data.status||'Disponível')}
      ${propertyBrokerField(data)}
      ${selectField('priceDisplay','Preço no site',['Exibir preço','Conversar com Corretor'],data.priceDisplay||(data.hidePrice?'Conversar com Corretor':'Exibir preço'))}
      ${field('price','Valor do imóvel (interno)',data.price||'','number','min="0" step="0.01"')}
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
      ${selectField('canalProPublished','Publicar no Canal Pro',['Não','Sim'],data.canalProPublished===true?'Sim':'Não')}
      ${selectField('canalProTier','Plano do anúncio Canal Pro',['STANDARD','PREMIUM','SUPER_PREMIUM'],data.canalProTier||'STANDARD')}
      ${selectField('canalProType','Tipo VRSync (se necessário)',['Automático','Residential / Apartment','Residential / Home','Residential / Condo','Residential / Farm Ranch','Residential / Agricultural','Residential / Land Lot','Commercial / Building','Commercial / Office','Commercial / Land Lot','Commercial / Industrial','Commercial / Business'],data.canalProType||'Automático')}
      <div class="form-group full"><label>Descrição pública para o Canal Pro <small style="font-weight:500;color:var(--muted)">somente dados do imóvel; não inclua informações do proprietário (50–3.000 caracteres)</small></label><textarea class="form-control" name="canalProDescription" rows="5" maxlength="3000" placeholder="Descreva os atributos, a localização e os diferenciais do imóvel para os portais.">${safe(data.canalProDescription||'')}</textarea></div>
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
      setTimeout(()=>hydratePropertyBrokerField(data),0);
      return;
    }
    if(type==='lead'){
      editing={type:'lead',id:data.id||null};
      showModal(data.id?'Editar contato':'Novo contato',v98LeadForm(data),data.id?'Salvar alterações':'Salvar contato');
      return;
    }
    return baseOpenModal(type,data);
  };

  let propertySavePending=false;
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
        broker:current?.broker||window.EIFirebaseCRM?.getProfile?.()?.name||window.EIFirebaseCRM?.getAuthUser?.()?.displayName||'',
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
      const form=$('#modalForm');
      if(!form?.reportValidity())return;
      // Guard before any await (image compression/Drive upload). In V109 the button
      // was not disabled and two clicks could insert the same property twice.
      if(propertySavePending || form.dataset.agSaving==='1')return;
      const oldId=editing.id;
      // V144: sincroniza explicitamente o corretor selecionado antes de ler o formulário.
      // Isso evita que UID/e-mail fiquem atualizados enquanto o nome do responsável não seja persistido.
      try{syncBrokerHiddenFields()}catch(e){}
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
      fd.priceDisplay=fd.priceDisplay==='Conversar com Corretor'?'Conversar com Corretor':'Exibir preço';
      fd.hidePrice=fd.priceDisplay==='Conversar com Corretor';
      fd.published=fd.published!=='Não';
      fd.canalProPublished=fd.canalProPublished==='Sim';
      fd.ownerName=fd.owner;
      fd.propertyTitle=fd.title;
      fd.propertyType=fd.type;
      // V144: identidade canônica do corretor responsável pela captação.
      fd.broker=String(fd.broker||'').trim();
      fd.brokerName=fd.broker;
      fd.responsibleBroker=fd.broker;
      fd.brokerUid=String(fd.brokerUid||'').trim();
      fd.brokerEmail=String(fd.brokerEmail||'').trim().toLowerCase();

      if(oldId && !(db.properties||[]).some(x=>x.id===oldId)){
        toast('Imóvel original não encontrado. Atualize a lista antes de editar.');
        return;
      }
      const duplicate=propertyDuplicate(fd,oldId);
      if(duplicate){
        toast(`Cadastro já existente (${duplicate.id}). Abra a ficha para editar, em vez de cadastrar novamente.`);
        return;
      }

      propertySavePending=true;
      form.dataset.agSaving='1';
      const saveBtn=$('#modalSave')||form.closest('#modal')?.querySelector('.modal-foot .btn.primary');
      const initialButtonText=saveBtn?.textContent||'Cadastrar imóvel';
      if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='Salvando imóvel…'}
      try{
        const files=[...($('#propertyInitialPhotos')?.files||[])];
        const additions=[];
        if(files.length){
          if(!window.AGDriveGateway?.configured?.())throw new Error('Configure o Google Drive via Apps Script em Ajustes antes de enviar fotos.');
          for(const file of files){
            if(saveBtn)saveBtn.textContent=`Enviando fotos (${additions.length+1}/${files.length})…`;
            const processed=await compressPropertyImage(file);
            const stored=await window.AGDriveGateway.uploadImageData(processed,{propertyId:fd.id,fileName:file.name,room:'Capa'});
            additions.push({id:'PH'+uid().slice(-8).toUpperCase(),room:'Capa',src:stored.url,driveFileId:stored.fileId||'',driveWebViewLink:stored.webViewLink||'',name:file.name.replace(/\.[^.]+$/,''),created:todayISO(),watermarked:true,watermark:'AG',storage:'google-drive'});
          }
        }
        // A remote update may arrive while pictures are uploading. Recheck the
        // currently synchronized state immediately before committing the insert.
        const existing=oldId?(db.properties||[]).find(x=>x.id===oldId):null;
        if(oldId&&!existing)throw new Error('O imóvel foi removido durante o envio. Atualize a lista antes de tentar novamente.');
        const lateDuplicate=propertyDuplicate(fd,oldId);
        if(lateDuplicate)throw new Error(`Este imóvel já foi cadastrado (${lateDuplicate.id}). Não foi criado outro registro.`);

        const record={...(existing||{}),...fd};
        // V135: timestamp the edited version so dedupe/cloud sync never restores
        // an older copy over the changes just saved by the user.
        record.updatedAt=new Date().toISOString();
        if(!record.createdAt)record.createdAt=existing?.createdAt||record.created||todayISO();
        record.photos=[...(existing?.photos||[]),...additions];
        if(!record.photos.length){
          record.photos=[{id:'PH'+uid().slice(-8).toUpperCase(),room:'Capa',src:v5FallbackPropertyImage(record),name:'Imagem principal',created:todayISO()}];
        }
        if(!record.coverPhoto || !record.photos.some(x=>x.id===record.coverPhoto))record.coverPhoto=record.photos[0]?.id||'';
        // V115: upsert by property code. Even if two asynchronous save paths race,
        // the second one replaces/merges the same code instead of appending another row.
        enforceUniqueProperties();
        const recordCode=normalizedPropertyCode(record.id);
        const sameCodeIndexes=[];
        (db.properties||[]).forEach((x,i)=>{if(normalizedPropertyCode(x?.id)===recordCode)sameCodeIndexes.push(i)});
        const targetIndex=existing
          ? db.properties.findIndex(x=>normalizedPropertyCode(x?.id)===normalizedPropertyCode(oldId))
          : (sameCodeIndexes.length?sameCodeIndexes[0]:-1);
        const wasExisting=targetIndex>=0;
        if(wasExisting){
          // V135: editing is an explicit replace/update. Do not merge the old
          // record back over the form values. Preserve only photos from any
          // accidental duplicate rows and remove those duplicate rows.
          const extraPhotos=[];
          (db.properties||[]).forEach((x,i)=>{
            if(i!==targetIndex&&normalizedPropertyCode(x?.id)===recordCode){
              extraPhotos.push(...(Array.isArray(x?.photos)?x.photos:[]));
            }
          });
          if(extraPhotos.length){
            const seen=new Set((record.photos||[]).map(ph=>String(ph?.id||ph?.driveFileId||ph?.src||'')));
            for(const ph of extraPhotos){
              const key=String(ph?.id||ph?.driveFileId||ph?.src||'');
              if(key&&seen.has(key))continue;
              if(key)seen.add(key);
              record.photos.push(ph);
            }
          }
          db.properties=db.properties.filter((x,i)=>i===targetIndex||normalizedPropertyCode(x?.id)!==recordCode);
          const keptIndex=db.properties.findIndex(x=>normalizedPropertyCode(x?.id)===recordCode);
          if(keptIndex>=0)db.properties[keptIndex]=record; else db.properties.push(record);
        }else{
          db.properties.push(record);
        }
        enforceUniqueProperties();
        // V167: cria/atualiza automaticamente o proprietário usando os dados preenchidos no imóvel.
        // A sincronização ocorre antes do saveDB para imóvel + proprietário irem juntos ao Firestore.
        try{window.AGOwnerSyncV167?.syncProperty?.(record)}catch(e){console.warn('V167 proprietário automático',e)}
        pushActivity('⌂',wasExisting?'Imóvel atualizado':'Novo imóvel cadastrado',`${record.id} · ${record.title}`);
        saveDB();
        closeModal();
        toast(files.length?`Imóvel salvo com ${files.length} ${files.length===1?'foto':'fotos'}.`:'Imóvel salvo com sucesso.');
        if(files.length)setTimeout(()=>openPropertyDetails(record.id,'gallery',additions[0]?.id),120);
      }catch(e){
        console.error('Falha no cadastro do imóvel',e);
        toast(e?.message||'Não foi possível salvar o imóvel. Confira os dados e tente novamente.');
      }finally{
        propertySavePending=false;
        delete form.dataset.agSaving;
        if(saveBtn?.isConnected){saveBtn.disabled=false;saveBtn.textContent=initialButtonText}
      }
      return;
    }
    return baseSaveModal();
  };

  // V115: protect all later saves and cloud refreshes from duplicated property codes.
  const v115SaveDBBase=saveDB;
  saveDB=function(){
    enforceUniqueProperties();
    return v115SaveDBBase.apply(this,arguments);
  };
  window.saveDB=saveDB;

  const v115RenderPropertiesBase=renderProperties;
  renderProperties=function(){
    enforceUniqueProperties();
    return v115RenderPropertiesBase.apply(this,arguments);
  };
  window.renderProperties=renderProperties;

  enforceUniqueProperties();

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
