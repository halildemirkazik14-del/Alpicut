// Alpicut v1.8 — Premium geçişler (Alpicut'a özgü, MIT).
// Kurgu programlarındaki "pro" paketlerin hareket dili: hareket bulanıklığı (motion blur), yumuşak hızlanma/yavaşlama,
// ışık sızması, film yanığı, mercek bükülmesi, deklanşör... Hepsi tek geçişli WebGL1 fragment shader.
// Biçim: v_uv, u_from, u_to, u_progress, u_resolution ve vurgu renkleri gltrans.js başlığından gelir.

const H = `
#define PI 3.14159265
float E3(float x){x=clamp(x,0.,1.);return x<.5?4.*x*x*x:1.-pow(-2.*x+2.,3.)/2.;}
float E5(float x){x=clamp(x,0.,1.);return x<.5?16.*x*x*x*x*x:1.-pow(-2.*x+2.,5.)/2.;}
float BELL(float x){return sin(clamp(x,0.,1.)*PI);}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*vnoise(p);p*=2.03;a*=.5;}return s;}
vec2 MIR(vec2 u){return abs(mod(u+1.,2.)-1.);}
float INSIDE(vec2 u){return step(0.,u.x)*step(u.x,1.)*step(0.,u.y)*step(u.y,1.);}
float LUM(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
vec3 SCREEN(vec3 a,vec3 b){return 1.-(1.-a)*(1.-b);}
`;

// Hızlı savrulma: iki görüntü tek şerit gibi kayar, hıza göre güçlü hareket bulanıklığı
const whip = (dx, dy) => `
void main(){vec2 D=vec2(${dx},${dy});float sp=BELL(u_progress);vec3 c=vec3(0.);
for(int i=0;i<28;i++){float f=float(i)/27.-.5;float q=E5(u_progress+f*sp*.16);
vec2 P=v_uv+D*q;vec2 fl=floor(P);float isF=step(abs(fl.x)+abs(fl.y),.5);
c+=mix(texture2D(u_to,fract(P)).rgb,texture2D(u_from,P).rgb,isF);}
gl_FragColor=vec4(c/28.,1.);}`;

// Zoom darbesi: içe zoom + radyal bulanıklık, kesim, sonraki görüntü büyükten oturur
const zoomPunch = (dir) => `
void main(){float p=u_progress;bool A=p<.5;float k=A?E3(p*2.):1.-E3((p-.5)*2.);
float sc=1.+k*${dir > 0 ? '1.1' : '-.22'};float amt=BELL(p)*.16;vec2 c0=vec2(.5);vec3 c=vec3(0.);
for(int i=0;i<16;i++){float f=float(i)/15.;vec2 u=c0+(v_uv-c0)/(sc*(1.+f*amt*${dir > 0 ? '1.' : '-.6'}));
c+=A?texture2D(u_from,MIR(u)).rgb:texture2D(u_to,MIR(u)).rgb;}
c/=16.;c+=vec3(1.)*pow(BELL(p),8.)*.35;gl_FragColor=vec4(c,1.);}`;

// Dönerek geçiş: dönme bulanıklığı + hafif büyüme, ortada kesim
const spin = (dir) => `
void main(){float p=u_progress;bool A=p<.5;float k=A?E3(p*2.):-(1.-E3((p-.5)*2.));
float ang=${dir}*k*PI*.9;float sp=BELL(p)*.55;float asp=u_resolution.x/u_resolution.y;float sc=1.+BELL(p)*.35;vec3 c=vec3(0.);
for(int i=0;i<16;i++){float f=float(i)/15.-.5;float a=ang+f*sp;vec2 d=(v_uv-.5)*vec2(asp,1.)/sc;
vec2 r=vec2(d.x*cos(a)-d.y*sin(a),d.x*sin(a)+d.y*cos(a));vec2 u=r/vec2(asp,1.)+.5;
c+=A?texture2D(u_from,MIR(u)).rgb:texture2D(u_to,MIR(u)).rgb;}
gl_FragColor=vec4(c/16.,1.);}`;

