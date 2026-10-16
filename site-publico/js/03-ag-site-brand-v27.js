document.addEventListener('DOMContentLoaded',()=>{
  const logo="./assets/ag-logo.png";
  document.querySelectorAll('.brand-logo-img').forEach(img=>{img.src=logo;img.alt='AG';});
  ['brandName','footerBrand','copyrightBrand'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='AG';});
  if(document.title.includes('Empreendimentos')||document.title.includes('NEXO'))document.title='AG — Imóveis';
});
