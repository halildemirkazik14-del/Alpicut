// Alpicut v1.6 — yapay zekâ / dijital konseptli geçişler (Alpicut'a özgü, MIT)
// Tam fragment shader biçimi: v_uv, u_from, u_to, u_progress, u_resolution ve vurgu renkleri gltrans.js başlığından gelir.
const N = 'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}'
  + 'float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}';

export const AI_TRANSITIONS = [
  // Nöral ağ: Voronoi hücreler sırayla "aktive" olur, kenarlarda mor sinaps parlaması
  { id: 'ai_neural', name: 'Nöral ağ', author: 'Alpicut', license: 'MIT', frag: N + `
vec3 vor(vec2 p){vec2 i=floor(p),f=fract(p);float d1=8.,d2=8.;vec2 id=vec2(0.);
for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y));vec2 o=vec2(hash(i+g),hash(i+g+19.));vec2 r=g+o-f;float d=dot(r,r);
if(d<d1){d2=d1;d1=d;id=i+g;}else if(d<d2)d2=d;}return vec3(id,sqrt(d2)-sqrt(d1));}
void main(){vec2 asp=vec2(u_resolution.x/u_resolution.y,1.);vec3 vo=vor(v_uv*asp*7.);
float t=hash(vo.xy)*.75+length(v_uv-.5)*.25;float on=smoothstep(t-.04,t+.04,u_progress*1.15-.05);
vec4 A=texture2D(u_from,v_uv),B=texture2D(u_to,v_uv);float edge=smoothstep(.06,0.,vo.z)*sin(u_progress*3.1416);
float pulse=smoothstep(.12,0.,abs(u_progress*1.15-.05-t));
gl_FragColor=vec4(mix(A.rgb,B.rgb,on)+u_accent_bright*edge*.9+u_accent*pulse*.45,1.);}` },

  // Veri taraması: parlak tarama çizgisi aşağı iner, geçtiği yer piksel bloklarından netleşir
  { id: 'ai_scan', name: 'Veri taraması', author: 'Alpicut', license: 'MIT', frag: N + `
void main(){float y=1.-v_uv.y;float p=u_progress*1.2-.1;float d=y-p;
vec2 blk=floor(v_uv*u_resolution/mix(28.,2.,smoothstep(0.,.25,-d)))*mix(28.,2.,smoothstep(0.,.25,-d))/u_resolution;
vec4 A=texture2D(u_from,v_uv);vec4 B=texture2D(u_to,d<0.?blk:v_uv);
float line=exp(-abs(d)*90.);float glow=exp(-abs(d)*14.)*.5;
vec3 c=d<0.?B.rgb:A.rgb;c+=u_accent_bright*line*1.6+u_accent*glow;
c+=step(.5,fract(v_uv.y*u_resolution.y*.25))*.04*glow;
gl_FragColor=vec4(c,1.);}` },

  // Dijital çözülme: görüntü küçük karelere ayrılıp yukarı uçar, alttan yenisi oluşur
  { id: 'ai_dissolve', name: 'Dijital çözülme', author: 'Alpicut', license: 'MIT', frag: N + `
void main(){vec2 g=vec2(u_resolution.x/u_resolution.y,1.)*38.;vec2 c=floor(v_uv*g);float r=hash(c);
float t=clamp((u_progress*1.6-r*.6),0.,1.);vec2 off=vec2((hash(c+3.)-.5)*.08,t*t*.35);
vec4 A=texture2D(u_from,clamp(v_uv-off,0.,1.));vec4 B=texture2D(u_to,v_uv);
float gone=step(.98,t);vec2 f=fract(v_uv*g);float sq=step(.08,f.x)*step(.08,f.y);
vec3 col=mix(A.rgb*(1.+t*.6),B.rgb,gone);col=mix(B.rgb,col,mix(sq,1.,1.-t)*(1.-gone)+gone*0.);
col+=u_accent_bright*t*(1.-t)*1.2*sq*(1.-gone);
gl_FragColor=vec4(mix(col,B.rgb,smoothstep(.85,1.,u_progress)),1.);}` },

  // Hologram: RGB kayması, yatay tarama çizgileri, titreşim — yeni görüntü hologram gibi belirir
  { id: 'ai_holo', name: 'Hologram', author: 'Alpicut', license: 'MIT', frag: N + `
void main(){float p=u_progress;float k=sin(p*3.1416);float jit=(hash(vec2(floor(v_uv.y*90.),floor(p*24.)))-.5)*.05*k;
vec2 u=v_uv+vec2(jit,0.);float s=.012*k;
vec3 A=vec3(texture2D(u_from,u+vec2(s,0)).r,texture2D(u_from,u).g,texture2D(u_from,u-vec2(s,0)).b);
vec3 B=vec3(texture2D(u_to,u+vec2(s,0)).r,texture2D(u_to,u).g,texture2D(u_to,u-vec2(s,0)).b);
vec3 c=mix(A,B,smoothstep(.35,.65,p));float lines=.75+.25*sin(v_uv.y*u_resolution.y*1.2);
c=mix(c,c*lines+u_accent*.18,k);c+=u_accent_bright*k*.12*vnoise(v_uv*vec2(4.,60.)+p*8.);
gl_FragColor=vec4(c,1.);}` },

  // Matris yağmuru: kod sütunları akar, aktığı yerde yeni görüntü belirir
  { id: 'ai_matrix', name: 'Kod yağmuru', author: 'Alpicut', license: 'MIT', frag: N + `
void main(){float cols=u_resolution.x/18.;float cx=floor(v_uv.x*cols);float sp=.6+hash(vec2(cx,1.))*.8;
float head=u_progress*1.6*sp-hash(vec2(cx,7.))*.5;float y=1.-v_uv.y;float d=head-y;
vec4 A=texture2D(u_from,v_uv),B=texture2D(u_to,v_uv);float on=step(0.,d);
vec2 cell=vec2(cx,floor(v_uv.y*u_resolution.y/22.));float glyph=step(.45,hash(cell+floor(u_progress*20.)));
vec2 f=fract(vec2(v_uv.x*cols,v_uv.y*u_resolution.y/22.));float box=step(.2,f.x)*step(f.x,.8)*step(.15,f.y)*step(f.y,.85);
float trail=exp(-max(d,0.)*9.)*on;float tip=exp(-abs(d)*60.);
vec3 c=mix(A.rgb,B.rgb,on*smoothstep(.0,.25,d));c+=u_accent*glyph*box*trail*.9+u_accent_bright*tip*glyph*box;
gl_FragColor=vec4(mix(c,B.rgb,smoothstep(.9,1.,u_progress)),1.);}` },

  // Piksel düşünme: görüntü kaba piksellere iner, "hesaplanıp" net hâliyle yeniye geçer
  { id: 'ai_compute', name: 'Hesaplanıyor', author: 'Alpicut', license: 'MIT', frag: N + `
void main(){float k=sin(u_progress*3.1416);float px=mix(1.,64.,k*k);vec2 g=u_resolution/px;
vec2 q=(floor(v_uv*g)+.5)/g;vec4 A=texture2D(u_from,q),B=texture2D(u_to,q);
float m=step(hash(floor(v_uv*g)),u_progress);vec3 c=mix(A.rgb,B.rgb,mix(m,step(.5,u_progress),1.-k));
vec2 f=fract(v_uv*g);float grid=(1.-step(.06,f.x)*step(.06,f.y))*k*.35;
gl_FragColor=vec4(c+u_accent*grid,1.);}` },

  // Portal: merkezde açılan, kenarı parlayan yuvarlak geçit
  { id: 'ai_portal', name: 'Portal', author: 'Alpicut', license: 'MIT', frag: N + `
void main(){vec2 c=(v_uv-.5)*vec2(u_resolution.x/u_resolution.y,1.);float r=length(c);float a=atan(c.y,c.x);
float R=u_progress*1.25;float wob=vnoise(vec2(a*3.,u_progress*6.))*.06;float d=r-R-wob;
vec2 tw=v_uv+normalize(c+1e-4)*exp(-abs(d)*8.)*.05;
vec4 A=texture2D(u_from,tw),B=texture2D(u_to,v_uv-c*.15*(1.-u_progress));
vec3 col=d<0.?B.rgb:A.rgb;col+=u_accent_bright*exp(-abs(d)*55.)*1.4+u_accent*exp(-abs(d)*10.)*.5*step(.01,u_progress)*step(u_progress,.99);
gl_FragColor=vec4(col,1.);}` },
];