// Işık sızması: film kamerasındaki ışık kaçağı, yumuşak çapraz geçişin üstünde
const leak = (c1, c2, c3) => `
void main(){float p=u_progress;vec3 A=texture2D(u_from,v_uv).rgb,B=texture2D(u_to,v_uv).rgb;
vec3 base=mix(A,B,smoothstep(.3,.7,p));float b=pow(BELL(p),1.5);vec2 uv=v_uv;
float l1=exp(-length((uv-vec2(-.2+p*1.4,.75))*vec2(1.,1.6))*2.4);
float l2=exp(-length((uv-vec2(1.2-p*1.1,.25))*vec2(1.3,1.))*2.8);
float l3=exp(-abs(uv.x+uv.y*.6-p*1.9+.25)*5.);
vec3 L=(vec3(${c1})*l1+vec3(${c2})*l2+vec3(${c3})*l3*.7)*b*1.25;
vec3 c=SCREEN(base,clamp(L,0.,1.));c=mix(c,c*c*(3.-2.*c),.25);gl_FragColor=vec4(c+L*.12,1.);}`;

// Renk içinden geçiş (siyah/beyaz), sinematik eğriyle
const dip = (col) => `
void main(){float p=u_progress;vec3 K=vec3(${col});vec3 A=texture2D(u_from,v_uv).rgb,B=texture2D(u_to,v_uv).rgb;
vec3 c=p<.5?mix(A,K,E3(p*2.)):mix(K,B,E3((p-.5)*2.));gl_FragColor=vec4(c,1.);}`;

