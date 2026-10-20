/* AG Imobiliária — ação rápida de venda, mantendo o histórico do imóvel. */
(function(){
  'use strict';
  function soldAction(id){
    const item=(db?.properties||[]).find(p=>String(p.id)===String(id));
    if(!item)return;
    if(item.status==='Vendido'){window.toast?.('Este imóvel já está marcado como vendido.');return;}
    if(!window.confirm('Confirmar a venda de "'+String(item.title||item.id)+'"?\n\nO imóvel será marcado como vendido e retirado do catálogo público. O cadastro e as fotos continuarão no CRM.'))return;
    item.status='Vendido';
    item.published=false;
    item.featured=false;
    item.siteFeatured=false;
    item.soldAt=new Date().toISOString();
    if(typeof window.pushActivity==='function')window.pushActivity('✓','Imóvel vendido',String(item.id)+' · '+String(item.title||''));
    if(typeof window.saveDB==='function')window.saveDB();
    // A sincronização remota é conduzida pelas integrações já existentes no CRM.
    if(typeof window.closeModal==='function')window.closeModal();
    if(typeof window.renderSiteManager==='function')window.renderSiteManager();
    window.toast?.('Imóvel marcado como vendido e removido do catálogo para sincronização.');
  }
  window.agMarkPropertySold=soldAction;
  const previous=window.openPropertyDetails;
  if(typeof previous!=='function')return;
  window.openPropertyDetails=function(id,tab,photoId){
    const result=previous.apply(this,arguments);
    const item=(db?.properties||[]).find(p=>String(p.id)===String(id));
    const actions=document.querySelector('#modal .pw-summary-actions');
    if(actions && item && item.status!=='Vendido' && item.purpose!=='Locação' && !actions.querySelector('.ag-mark-sold')){
      const btn=document.createElement('button');
      btn.type='button';btn.className='btn ag-mark-sold';
      btn.textContent='✓ Marcar como vendido';
      btn.title='Concluir venda e retirar imóvel do site público';
      btn.addEventListener('click',()=>soldAction(id));
      actions.appendChild(btn);
    }
    return result;
  };
})();
