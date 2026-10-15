// Architecture-AL — accueil : galerie de colonnes calculée (three.js r128), qui remplace la vidéo de la banque Wix
// (licence limitée aux sites Wix). Réglée sur l'image de référence par mesures zone par zone, puis à la demande d'AL
// (15/10) : anneau complet sans raccord visible, entraxe 2,60 m, 0,60 m/s, contraste 1,35, sans grain en relief.
// Source de travail et outils de mesure : scratchpad accueil3d/galerie-plan (essai.html, zones.py, rendre.mjs).
// Hôte : #galerie ; image fixe en fond jusqu'au premier dessin ; mouvement réduit → une seule image.
/* ------------------------------------------------------------------
   GALERIE EN PLAN COURBE — remake fidèle du clip Wix, lecture « courbe en plan »
   La galerie est de niveau ; son plan tourne doucement à DROITE (rayon 60 m).
   La caméra est dedans, à 1,9 m de l'axe des colonnes, et regarde 8° vers le mur.
   Les colonnes rondes (Ø 0,60, entraxe 2,20) balaient le cadre vers la droite ; le
   mur intérieur (à 2,3 m) ferme le cadre à droite et cache le bout de la galerie.
   Soleil à gauche (de l'extérieur), 43° de haut, 10° vers l'avant : liseré clair
   à gauche de chaque colonne, barres de lumière en travers du sol, bandes
   éclairées sur le mur coupées en biais par l'ombre de la dalle de couverture.
   Les chiffres viennent d'un ajustement sur l'image de référence (ajuster.py).
   v5 (14/10) : couleurs et ombres recalées zone par zone sur la référence (zones.py, points.py) —
   sortie linéaire sans ACES, renvoi chaud au pied des piliers, ombres portées élargies (ailettes),
   pénombre douce (disque de Vogel, texels calés sur le monde), logo au centre (gabarit).
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  var T = window.THREE; if (!T) return;
  var hote = document.getElementById('galerie');
  if (!hote) return;
  var DEG = Math.PI / 180;
  var calme = matchMedia('(prefers-reduced-motion: reduce)').matches || location.hash.indexOf('fige') >= 0;
  var FIGE = 0;                       // s — l'instant figé (et le départ de l'animation)
  var t0 = performance.now();

  /* ---------- réglages ---------- */
  var R = {
    // v6 — cadrage refait par ajustement sur la référence (geo3.py : silhouettes droites et gauches de 12 piliers,
    // 11 bas visibles, bord du mur et ligne de pied du mur ; modèle vérifié sur v5 à 3 px près) : écarts ≤ 7 px.
    // L'œil est plus bas (1,03 m), la caméra plus près de la rangée, l'horizon sous le centre du cadre.
    // anneau complet (15/10) : 133 piliers × 2,60 m = 247 dalles × 1,40 m — tout boucle, le tour ne se voit pas.
    // Le rayon ajusté sur la référence était 55,6 m : 11 cm d'écart à 30 m devant la caméra.
    Rp: 55.0358,     // rayon de l'axe des colonnes (plan courbe, vers la droite)
    a: 1.42,         // caméra : distance à l'axe des colonnes (vers l'intérieur)
    b: 2.26,         // caméra : distance au mur intérieur
    pas: 2.60, D: 0.60, nSup: 2.4,     // entraxe, largeur, exposant de la superellipse (2 = rond, 4 = carré arrondi)
    Hc: 6.50, ep: 0.45, debord: 1.20,  // dessous de dalle, épaisseur, débord hors des colonnes
    seuil: 0.35,     // sol au-delà des colonnes, avant le vide
    h: 1.03,         // hauteur de l'œil
    s0: 0.71,        // m — position de départ le long de l'arc : à 4 s, les piliers tombent où ils sont dans la référence
    // décentrement vertical du cadre (fraction de H). Signe : dy > 0 décale la fenêtre vers le BAS de l'image
    // rendue, donc l'horizon REMONTE à l'écran (plus de sol) ; dy < 0 le fait descendre (moins de sol).
    // Paysage −0,052 : horizon à y ≈ 497 sur 900, comme la référence.
    dyPaysage: -0.052, dyPortrait: 0.0,
    psi: 8.3, hfov: 25.0,              // lacet vers le mur, champ horizontal (16:9)
    elev: 43.0, azim: 12.0,            // soleil : hauteur ; azimut depuis la normale extérieure, + = vers l'avant, − = de derrière
    sMin: 0, sMax: 345.8, seg: 0.5,     // l'anneau entier (m, sur l'axe des colonnes) et finesse des rubans
    v: 0.60,         // avancée de la caméra, m/s (AL : ×3, ×2, ×4, ×2 puis « ralentis » ; un pilier toutes les 4,3 s, un tour ≈ 9 min 36)
    contraste: 1.35, // courbe en S de sortie (1 = neutre), pivot au gris moyen de la scène, épaule douce (AL : « plus de contraste »)
    // ailettes d'ombre (v5, profil v6) : allongement vers l'avant de l'ombre portée de chaque pilier, en m au-delà
    // du fût. Deux paliers : « ailette » du pied à hAilette (les rayons qui tombent sur le SOL passent là),
    // « ailetteHaut » au-dessus (les rayons qui tombent sur le MUR passent entre ~3,5 et ~5,4 m). Bords
    // verticaux : barres du sol et taches du mur à bords parallèles, comme la référence.
    ailette: 0.77, ailetteHaut: 0.75, hAilette: 3.5,  // 0,75 : mur juste à 4, 30 et 60 s (mesuré le 15/10 ; 0,45 l'éclairait trop)
    carte: 2048,     // côté de la carte d'ombre (texels)
    echantillons: 32, // lectures de la carte d'ombre par pixel pour la pénombre
    penombre: 4.0,   // rayon de la pénombre, en texels de la carte d'ombre (~2 cm) : piliers
    flouSol: 1.0, flouMur: 3.0,        // … multiplié sur le sol et sur le mur
    // v6 — indirect des piliers selon la distance d (m) à la caméra, par canal (r, v, b) : profPres jusqu'à
    // profD[0], profMi à profD[1], profLoin à profD[2] et au-delà, interpolé entre. Mesuré pilier par pilier sur
    // la référence : l'ombre des fûts passe de 157 (beige chaud, R−B 34) devant à 126 (olive, R ≈ V) au fond.
    // Renvoi du pied × clamp(1 − (d − profPied[0]) / profPied[1], 0, 1) : il s'éteint vers 20 m.
    profPres: [1.12, 1.04, 1.01], profMi: [0.97, 0.955, 0.96], profLoin: [0.62, 0.68, 0.70],
    profD: [10.0, 22.0, 33.0], profPied: [16.0, 14.0],
    // v6 — piliers : soleil direct en 1 − (1 − n·l)^diffExp au lieu de n·l. Dans la référence le flanc éclairé
    // d'un fût est un PLATEAU clair qui tombe vite au terminateur (plâtre rugueux, rendu « filmique ») ; en
    // Lambert pur c'est une rampe. Pente finie au terminateur (diffExp fois celle de Lambert) : pas de marche.
    // Seules les surfaces courbes le montrent : sol et mur ont un n·l constant.
    diffExp: 2.0
  };
  /* v5 — lumière et matières recalées zone par zone sur la référence (zones.py, moyennes RVB et R−B).
     Sortie linéaire (plus d'ACES : il blanchissait les clairs et en mangeait la chaleur), tout est donc lisible
     en clair : couleur affichée ≈ albédo × (soleil·cos + ciel + rebond). Couleurs en sRGB, converties en linéaire. */
  var C = {
    // albédos (sRGB)
    platre: 0xe6e1da, mur: 0xe0dad3, sol: 0xeeeae2, plafond: 0xeedaca, brume: 0xebe6dc,
    // lumières, en LINÉAIRE (r, v, b) : ce sont des éclairements, pas des couleurs d'écran
    soleil: [1.27, 1.24, 1.23],                    // soleil bas, à peine chaud : l'or des clairs vient de la pierre crème
    ciel: [0.328, 0.337, 0.290],                   // ciel vu du sol : neutre-olive (les ombres du sol de la référence)
    sousCiel: [0.513, 0.547, 0.471],               // venu d'en bas et des côtés : sol et mur ensoleillés
    rebondFond: [0.075, 0.035, 0.000],             // renvoi chaud du sol et du mur ensoleillés sur les piliers, partout
    rebondPied: [0.260, 0.185, 0.150], rebondH: 0.60, // … et fort au pied, qui s'éteint en ~0,85 m de haut
    rebondMur: 0.30                                 // part de ce renvoi sur le mur
  };
  function lin3(t) { return new T.Color(t[0], t[1], t[2]); }

  /* ---------- rendu ---------- */
  var W = hote.clientWidth || 1600, H = hote.clientHeight || 900;
  var rendu;
  try { rendu = new T.WebGLRenderer({ antialias: true, alpha: true }); }
  catch (e) { return; }                // pas de WebGL : l'image fixe de l'accueil reste
  rendu.setClearAlpha(0);
  rendu.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  rendu.setSize(W, H);
  rendu.outputEncoding = T.sRGBEncoding;
  // Courbe de sortie (15/10) : contraste dans un espace perçu (gamma 2,2) autour du gris moyen de la scène (0,70),
  // puis épaule douce au-dessus de 0,88 : les lumières montent sans jamais brûler. Le ciel (dégradé CSS derrière
  // le canevas transparent) n'est pas touché.
  T.ShaderChunk.tonemapping_pars_fragment = T.ShaderChunk.tonemapping_pars_fragment.replace(
    'vec3 CustomToneMapping( vec3 color ) { return color; }',
    'vec3 CustomToneMapping( vec3 color ) {\n' +
    '  vec3 p = pow( max( color * toneMappingExposure, 0.0 ), vec3( 1.0 / 2.2 ) );\n' +
    '  p = ( p - 0.70 ) * ' + R.contraste.toFixed(3) + ' + 0.70;\n' +
    '  vec3 epaule = 0.88 + 0.12 * ( 1.0 - exp( -( p - 0.88 ) / 0.12 ) );\n' +
    '  p = mix( p, epaule, step( 0.88, p ) );\n' +
    '  return pow( clamp( p, 0.0, 1.0 ), vec3( 2.2 ) );\n' +
    '}');
  rendu.toneMapping = T.CustomToneMapping;
  rendu.shadowMap.enabled = true;
  // PCF à rayon : la pénombre s'élargit (le PCF « doux » de r128 ignore le rayon et reste net à un texel)
  rendu.shadowMap.type = T.PCFShadowMap;
  hote.appendChild(rendu.domElement);

  /* ---------- pénombre douce (v5) ----------
     Le PCF de r128 prend 17 échantillons sur une grille fixe : au-delà de 2 texels de rayon il dessine des
     marches. On le remplace par R.echantillons points d'un disque de Vogel tourné au hasard — un hasard attaché
     au MONDE (position de la surface), pas à l'écran : le grain ne fourmille pas quand la caméra avance. */
  (function () {
    var K = T.ShaderChunk, dbt = '#ifdef USE_SHADOWMAP\n';
    K.shadowmap_pars_vertex = K.shadowmap_pars_vertex.replace(dbt, dbt + 'varying vec3 vOmbreMonde;\n');
    K.shadowmap_vertex = K.shadowmap_vertex.replace(dbt, dbt + '\tvOmbreMonde = worldPosition.xyz;\n');
    var f = K.shadowmap_pars_fragment.replace(dbt, dbt + 'varying vec3 vOmbreMonde;\n');
    var a = f.indexOf('#if defined( SHADOWMAP_TYPE_PCF )\n\t\t\tvec2 texelSize'), b = f.indexOf('#elif defined( SHADOWMAP_TYPE_PCF_SOFT )');
    if (a < 0 || b < a) return;                       // autre version de three : on garde le PCF d'origine
    // disque de Vogel (angle d'or) : N points répartis également, quel que soit N
    var N = R.echantillons, disque = [];
    for (var k = 0; k < N; k++) { var rk = Math.sqrt((k + 0.5) / N), ak = k * 2.39996323; disque.push([rk * Math.cos(ak), rk * Math.sin(ak)]); }
    var corps = '#if defined( SHADOWMAP_TYPE_PCF )\n' +
      '\t\t\tfloat hO = 6.2831853 * fract( sin( dot( floor( vOmbreMonde * 400.0 ), vec3( 12.9898, 78.233, 37.719 ) ) ) * 43758.5453 );\n' +
      '\t\t\tmat2 rotO = mat2( cos( hO ), sin( hO ), - sin( hO ), cos( hO ) );\n' +
      '\t\t\tvec2 rayO = shadowRadius / shadowMapSize;\n' +
      '\t\t\tshadow = ( ' + disque.map(function (p) {
        return 'texture2DCompare( shadowMap, shadowCoord.xy + rotO * vec2( ' + p[0].toFixed(3) + ', ' + p[1].toFixed(3) + ' ) * rayO, shadowCoord.z )';
      }).join(' +\n\t\t\t\t') + ' ) * ( 1.0 / ' + N.toFixed(1) + ' );\n\t\t';
    K.shadowmap_pars_fragment = f.slice(0, a) + corps + f.slice(b);
  })();

  var scene = new T.Scene();
  scene.fog = new T.Fog(C.brume, 45, 300);    // r128 mêle le brouillard APRÈS le codage sRGB : couleur en sRGB
  var cam = new T.PerspectiveCamera(14, W / H, 0.2, 260);

  /* ---------- textures procédurales (grain de plâtre, dalles du sol) ---------- */
  function bruit(n, oct, amp) {           // canevas n×n, bruit de valeur à oct octaves, autour de 255 − amp
    var cv = document.createElement('canvas'); cv.width = cv.height = n;
    var cx = cv.getContext('2d'), img = cx.createImageData(n, n), d = img.data;
    var grilles = [];
    for (var o = 0; o < oct; o++) {
      var g = (n >> 3) << o, tab = new Float32Array(g * g);   // de n/8 cellules par tuile à n : grain fin, pas de taches
      for (var i = 0; i < g * g; i++) tab[i] = Math.random();
      grilles.push({ g: g, tab: tab });
    }
    function lisse(t) { return t * t * (3 - 2 * t); }
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      var v = 0, w = 1, ws = 0;
      for (var k = 0; k < oct; k++) {
        var G = grilles[k], g2 = G.g, fx = x * g2 / n, fy = y * g2 / n;
        var x0 = Math.floor(fx), y0 = Math.floor(fy), tx = lisse(fx - x0), ty = lisse(fy - y0);
        var x1 = (x0 + 1) % g2, y1 = (y0 + 1) % g2;
        var a = G.tab[y0 * g2 + x0], b = G.tab[y0 * g2 + x1], c = G.tab[y1 * g2 + x0], e = G.tab[y1 * g2 + x1];
        v += w * ((a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + e * tx) * ty); ws += w; w *= 0.6;
      }
      v = v / ws;                          // 0..1, moyenne 0,5
      var p = (y * n + x) * 4, val = Math.round(255 - amp + (v - 0.5) * 2 * amp);
      d[p] = d[p + 1] = d[p + 2] = Math.max(0, Math.min(255, val)); d[p + 3] = 255;
    }
    cx.putImageData(img, 0, 0);
    return cv;
  }
  function texture(cv, ru, rv) {
    var tx = new T.CanvasTexture(cv);
    tx.wrapS = tx.wrapT = T.RepeatWrapping; tx.repeat.set(ru, rv);
    tx.encoding = T.sRGBEncoding; tx.anisotropy = Math.min(8, rendu.capabilities.getMaxAnisotropy());
    return tx;
  }
  var grainCv = bruit(256, 4, 9);                         // plâtre (mur, plafond) : grain fin, ±3,5 %
  var solCv = (function () {                              // dalles : grain + joints légers
    var cv = bruit(512, 4, 7), cx = cv.getContext('2d');
    cx.fillStyle = 'rgba(70,60,45,0.16)';
    cx.fillRect(0, 0, 512, 2); cx.fillRect(0, 0, 2, 512);  // un joint par bord (une dalle = une tuile)
    cx.fillStyle = 'rgba(255,255,255,0.10)';
    cx.fillRect(0, 2, 512, 1); cx.fillRect(2, 0, 1, 512);  // arête claire : le chanfrein du bord de dalle
    return cv;
  })();
  var DALLE = 1.40;                                       // m — une dalle par tuile
  var txPlatre = texture(grainCv, 1 / 0.9, 1 / 0.9);      // UV en mètres sur toutes les surfaces
  var txSol = texture(solCv, 1 / DALLE, 1 / DALLE);

  /* ---------- matières ---------- */
  // Phong à brillance nulle : Lambert calculé par pixel, ombre appliquée lumière par lumière
  // (MeshLambertMaterial éteint les appoints dans l'ombre : un seul masque pour tout le direct).
  function mat(hex, tx) {
    return new T.MeshPhongMaterial({
      color: new T.Color(hex).convertSRGBToLinear(), map: tx || null,
      specular: 0x000000, shininess: 0
    });
  }
  // Renvoi du sol ensoleillé : un éclairement chaud ajouté aux faces verticales, fort au pied et qui
  // s'éteint avec la hauteur (la référence : ombre des piliers 150 en haut, 180-190 au pied, plus chaude).
  // Il passe par l'éclairement indirect (« irradiance ») : l'ombre portée ne le coupe pas, comme un vrai renvoi.
  var uRebond = { fond: { value: lin3(C.rebondFond) }, pied: { value: lin3(C.rebondPied) }, h: { value: C.rebondH },
                  pres: { value: lin3(R.profPres) }, mi: { value: lin3(R.profMi) }, loin: { value: lin3(R.profLoin) },
                  profD: { value: new T.Vector3(R.profD[0], R.profD[1], R.profD[2]) },
                  profPied: { value: new T.Vector2(R.profPied[0], R.profPied[1]) } };
  // part : part du renvoi reçue ; flou : multiplie le rayon de pénombre sur cette surface (le mur est à
  // 4 m des piliers qui l'ombrent : sa pénombre est plus large que celle du sol au pied des fûts).
  // prof (v6, piliers seulement) : l'indirect (ciel + renvois) s'éteint avec la distance — les piliers lointains
  // montrent la face qui regarde le long de la rangée, vers les fûts voisins et la galerie couverte : elle ne voit
  // ni le ciel ni le sol ensoleillé. Dans la référence leur ombre passe de ~157 (devant) à ~126, olive ; le renvoi
  // chaud du pied disparaît au loin.
  function avecRebond(m, part, flou, prof) {
    m.onBeforeCompile = function (sh) {
      sh.uniforms.uRebondFond = uRebond.fond; sh.uniforms.uRebondPied = uRebond.pied;
      sh.uniforms.uRebondH = uRebond.h; sh.uniforms.uRebondPart = { value: part };
      sh.vertexShader = 'varying float vHaut;\n' + sh.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\n  vHaut = (modelMatrix * vec4(transformed, 1.0)).y;');
      sh.fragmentShader = 'varying float vHaut;\nuniform vec3 uRebondFond, uRebondPied;\nuniform float uRebondH, uRebondPart;\n' +
        sh.fragmentShader
          .replace('#include <lights_phong_pars_fragment>', prof ? T.ShaderChunk.lights_phong_pars_fragment
            .replace('float dotNL = saturate( dot( geometry.normal, directLight.direction ) );',
                     'float dotNL = 1.0 - pow( 1.0 - saturate( dot( geometry.normal, directLight.direction ) ), ' + R.diffExp.toFixed(3) + ' );')
            : '#include <lights_phong_pars_fragment>')
          .replace('#include <lights_fragment_begin>', T.ShaderChunk.lights_fragment_begin
            .split('directionalLightShadow.shadowRadius').join('directionalLightShadow.shadowRadius * ' + flou.toFixed(2)))
          .replace('#include <lights_fragment_end>',
            (prof ? 'float dVue = length(vViewPosition);\n' +
                    'vec3 kInd = dVue < uProfD.y ? mix(uProfPres, uProfMi, clamp((dVue - uProfD.x) / (uProfD.y - uProfD.x), 0.0, 1.0))\n' +
                    '                            : mix(uProfMi, uProfLoin, clamp((dVue - uProfD.y) / (uProfD.z - uProfD.y), 0.0, 1.0));\n' +
                    'float kPied = clamp(1.0 - (dVue - uProfPied.x) / uProfPied.y, 0.0, 1.0);\n' +
                    'irradiance *= kInd;\n'
                  : 'vec3 kInd = vec3(1.0); float kPied = 1.0;\n') +
            'irradiance += PI * uRebondPart * (uRebondFond * kInd + uRebondPied * kPied * exp(-max(vHaut, 0.0) / uRebondH));\n#include <lights_fragment_end>');
      sh.uniforms.uProfPres = uRebond.pres; sh.uniforms.uProfMi = uRebond.mi; sh.uniforms.uProfLoin = uRebond.loin;
      sh.uniforms.uProfD = uRebond.profD; sh.uniforms.uProfPied = uRebond.profPied;
      sh.fragmentShader = 'uniform vec3 uProfPres, uProfMi, uProfLoin, uProfD;\nuniform vec2 uProfPied;\n' + sh.fragmentShader;
    };
    // même fonction pour les trois matières : sans clé propre, three réutiliserait le programme de la première
    m.customProgramCacheKey = function () { return 'rebond:' + part + ':' + flou + ':' + (prof ? 1 : 0); };
    return m;
  }
  var mColonne = avecRebond(mat(C.platre, txPlatre), 1.0, 1.0, true), mSol = avecRebond(mat(C.sol, txSol), 0.0, R.flouSol),
      mMur = avecRebond(mat(C.mur, txPlatre), C.rebondMur, R.flouMur), mPlafond = mat(C.plafond, txPlatre);
  // La passe d'ombre ne dessine que les faces qui tournent le dos au soleil : un ruban
  // à une seule face (la dalle) doit être déclaré double pour porter une ombre.
  mPlafond.shadowSide = T.DoubleSide;

  /* ---------- géométrie : tout est posé sur un arc de cercle, centre à l'origine ----------
     Point d'abscisse curviligne s (mesurée sur l'axe des colonnes), de rayon r, de hauteur y :
     (r·sin φ, y, −r·cos φ), φ = s/Rp. Au départ (φ = 0) on avance vers +x et le centre est à +z,
     à DROITE : la galerie tourne à droite. Les colonnes (r = Rp) sont à gauche, le mur (r = Rw) à droite. */
  var Rp = R.Rp, Rc = Rp - R.a, Rw = Rc - R.b, Rext = Rp + R.seuil, Rdalle = Rp + R.debord;
  function phi(s) { return s / Rp; }
  function P(r, s, y, out) { var f = phi(s); return (out || new T.Vector3()).set(r * Math.sin(f), y, -r * Math.cos(f)); }

  // Ruban (sol, mur, dalle) : suite de quadrilatères entre deux courbes paramétrées par s
  function ruban(fnA, fnB, sMin, sMax, seg, matiere, uvScale) {
    var n = Math.ceil((sMax - sMin) / seg), pos = [], uv = [], idx = [], A = new T.Vector3(), B = new T.Vector3();
    for (var i = 0; i <= n; i++) {
      var s = sMin + (sMax - sMin) * i / n;
      fnA(s, A); fnB(s, B);
      pos.push(A.x, A.y, A.z, B.x, B.y, B.z);
      uv.push(s, 0, s, uvScale);
      if (i < n) { var k = 2 * i; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    return new T.Mesh(g, matiere);
  }
  // Sol : de Rw au seuil extérieur. Les UV suivent l'arc : les dalles aussi.
  var sol = ruban(function (s, o) { P(Rw, s, 0, o); }, function (s, o) { P(Rext, s, 0, o); },
                  R.sMin, R.sMax, R.seg, mSol, Rext - Rw);
  sol.receiveShadow = true; scene.add(sol);
  // Mur intérieur, de la dalle au sol — dans cet ordre : la normale du ruban est
  // avant × (B − A), il faut qu'elle regarde vers l'extérieur (la caméra, le soleil).
  var mur = ruban(function (s, o) { P(Rw, s, R.Hc + R.ep, o); }, function (s, o) { P(Rw, s, 0, o); },
                  R.sMin, R.sMax, R.seg, mMur, R.Hc + R.ep);
  mur.receiveShadow = true; scene.add(mur);
  // Dessous de dalle (du mur au débord) : c'est lui qui porte l'ombre en biais sur le mur
  var plafond = ruban(function (s, o) { P(Rdalle, s, R.Hc, o); }, function (s, o) { P(Rw, s, R.Hc, o); },
                      R.sMin, R.sMax, R.seg, mPlafond, Rdalle - Rw);
  plafond.castShadow = true; plafond.receiveShadow = true; scene.add(plafond);
  // Face extérieure de la dalle (vue de dehors seulement, mais elle ferme le volume)
  var fascia = ruban(function (s, o) { P(Rdalle, s, R.Hc + R.ep, o); }, function (s, o) { P(Rdalle, s, R.Hc, o); },
                     R.sMin, R.sMax, R.seg * 2, mPlafond, R.ep);
  fascia.castShadow = true; scene.add(fascia);

  // Colonne : superellipse (n = 2 → cylindre) à 24 pans, normales analytiques, UV en mètres
  function geoColonne(rayon, n, haut, pans) {
    var pos = [], nrm = [], uv = [], idx = [], e = 2 / n, en = 2 - e;
    function f(t) { var c = Math.cos(t), s = Math.sin(t);
      return [Math.sign(c) * Math.pow(Math.abs(c), e), Math.sign(s) * Math.pow(Math.abs(s), e),
              Math.sign(c) * Math.pow(Math.abs(c), en), Math.sign(s) * Math.pow(Math.abs(s), en)]; }
    for (var i = 0; i <= pans; i++) {
      var t = 1.5 * Math.PI + 2 * Math.PI * i / pans;    // couture (i = 0) sur la face extérieure (−z local) : jamais vue de dedans
      var q = f(t), x = rayon * q[0], z = rayon * q[1], nx = q[2], nz = q[3], L = Math.hypot(nx, nz);
      pos.push(x, 0, z, x, haut, z); nrm.push(nx / L, 0, nz / L, nx / L, 0, nz / L);
      var u = rayon * 2 * Math.PI * i / pans; uv.push(u, 0, u, haut);
      if (i < pans) { var k = 2 * i; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }
  var gColonne = geoColonne(R.D / 2, R.nSup, R.Hc + 0.02, 24);
  var colonnes = [];
  for (var i = 0, s = 0; i < Math.round(R.sMax / R.pas); i++, s = i * R.pas) {
    var c = new T.Mesh(gColonne, mColonne);
    P(Rp, s, 0, c.position);
    c.rotation.y = -phi(s);              // la couture reste tournée vers l'extérieur
    c.castShadow = true; c.receiveShadow = true;
    c.userData.s = s;
    scene.add(c); colonnes.push(c);
  }
  // Ailettes d'ombre (v5) : dans la référence, les barres d'ombre du sol et du mur sont PLUS LARGES que les
  // barres de lumière (≈ 1,5 : 1), alors qu'un pilier de 0,60 tous les 2,20 n'en donne que 0,4 : 1 — et ce
  // sont les piliers vus (bords, fentes) qui fixent 0,60 et 2,20. Chaque pilier porte donc, côté mur et vers
  // l'avant, une lame verticale qui n'existe que pour l'ombre : elle n'écrit ni couleur ni profondeur (la passe
  // d'ombre, elle, la voit : son matériau de profondeur ne garde que « visible »). NB r128 teste les calques de la
  // caméra PRINCIPALE dans la passe d'ombre : un calque à part ne marcherait pas. Elle part de l'intérieur du fût, ne peut donc ombrer aucune face éclairée du pilier, et
  // allonge seulement son ombre portée vers l'arrière, là où le pilier lui-même la cache au pied.
  if (R.ailette > 0) {
    // lame à deux paliers (polygone convexe, en éventail depuis le pied) : plus longue en bas, où passent les
    // rayons qui éclairent le sol, que dans le haut, où passent ceux qui éclairent le mur. Un raccord de 0,3 m.
    var x0 = 0, xB = R.D / 2 + R.ailette, xH = R.D / 2 + R.ailetteHaut, h1 = R.hAilette - 0.15, h2 = R.hAilette + 0.15, hA = R.Hc;
    var gAilette = new T.BufferGeometry();
    gAilette.setAttribute('position', new T.Float32BufferAttribute(
      [x0, 0, 0, xB, 0, 0, xB, h1, 0, xH, h2, 0, xH, hA, 0, x0, hA, 0], 3));
    gAilette.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5]);
    var mAilette = new T.MeshBasicMaterial({ side: T.DoubleSide, colorWrite: false, depthWrite: false });
    colonnes.forEach(function (c) {
      var a = new T.Mesh(gAilette, mAilette);
      P(Rp - R.D * 0.12, c.userData.s, 0, a.position);
      a.rotation.y = -phi(c.userData.s);   // +x local = vers l'avant le long de l'arc
      a.castShadow = true;
      scene.add(a);
    });
  }

  /* ---------- lumière ---------- */
  // Ciel : en haut le ciel vu du sol, en bas tout ce qui renvoie (sol et mur ensoleillés).
  var ciel = new T.HemisphereLight(lin3(C.ciel), lin3(C.sousCiel), 1.0);
  scene.add(ciel);
  // Le soleil EN PREMIER : seules les premières lumières directionnelles portent une ombre.
  var soleil = new T.DirectionalLight(lin3(C.soleil), 1.0);
  soleil.castShadow = true;
  soleil.shadow.mapSize.set(R.carte, R.carte);
  soleil.shadow.bias = -0.0004;
  soleil.shadow.normalBias = 0.03;
  soleil.shadow.radius = R.penombre;
  var sc = soleil.shadow.camera;
  sc.left = -23; sc.right = 23; sc.top = 11; sc.bottom = -11; sc.near = 40; sc.far = 170;
  sc.updateProjectionMatrix();
  scene.add(soleil); scene.add(soleil.target);
  // (v4 avait ici un « rebond » directionnel venu d'en bas ; il est remplacé par le renvoi au pied des
  //  piliers ci-dessus, qui ne dessine pas de second liseré clair à droite des fûts.)

  // Direction du soleil, fixe dans le monde, définie dans le repère de la galerie en s = 0 :
  // extérieur = (0,0,−1), avant = (1,0,0). azim > 0 : le soleil vient aussi de l'avant.
  var S = new T.Vector3();
  function soleilVers(elev, azim) {
    var ce = Math.cos(elev * DEG);
    S.set(Math.sin(azim * DEG) * ce, Math.sin(elev * DEG), -Math.cos(azim * DEG) * ce);
    return S;
  }

  /* ---------- cadrage ---------- */
  // Verticales verticales : visée horizontale et cadre décalé (décentrement), jamais de bascule.
  var cadre = { hfov: R.hfov, psi: R.psi, dy: 0.0, a: 0 };
  function cadrer() {
    var a = W / H; cadre.a = a;
    var k = Math.max(0, Math.min(1, (a - 0.50) / (1.30 - 0.50)));   // 0 = portrait (téléphone), 1 = paysage
    // Paysage : 25° de champ horizontal, lacet 8° vers le mur (mesurés sur la référence).
    // Portrait : on ouvre un peu (28°), on regarde un peu plus le long des colonnes (6°) et on
    // abaisse l'horizon (dy > 0 : plus de sol) pour garder les barres de lumière dans le cadre.
    cadre.hfov = 25 + 3 * (1 - k);
    cadre.psi = R.psi - 2 * (1 - k);
    cadre.dy = R.dyPaysage * k + R.dyPortrait * (1 - k);
    var vfov = 2 * Math.atan(Math.tan(cadre.hfov / 2 * DEG) / a) / DEG;
    cam.fov = vfov; cam.aspect = a;
    cam.setViewOffset(W, H, 0, Math.round(H * cadre.dy), W, H);
    cam.updateProjectionMatrix();
  }
  cadrer();

  /* ---------- mouvement ---------- */
  var pos = new T.Vector3(), visee = new T.Vector3(), cible = new T.Vector3();
  var avant = new T.Vector3(), droite = new T.Vector3(), tmp = new T.Vector3();
  var axeX = new T.Vector3(), axeY = new T.Vector3(), haut = new T.Vector3(0, 1, 0);
  function avancee(t) {
    // sans fin : la galerie est un anneau complet, on repart du même point après un tour (≈ 79 min)
    return (R.v * t) % R.sMax;
  }
  function poser(t) {
    var sC = R.s0 + avancee(t), f = phi(sC);
    var y = R.h + 0.012 * Math.sin(2 * Math.PI * t / 230);
    P(Rc, sC, y, pos);
    avant.set(Math.cos(f), 0, Math.sin(f)); droite.set(-Math.sin(f), 0, Math.cos(f));
    var lac = (cadre.psi + 0.15 * Math.sin(2 * Math.PI * t / 300)) * DEG;
    visee.copy(pos).addScaledVector(avant, 60 * Math.cos(lac)).addScaledVector(droite, 60 * Math.sin(lac));
    cam.position.copy(pos); cam.lookAt(visee);

    // soleil : hauteur qui respire de ±0,8° en 170 s ; direction fixe dans le monde
    soleilVers(R.elev + 0.8 * Math.sin(2 * Math.PI * t / 170), R.azim);
    // Le soleil suit la galerie : sans cela, à 7,5 cm/s sur un rayon de 56 m, il tournerait de 4,6° par minute et ne
    // viendrait plus de la gauche au bout de quelques minutes. Rotation autour de la verticale, de −Δφ.
    S.applyAxisAngle(haut, -(phi(sC) - phi(R.s0)));
    P(Rc, sC + 17, 3.0, cible);                 // la boîte d'ombre suit la caméra…
    // … par pas entiers de texel, mesurés dans le plan de la carte d'ombre : la grille des texels reste
    // fixe dans le monde quand la caméra avance, la pénombre ne grésille pas (ni les bords nets).
    axeX.crossVectors(haut, S).normalize(); axeY.crossVectors(S, axeX);
    var px = cible.dot(axeX), py = cible.dot(axeY), tx = (sc.right - sc.left) / R.carte, ty = (sc.top - sc.bottom) / R.carte;
    cible.addScaledVector(axeX, Math.round(px / tx) * tx - px).addScaledVector(axeY, Math.round(py / ty) * ty - py);
    soleil.target.position.copy(cible);
    soleil.position.copy(cible).addScaledVector(S, 100);
  }

  /* ---------- boucle ---------- */
  var raf = 0, nIps = 0, tIps = 0, pret = false;
  function dessiner(ms) {
    raf = 0;
    var t = calme ? FIGE : FIGE + ((ms || performance.now()) - t0) / 1000;
    poser(t);
    rendu.render(scene, cam);
    if (!pret) { pret = true; hote.classList.add('pret'); }   // le ciel CSS prend le relais de l'image fixe
    window.__triangles = rendu.info.render.triangles;
    nIps++;
    var m = ms || performance.now();
    if (!tIps) tIps = m;
    else if (m - tIps > 1000) { window.__ips = Math.round(nIps * 1000 / (m - tIps)); nIps = 0; tIps = m; }
    if (!calme) raf = requestAnimationFrame(dessiner);
  }
  function redimensionner() {
    var w = hote.clientWidth, h = hote.clientHeight;
    if (!w || !h || (w === W && h === H)) return;
    W = w; H = h; rendu.setSize(W, H); cadrer();
    if (calme && !raf) raf = requestAnimationFrame(dessiner);
  }
  addEventListener('resize', redimensionner);
  if (window.ResizeObserver) new ResizeObserver(redimensionner).observe(hote);
  window.__R = R;
  // sonde de cadrage (bancs) : horizon, pied et silhouette de chaque pilier à l'écran, en px CSS
  window.__geo = function () {
    var v = new T.Vector3(), out = { horizon: null, piliers: [] };
    function ecran(p) { v.copy(p).project(cam); return [Math.round((v.x + 1) / 2 * W), Math.round((1 - v.y) / 2 * H), v.z]; }
    out.horizon = ecran(tmp.copy(pos).addScaledVector(avant, 5000))[1];
    colonnes.forEach(function (c) {
      var s = c.userData.s, b = ecran(P(Rp, s, 0, new T.Vector3()));
      if (b[2] > 1 || b[2] < -1) return;
      var xs = [];
      for (var k = 0; k < 24; k++) { var q = P(Rp, s, 3.0, new T.Vector3()), f = phi(s), t = 2 * Math.PI * k / 24;
        q.x += R.D / 2 * Math.cos(t); q.z += R.D / 2 * Math.sin(t); xs.push(ecran(q)[0]); }
      var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
      if (x1 < 0 || x0 > W) return;
      out.piliers.push({ s: +s.toFixed(1), d: +c.position.distanceTo(cam.position).toFixed(1), xg: x0, xd: x1, pied: b[1] });
    });
    return out;
  };
  raf = requestAnimationFrame(dessiner);
})();