export const PRO_TRANSITIONS = [
  { id: 'pr_whip_r', name: 'Whip pan →', frag: H + whip('1.', '0.') },
  { id: 'pr_whip_l', name: 'Whip pan ←', frag: H + whip('-1.', '0.') },
  { id: 'pr_whip_u', name: 'Whip pan ↑', frag: H + whip('0.', '-1.') },
  { id: 'pr_whip_d', name: 'Whip pan ↓', frag: H + whip('0.', '1.') },
  { id: 'pr_whip_dr', name: 'Çapraz savrulma ↘', frag: H + whip('1.', '1.') },
  { id: 'pr_whip_ul', name: 'Çapraz savrulma ↖', frag: H + whip('-1.', '-1.') },
  { id: 'pr_zoom_in', name: 'Zoom darbesi', frag: H + zoomPunch(1) },
  { id: 'pr_zoom_out', name: 'Geri çekilme zoom', frag: H + zoomPunch(-1) },
  { id: 'pr_spin_cw', name: 'Dönerek geçiş ↻', frag: H + spin('-1.') },
  { id: 'pr_spin_ccw', name: 'Dönerek geçiş ↺', frag: H + spin('1.') },
  { id: 'pr_leak_warm', name: 'Işık sızması (sıcak)', frag: H + leak('1.,.55,.18', '1.,.25,.35', '1.,.85,.55') },
  { id: 'pr_leak_cool', name: 'Işık sızması (soğuk)', frag: H + leak('.35,.6,1.', '.7,.4,1.', '.6,.95,1.') },
  { id: 'pr_leak_gold', name: 'Altın ışık', frag: H + leak('1.,.78,.35', '1.,.6,.2', '1.,.95,.75') },
  { id: 'pr_dip_black', name: 'Siyaha karar', frag: H + dip('0.,0.,0.') },
  { id: 'pr_dip_white', name: 'Beyaza açıl', frag: H + dip('1.,1.,1.') },

  // Film yanığı: organik yanık kenarı turuncu-beyaz kor, delikten yeni sahne görünür
  { id: 'pr_film_burn', name: 'Film yanığı', frag: H + `
void main(){float p=u_progress;vec2 asp=vec2(u_resolution.x/u_resolution.y,1.);float n=fbm(v_uv*asp*3.2+vec2(0.,p*.6));
float t=p*1.35-.18;float m=smoothstep(t-.02,t+.02,n);vec3 A=texture2D(u_from,v_uv).rgb,B=texture2D(u_to,v_uv).rgb;
float edge=exp(-abs(n-t)*26.);vec3 glow=mix(vec3(1.,.35,.05),vec3(1.,.95,.75),edge*edge)*edge*1.6;
vec3 c=mix(B,A,m);c=SCREEN(c,clamp(glow,0.,1.));c+=vec3(1.,.5,.15)*BELL(p)*.12;gl_FragColor=vec4(c,1.);}` },

  // Parlaklık geçişi: önce aydınlık bölgeler yeni sahneye döner (luma fade)
  { id: 'pr_luma', name: 'Işıktan geçiş', frag: H + `
void main(){float p=E3(u_progress);vec3 A=texture2D(u_from,v_uv).rgb,B=texture2D(u_to,v_uv).rgb;float l=LUM(A);
float m=smoothstep(l-.18,l+.18,p*1.36-.18);gl_FragColor=vec4(mix(A,B,m)+vec3(1.)*exp(-abs(l-(p*1.36-.18))*14.)*BELL(u_progress)*.18,1.);}` },

  // Mercek bükülmesi: fıçı bükülmesi + kenarlarda renk sapması
  { id: 'pr_lens', name: 'Mercek bükülmesi', frag: H + `
void main(){float p=u_progress;float k=BELL(p);vec2 d=v_uv-.5;float r2=dot(d,d);float s=1.+k*1.6*r2;
vec2 c0=.5+d/(s*(1.+k*.25));float ab=k*.012;float m=smoothstep(.42,.58,p);
vec3 A=vec3(texture2D(u_from,MIR(.5+(c0-.5)*(1.+ab))).r,texture2D(u_from,MIR(c0)).g,texture2D(u_from,MIR(.5+(c0-.5)*(1.-ab))).b);
vec3 B=vec3(texture2D(u_to,MIR(.5+(c0-.5)*(1.+ab))).r,texture2D(u_to,MIR(c0)).g,texture2D(u_to,MIR(.5+(c0-.5)*(1.-ab))).b);
vec3 c=mix(A,B,m);c*=1.-k*.35*smoothstep(.15,.6,sqrt(r2));gl_FragColor=vec4(c,1.);}` },

  // Profesyonel glitch: blok kaymaları, RGB ayrışması, tarama çizgisi — kısa ve sert
  { id: 'pr_glitch', name: 'Pro glitch', frag: H + `
void main(){float p=u_progress;float g=pow(BELL(p),.7);float step8=floor(p*14.);vec2 uv=v_uv;
float band=floor(uv.y*22.);float r=hash(vec2(band,step8));float sh=(r-.5)*.22*g*step(.55,hash(vec2(band*1.7,step8)));
uv.x+=sh;float sel=step(hash(vec2(band,step8+3.)),smoothstep(.3,.7,p));float ab=.018*g;
vec3 A=vec3(texture2D(u_from,MIR(uv+vec2(ab,0.))).r,texture2D(u_from,MIR(uv)).g,texture2D(u_from,MIR(uv-vec2(ab,0.))).b);
vec3 B=vec3(texture2D(u_to,MIR(uv+vec2(ab,0.))).r,texture2D(u_to,MIR(uv)).g,texture2D(u_to,MIR(uv-vec2(ab,0.))).b);
vec3 c=mix(A,B,sel);c*=1.-.18*g*step(.5,fract(v_uv.y*u_resolution.y*.33));c+=u_accent_bright*g*.06*step(.92,hash(vec2(band,step8+9.)));
gl_FragColor=vec4(c,1.);}` },

  // Esneme: dikey uzama + hız bulanıklığı (sosyal medya "stretch")
  { id: 'pr_stretch', name: 'Esneyerek geçiş', frag: H + `
void main(){float p=u_progress;bool A=p<.5;float k=A?E3(p*2.):1.-E3((p-.5)*2.);float sp=BELL(p)*.25;vec3 c=vec3(0.);
for(int i=0;i<14;i++){float f=float(i)/13.-.5;float s=1.+k*5.+f*sp*6.;vec2 u=vec2(v_uv.x,.5+(v_uv.y-.5)/s);
u.y+=(A?-1.:1.)*k*.22;c+=A?texture2D(u_from,MIR(u)).rgb:texture2D(u_to,MIR(u)).rgb;}
gl_FragColor=vec4(c/14.+vec3(.9,.9,1.)*pow(BELL(p),10.)*.25,1.);}` },

  // Mürekkep yayılması: organik kenarlı geçiş, kenarda koyu mürekkep halesi
  { id: 'pr_ink', name: 'Mürekkep yayılması', frag: H + `
void main(){float p=E3(u_progress);vec2 asp=vec2(u_resolution.x/u_resolution.y,1.);vec2 d=(v_uv-.5)*asp;
float n=fbm(v_uv*asp*4.)*.55+length(d)*.85;float t=p*1.5-.08;float m=smoothstep(t-.03,t+.03,n);
vec3 A=texture2D(u_from,v_uv).rgb,B=texture2D(u_to,v_uv).rgb;float e=exp(-abs(n-t)*22.)*BELL(u_progress);
vec3 c=mix(B,A,m);c=mix(c,vec3(.04,.03,.06),e*.75);gl_FragColor=vec4(c,1.);}` },

  // Odak kayması: bokeh bulanıklığına girip yeni sahnede netleşir
  { id: 'pr_defocus', name: 'Odak kayması (bokeh)', frag: H + `
void main(){float p=u_progress;float r=BELL(p)*.035;float m=smoothstep(.35,.65,p);vec3 c=vec3(0.);float asp=u_resolution.x/u_resolution.y;
for(int i=0;i<24;i++){float f=float(i);float a=f*2.39996;float rr=sqrt(f/24.)*r;vec2 o=vec2(cos(a)/asp,sin(a))*rr;
vec3 s=mix(texture2D(u_from,MIR(v_uv+o)).rgb,texture2D(u_to,MIR(v_uv+o)).rgb,m);c+=s+pow(s,vec3(4.))*BELL(p)*1.5;}
c/=24.;gl_FragColor=vec4(c,1.);}` },

  // Deklanşör: altıgen bıçaklar kapanır, yeni sahnede açılır
  { id: 'pr_shutter', name: 'Kamera deklanşörü', frag: H + `
void main(){float p=u_progress;bool A=p<.5;float k=A?E3(p*2.):1.-E3((p-.5)*2.);float asp=u_resolution.x/u_resolution.y;
vec2 d=(v_uv-.5)*vec2(asp,1.);float rot=p*1.6;float hx=0.;for(int i=0;i<6;i++){float a=rot+float(i)*1.0472;hx=max(hx,dot(d,vec2(cos(a),sin(a))));}
float R=(1.-k)*1.15;float inside=smoothstep(R+.004,R-.004,hx);vec3 S=A?texture2D(u_from,v_uv).rgb:texture2D(u_to,v_uv).rgb;
float rim=exp(-abs(hx-R)*60.)*k;vec3 blade=vec3(.07,.07,.08)+vec3(.12)*fract(atan(d.y,d.x)*.955+rot);gl_FragColor=vec4(mix(blade,S,inside)+rim*.25,1.);}` },

  // Kapı açılışı: görüntü ortadan ikiye ayrılıp hızla açılır, arkada yeni sahne yaklaşır
  { id: 'pr_doors', name: 'Kapı açılışı (bulanık)', frag: H + `
void main(){float p=E5(u_progress);float sp=BELL(u_progress)*.12;vec3 c=vec3(0.);
for(int i=0;i<12;i++){float f=float(i)/11.-.5;float q=clamp(p+f*sp,0.,1.);float side=v_uv.x<.5?-1.:1.;
vec2 u=vec2(v_uv.x-side*q*.5,v_uv.y);float stay=v_uv.x<.5?step(u.x,.5)*step(0.,u.x):step(.5,u.x)*step(u.x,1.);
vec2 ub=.5+(v_uv-.5)/(1.08-.08*p);vec3 B=texture2D(u_to,ub).rgb*(.6+.4*p);c+=mix(B,texture2D(u_from,u).rgb,stay);}
gl_FragColor=vec4(c/12.,1.);}` },

  // Paralaks itme: yeni sahne gölgesiyle üstten kayarak gelir, eski sahne yavaş geri çekilir
  { id: 'pr_push', name: 'Paralaks itme', frag: H + `
void main(){float p=E5(u_progress);float x=v_uv.x-(1.-p);vec2 ut=vec2(x,v_uv.y);float onTo=step(0.,x);
vec2 uf=vec2(v_uv.x+p*.35,v_uv.y);vec3 A=texture2D(u_from,MIR(uf)).rgb*(1.-.55*p);vec3 B=texture2D(u_to,ut).rgb;
float sh=onTo<.5?exp(-(-x)*40.)*.6:0.;gl_FragColor=vec4(mix(A*(1.-sh),B,onTo),1.);}` },

  // 3D kart çevirme: perspektifli Y ekseni dönüşü, gölgeli
  { id: 'pr_flip3d', name: '3D kart çevir', frag: H + `
void main(){float p=E3(u_progress);float a=p*PI;float ca=cos(a),sa=sin(a);bool front=ca>0.;float w=abs(ca);
float x=(v_uv.x-.5)/max(w,.001);float persp=1.+sa*.45*(front?x:-x);vec2 u=vec2(.5+x,.5+(v_uv.y-.5)*persp);
float ins=step(abs(x),.5)*step(abs(u.y-.5),.5);vec3 S=front?texture2D(u_from,u).rgb:texture2D(u_to,vec2(1.-u.x,u.y)).rgb;
vec3 bg=vec3(.03,.03,.05);S*=.55+.45*w;gl_FragColor=vec4(mix(bg,S,ins),1.);}` },

  // VHS geri sarma: iz kayması, renk taşması, parazit — nostaljik
  { id: 'pr_vhs', name: 'VHS geri sarma', frag: H + `
void main(){float p=u_progress;float g=BELL(p);float t=floor(p*30.);vec2 uv=v_uv;float ln=floor(uv.y*u_resolution.y/3.);
uv.x+=(hash(vec2(ln,t))-.5)*.012*g+sin(uv.y*40.+p*60.)*.006*g;float band=exp(-abs(fract(uv.y-p*2.5)-.5)*30.)*g;uv.x+=band*.06;
float m=smoothstep(.42,.58,p);vec3 A=texture2D(u_from,uv).rgb,B=texture2D(u_to,uv).rgb;vec3 c=mix(A,B,m);
float cr=mix(texture2D(u_from,uv+vec2(.008*g,0.)).r,texture2D(u_to,uv+vec2(.008*g,0.)).r,m);c.r=mix(c.r,cr,.7);c=mix(c,vec3(LUM(c)),.35*g);
c+=(hash(uv*u_resolution+t)-.5)*.22*g+band*.35;c*=1.-.12*g*step(.5,fract(v_uv.y*u_resolution.y*.5));gl_FragColor=vec4(c,1.);}` },

  // Eski film: sepya, titreme, çizik ve toz; ortada kare atlaması
  { id: 'pr_oldfilm', name: 'Eski film karesi', frag: H + `
void main(){float p=u_progress;float g=BELL(p);float t=floor(p*24.);vec2 uv=v_uv;uv.y+=(p<.5?-1.:1.)*pow(g,6.)*.25;
vec3 A=texture2D(u_from,MIR(uv)).rgb,B=texture2D(u_to,MIR(uv)).rgb;vec3 c=mix(A,B,step(.5,p));float l=LUM(c);
vec3 sep=vec3(l*1.07,l*.86,l*.62);c=mix(c,sep,g*.85);c*=1.-g*.25*hash(vec2(t,1.));
float sx=hash(vec2(t,7.));c-=g*.5*exp(-abs(v_uv.x-sx)*900.)*step(.4,hash(vec2(t,2.)));
c+=g*.45*step(.995,hash(floor(v_uv*u_resolution/3.)+t));float vg=length(v_uv-.5);c*=1.-g*.6*smoothstep(.3,.75,vg);gl_FragColor=vec4(c,1.);}` },

  // Parlak flaş: aşırı pozlama + yumuşak ışıma
  { id: 'pr_flash', name: 'Parlama flaşı', frag: H + `
void main(){float p=u_progress;float g=pow(BELL(p),2.);vec3 c=vec3(0.);float m=smoothstep(.45,.55,p);
for(int i=0;i<12;i++){float a=float(i)*.5236;vec2 o=vec2(cos(a),sin(a))*.012*g;c+=mix(texture2D(u_from,MIR(v_uv+o)).rgb,texture2D(u_to,MIR(v_uv+o)).rgb,m);}
c/=12.;c=1.-exp(-c*(1.+g*5.));c=mix(c,vec3(1.,.98,.95),g*.55);gl_FragColor=vec4(c,1.);}` },

  // Işık lekesi sürüklenmesi: parlak bölgeler yatay iz bırakır
  { id: 'pr_smear', name: 'Işık izi', frag: H + `
void main(){float p=u_progress;float g=BELL(p);float m=smoothstep(.35,.65,p);vec3 base=mix(texture2D(u_from,v_uv).rgb,texture2D(u_to,v_uv).rgb,m);vec3 s=vec3(0.);
for(int i=1;i<16;i++){float f=float(i)/15.;vec2 u=v_uv-vec2(f*.25*g,0.);vec3 x=mix(texture2D(u_from,MIR(u)).rgb,texture2D(u_to,MIR(u)).rgb,m);s=max(s,x*smoothstep(.55,1.,LUM(x))*(1.-f));}
gl_FragColor=vec4(SCREEN(base,s*g*1.4),1.);}` },

  // Cam kaydırma: buzlu cam paneli ekrandan geçer, arkasında sahne değişir
  { id: 'pr_glass', name: 'Buzlu cam', frag: H + `
void main(){float p=E3(u_progress);float x0=-.4+p*1.8;float d=v_uv.x+(v_uv.y-.5)*.25-x0;float pane=smoothstep(.25,.22,abs(d));
float m=step(d,0.);vec2 off=vec2(vnoise(v_uv*90.),vnoise(v_uv*90.+7.))-.5;vec2 u=v_uv+off*.018*pane;
vec3 c=mix(texture2D(u_from,MIR(u)).rgb,texture2D(u_to,MIR(u)).rgb,m);c=mix(c,c*1.08+.06,pane);c+=exp(-abs(abs(d)-.235)*120.)*.35*pane;gl_FragColor=vec4(c,1.);}` },

  // Kalp atışı: iki kısa nabız zoomu ve geçiş (müzik ritmine uygun)
  { id: 'pr_pulse', name: 'Nabız (ritim)', frag: H + `
void main(){float p=u_progress;float b1=exp(-pow((p-.25)*14.,2.)),b2=exp(-pow((p-.62)*14.,2.));float s=1.+(b1+b2)*.12;vec2 u=.5+(v_uv-.5)/s;
vec3 c=mix(texture2D(u_from,MIR(u)).rgb,texture2D(u_to,MIR(u)).rgb,step(.55,p));c*=1.+(b1+b2)*.25;gl_FragColor=vec4(c,1.);}` },
].map((t) => ({ author: 'Alpicut', license: 'MIT', ...t }));
