// Architecture-AL — comportements du site statique (projets.architecture-al.com)
// Reprend app.js de la maquette sans le routeur : chaque bloc ne s'active que si sa page le contient.
(function () {
  'use strict';
  var params = new URLSearchParams(location.search);
  // Textes : français par défaut ; une page d'une autre langue définit window.SITE_TEXTES avant ce script (voir /en/textes.js)
  var TX = Object.assign({
    modele_copie: 'Modèle copié : cliquez sur « Écrire à l’agence », puis collez-le dans le courriel.',
    modele_echec: 'La copie n’a pas fonctionné : recopiez les rubriques ci-dessus dans votre courriel.',
    carte_erreur: 'La carte n’a pas pu s’afficher sur cet appareil.'
  }, window.SITE_TEXTES || {});
  function chaque(liste, fn) { Array.prototype.forEach.call(liste, fn); }

  // ——— En-tête : menu mobile, filet au défilement ———
  var entete = document.querySelector('.entete');
  var nav = document.getElementById('nav');
  var menu = document.querySelector('.nav__menu');
  if (menu && nav) {
    menu.addEventListener('click', function () {
      var ouvert = nav.classList.toggle('ouvert');
      menu.setAttribute('aria-expanded', String(ouvert));
    });
  }
  if (entete) {
    var defile = function () { entete.classList.toggle('defile', window.scrollY > 4); };
    window.addEventListener('scroll', defile, { passive: true });
    defile();
  }

  // ——— Projets : filtres par programme, planche ou registre (?programme=log, ?vue=registre) ———
  var projets = document.querySelector('[data-projets]');
  if (projets) {
    var filtres = projets.querySelectorAll('[data-filtre]');
    var modes = projets.querySelectorAll('[data-mode]');
    var vues = projets.querySelectorAll('[data-vue]');
    var compte = projets.querySelector('[data-compte]');
    var cles = Array.prototype.map.call(filtres, function (b) { return b.dataset.filtre; });
    var prog = cles.indexOf(params.get('programme')) > 0 ? params.get('programme') : 'tous';
    var mode = params.get('vue');
    if (mode !== 'planche' && mode !== 'registre') {
      mode = null;
      try { mode = localStorage.getItem('al-vue'); } catch (e) {}
    }
    if (mode !== 'registre') mode = 'planche';

    var appliquer = function () {
      chaque(filtres, function (b) { b.setAttribute('aria-pressed', String(b.dataset.filtre === prog)); });
      chaque(modes, function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === mode)); });
      var visibles = 0, total = 0;
      chaque(vues, function (v) {
        v.hidden = v.dataset.vue !== mode;
        chaque(v.querySelectorAll('[data-prog]'), function (el) {
          var garde = prog === 'tous' || el.dataset.prog.split(' ').indexOf(prog) >= 0;
          el.hidden = !garde;
          if (v.dataset.vue === 'planche') { total++; if (garde) visibles++; }
        });
      });
      if (compte) compte.textContent = visibles + ' / ' + total;
      if (prog === 'tous') params.delete('programme'); else params.set('programme', prog);
      var chaine = params.toString();
      history.replaceState(null, '', location.pathname + (chaine ? '?' + chaine : ''));
    };
    chaque(filtres, function (b) {
      b.addEventListener('click', function () { prog = b.dataset.filtre; appliquer(); });
    });
    chaque(modes, function (b) {
      b.addEventListener('click', function () {
        mode = b.dataset.mode;
        try { localStorage.setItem('al-vue', mode); } catch (e) {}
        params.delete('vue'); // le choix mémorisé prend le relais du lien direct
        appliquer();
      });
    });
    appliquer();
  }

  // ——— L'agence : panneau de bio sous le rang de la personne, relié à sa photo par un trait orange ———
  var equipe = document.querySelector('.equipe');
  if (equipe) {
    var cartes = equipe.querySelectorAll('.membre');
    var panneaux = equipe.querySelectorAll('.bio');
    var relier = function () {
      var ouverte = equipe.querySelector('.membre[aria-expanded="true"]');
      var panneau = equipe.querySelector('.bio:not([hidden])');
      if (!ouverte || !panneau) return;
      // le panneau se place juste après le rang de la personne, quel que soit le nombre de colonnes
      var colonnes = getComputedStyle(equipe).gridTemplateColumns.split(' ').length || 1;
      var k = +ouverte.dataset.membre;
      var finDeRang = Math.min(cartes.length - 1, Math.ceil((k + 1) / colonnes) * colonnes - 1);
      chaque(cartes, function (c, i) { c.style.order = i * 2; });
      panneau.style.order = finDeRang * 2 + 1;
      var rb = ouverte.getBoundingClientRect(), rp = panneau.getBoundingClientRect();
      var trait = panneau.querySelector('.bio__trait');
      var haut = Math.max(0, rp.top - rb.bottom);
      trait.style.left = (rb.left + rb.width / 2 - rp.left) + 'px';
      trait.style.top = -haut + 'px';
      trait.style.height = haut + 'px';
    };
    var ouvrir = function (k) {
      var cible = equipe.querySelector('.bio[data-bio="' + k + '"]');
      var fermer = !!cible && !cible.hidden;
      chaque(panneaux, function (p) { p.hidden = true; });
      chaque(cartes, function (b) {
        b.setAttribute('aria-expanded', String(!fermer && b.dataset.membre === String(k)));
      });
      if (cible && !fermer) { cible.hidden = false; relier(); }
    };
    chaque(cartes, function (b) {
      b.addEventListener('click', function () { ouvrir(+b.dataset.membre); });
    });
    window.addEventListener('resize', relier);
    window.addEventListener('load', relier);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(relier);
    relier();
  }

  // ——— Fiche : visionneuse de la galerie (sans JS, chaque vignette ouvre l'image) ———
  var liens = document.querySelectorAll('[data-galerie]');
  var visionneuse = document.querySelector('.visionneuse');
  if (liens.length && visionneuse && typeof visionneuse.showModal === 'function') {
    var image = visionneuse.querySelector('img');
    var compteur = visionneuse.querySelector('.visionneuse__compteur');
    var courant = 0, retour = null;
    var montrer = function (i) {
      courant = (i + liens.length) % liens.length;
      var a = liens[courant];
      image.src = a.getAttribute('href');
      image.alt = a.querySelector('img').alt;
      compteur.textContent = (courant + 1) + ' / ' + liens.length;
    };
    chaque(liens, function (a, i) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        retour = a;
        montrer(i);
        visionneuse.showModal();
      });
    });
    visionneuse.querySelector('[data-precedent]').addEventListener('click', function () { montrer(courant - 1); });
    visionneuse.querySelector('[data-suivant]').addEventListener('click', function () { montrer(courant + 1); });
    visionneuse.querySelector('[data-fermer]').addEventListener('click', function () { visionneuse.close(); });
    visionneuse.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); montrer(courant - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); montrer(courant + 1); }
    });
    visionneuse.addEventListener('click', function (e) { if (e.target === visionneuse) visionneuse.close(); });
    visionneuse.addEventListener('close', function () { if (retour) retour.focus(); });
  }

  // ——— Contact : « Copier le modèle » met les rubriques dans le presse-papiers (le lien mailto n'en porte pas) ———
  var copier = document.querySelector('[data-modele]');
  var retourModele = document.querySelector('.ecrire__retour');
  if (copier && retourModele) {
    var ancienneCopie = function (texte) {
      var zone = document.createElement('textarea');
      zone.value = texte;
      zone.setAttribute('readonly', '');
      zone.style.position = 'fixed'; zone.style.opacity = '0';
      document.body.appendChild(zone);
      zone.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(zone);
      return ok;
    };
    var annoncer = function (ok) {
      retourModele.textContent = ok
        ? TX.modele_copie
        : TX.modele_echec;
    };
    copier.hidden = false;
    copier.addEventListener('click', function () {
      var texte = copier.getAttribute('data-modele');
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(texte).then(function () { annoncer(true); }, function () { annoncer(ancienneCopie(texte)); });
      } else {
        annoncer(ancienneCopie(texte));
      }
    });
  }

  // ——— Contact : maquette 3D par défaut, plan avec ?vue=plan ———
  var carte = document.getElementById('carte');
  if (carte && window.CARTE && window.QUARTIER) {
    try {
      CARTE.monter(carte, params.get('vue') === 'plan' ? 'plan' : '3d');
    } catch (e) {
      carte.innerHTML = '<p class="carte__erreur">' + TX.carte_erreur + '</p>';
    }
  }
})();
