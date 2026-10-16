document.addEventListener('DOMContentLoaded',()=>{
  const wrap=document.getElementById('searchDock');
  const toggle=document.getElementById('advancedLocationToggle');
  if(wrap){
    wrap.classList.remove('advanced-open');
  }
  if(toggle){
    toggle.setAttribute('aria-expanded','false');
    toggle.textContent='+ Mais filtros';
  }
});
