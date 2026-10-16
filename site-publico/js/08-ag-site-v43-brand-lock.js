document.addEventListener('DOMContentLoaded',()=>{
  document.title='AG — Imóveis selecionados';
  ['brandName','footerBrand','copyrightBrand'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='AG';});
  document.querySelectorAll('img[alt]').forEach(img=>{if(/nexo|empreendimentos/i.test(img.alt||''))img.alt='AG';});
  document.querySelectorAll('a,span,p,small,div').forEach(el=>{
    if(el.children.length===0 && /^(NEXO\s*Imóveis|Empreendimentos\s*Imobiliários|Negócios\s*Imobiliários)$/i.test((el.textContent||'').trim())) el.textContent='AG';
  });
});
