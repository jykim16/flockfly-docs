import { normalizeWebAppBundle, type WebAppBundle } from './webapp-operations';

function scriptSafe(value: string): string { return value.replace(/<\/script/gi, '<\\/script'); }
function styleSafe(value: string): string { return value.replace(/<\/style/gi, '<\\/style'); }
function escapeRegex(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function reviewSdk(loadToken: string): string {
  return `(function(){
var token=${JSON.stringify(loadToken)}, mode='annotate', active;
function selectorFor(el){var parts=[];for(var depth=0;el&&el.nodeType===1&&depth<5;depth++,el=el.parentElement){if(el.id)return '#'+CSS.escape(el.id)+(parts.length?'>'+parts.join('>'):'');var part=el.tagName.toLowerCase(),same=el.parentElement?Array.from(el.parentElement.children).filter(function(n){return n.tagName===el.tagName;}):[];if(same.length>1)part+=':nth-of-type('+(same.indexOf(el)+1)+')';parts.unshift(part);}return parts.join('>');}
function clear(){if(active)active.removeAttribute('data-flockdoc-selected');active=undefined;}
addEventListener('message',function(event){if(event.source!==parent||!event.data||event.data.token!==token)return;if(event.data.kind==='webapp.mode'){mode=event.data.mode;document.body.toggleAttribute('data-flockdoc-annotate',mode==='annotate');}if(event.data.kind==='webapp.reveal'){clear();try{active=document.querySelector(event.data.selector);active&&active.setAttribute('data-flockdoc-selected','');active&&active.scrollIntoView({block:'center',behavior:'smooth'});}catch(_){}}});
addEventListener('click',function(event){if(mode!=='annotate')return;var el=event.target;if(!(el instanceof Element)||el.closest('[data-flockdoc-ignore]'))return;event.preventDefault();event.stopImmediatePropagation();clear();active=el;active.setAttribute('data-flockdoc-selected','');parent.postMessage({kind:'webapp.element.selected',token:token,anchor:{kind:'webapp',selector:selectorFor(el),tag:el.tagName.toLowerCase(),text:(el.innerText||el.textContent||'').trim().slice(0,500)}},'*');},true);
var style=document.createElement('style');style.textContent='[data-flockdoc-selected]{outline:3px solid #0f6f7b!important;outline-offset:3px!important}body[data-flockdoc-annotate] *:hover{outline:2px dashed rgba(15,111,123,.7);outline-offset:2px}';document.head.appendChild(style);document.body.setAttribute('data-flockdoc-annotate','');
})();`;
}

export function buildWebAppPreview(value: WebAppBundle, loadToken: string): string {
  const bundle = normalizeWebAppBundle(value);
  let html = bundle.files[bundle.entrypoint]
    .replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, '')
    .replace(/<base\b[^>]*>/gi, '');
  for (const [path, content] of Object.entries(bundle.files)) {
    const quoted = escapeRegex(path);
    if (path.endsWith('.css')) html = html.replace(new RegExp(`<link\\b[^>]*href=["']${quoted}["'][^>]*>`, 'gi'), `<style data-file="${path}">${styleSafe(content)}</style>`);
    if (path.endsWith('.js')) html = html.replace(new RegExp(`<script\\b[^>]*src=["']${quoted}["'][^>]*>\\s*</script>`, 'gi'), `<script data-file="${path}">${scriptSafe(content)}</script>`);
  }
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'">`;
  const sdk = `<script data-flockdoc-review>${scriptSafe(reviewSdk(loadToken))}</script>`;
  html = /<head[\s>]/i.test(html) ? html.replace(/<head([^>]*)>/i, `<head$1>${csp}`) : `${csp}${html}`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${sdk}</body>`) : `${html}${sdk}`;
}
