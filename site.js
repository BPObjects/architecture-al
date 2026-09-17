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
  // Une vue par image dans une piste à accroche horizontale (voir site.css) : glisser au doigt ou au pavé tactile est le
  // défilement natif du navigateur. Le script suit la position (compteur, chargement des voisines), pilote la piste aux
  // boutons et au clavier, et garde l'image visée quand le navigateur la déplace (accroche en cours, rotation).
  // Relu le 17/09 par une revue croisée (iOS Safari, logique d'état, accessibilité) : scénarios dans le scratchpad glisser/.
  var liens = document.querySelectorAll('[data-galerie]');
  var visionneuse = document.querySelector('.visionneuse');
  var piste = visionneuse && visionneuse.querySelector('.visionneuse__piste');
  if (liens.length && piste && typeof visionneuse.showModal === 'function') {
    var compteur = visionneuse.querySelector('.visionneuse__compteur');
    var images = [], courant = 0, retour = null, largeur = 0, attente = 0;
    // dest : image où la piste doit se poser (ouverture, bouton, clavier, rotation) ; -1 quand c'est la position qui fait
    // foi (doigt, pavé tactile). Tant qu'elle est en attente, le compteur reste sur elle : l'accroche native qui suit un
    // glisser, ou le recalage de Chrome après une rotation, peuvent ramener la piste ailleurs ; on la ré-applique au repos.
    var dest = -1, essais = 0, doigt = false, repos = 0, corrige = false;
    // largeur exacte (fractionnaire) : clientWidth arrondi décalerait le calcul des positions d'accroche
    var mesurer = function () { return piste.getBoundingClientRect().width; };
    // page zoomée au pincement : le doigt sert à se déplacer dans la photo, le script ne s'en mêle pas
    var zoomee = function () { return !!window.visualViewport && window.visualViewport.scale > 1.01; };
    piste.tabIndex = -1; // hors de l'ordre de tabulation : le clavier passe par les flèches et les boutons
    chaque(liens, function (a) {
      var vue = document.createElement('figure');
      vue.className = 'visionneuse__vue';
      var img = document.createElement('img');
      img.alt = a.querySelector('img').alt;
      img.decoding = 'async';
      vue.appendChild(img);
      piste.appendChild(vue);
      images.push(img);
    });
    if (liens.length < 2) visionneuse.classList.add('visionneuse--seule');
    var reduit = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    var charger = function (i) {
      var k = (i + liens.length) % liens.length;
      if (!images[k].getAttribute('src')) images[k].src = liens[k].getAttribute('href');
    };
    var noter = function (i) {
      courant = i;
      compteur.textContent = (i + 1) + ' / ' + liens.length;
      charger(i); charger(i + 1); charger(i - 1);
    };
    // Au repos (plus de défilement depuis 150 ms, aucun doigt posé) :
    // - une destination en attente est vérifiée, et ré-appliquée si la piste n'y est pas (3 fois au plus) ;
    // - sans destination, un reste de quelques pixels est recalé sur l'image la plus proche (Chrome en laisse quand un
    //   saut interrompt une animation). Au-delà de 12 px, c'est un geste en pause (doigts posés sur le pavé tactile) :
    //   on n'y touche pas, le navigateur accrochera à la fin du geste.
    var auRepos = function () {
      clearTimeout(repos);
      repos = setTimeout(function () {
        if (!visionneuse.open || doigt || !largeur) return;
        if (dest >= 0) {
          if (Math.abs(piste.scrollLeft - dest * largeur) < 1) { dest = -1; return; }
          if (essais++ < 3) {
            piste.scrollTo({ left: dest * largeur, behavior: 'auto' });
            auRepos(); // si rien ne défile, le repos suivant revérifie quand même
            return;
          }
          dest = -1; // le navigateur ne s'y pose pas : la position reprend la main
        }
        var i = Math.max(0, Math.min(liens.length - 1, Math.round(piste.scrollLeft / largeur)));
        if (i !== courant) noter(i);
        var ecart = Math.abs(piste.scrollLeft - i * largeur);
        if (!corrige && ecart >= 1 && ecart < 12) {
          corrige = true;
          piste.scrollTo({ left: i * largeur, behavior: 'auto' });
        }
      }, 150);
    };
    var viser = function (i, anime) {
      dest = i; essais = 0; corrige = false;
      largeur = mesurer();
      piste.scrollTo({ left: i * largeur, behavior: anime ? 'smooth' : 'auto' });
      auRepos(); // déjà en place, aucun défilement ne viendra : le repos lève quand même la destination
    };
    // se placer sur l'image i ; animé d'une image à sa voisine, instantané pour un saut (ouverture, bouclage)
    var montrer = function (i, anime) {
      i = (i + liens.length) % liens.length;
      var voisine = Math.abs(i - courant) === 1;
      noter(i);
      viser(i, anime && voisine && !reduit.matches);
    };
    // la vue a changé de largeur (rotation du téléphone, fenêtre) : revenir sur l'image visée, ou sur la courante
    var recaler = function () {
      if (!visionneuse.open || Math.abs(mesurer() - largeur) < 0.5) return;
      viser(dest >= 0 ? dest : courant, false);
    };
    piste.addEventListener('scroll', function () {
      auRepos();
      if (attente) return;
      attente = requestAnimationFrame(function () {
        attente = 0;
        if (!visionneuse.open) return;
        if (Math.abs(mesurer() - largeur) >= 0.5) { recaler(); return; }
        if (dest >= 0 || !largeur) return;
        var i = Math.round(piste.scrollLeft / largeur);
        if (i >= 0 && i < liens.length && i !== courant) noter(i);
      });
    }, { passive: true });
    // Le doigt, le stylet ou un défilement horizontal reprend la main : la position redevient la référence. Un clic de
    // souris ou une molette verticale ne font pas défiler la piste : ils ne lèvent pas la destination.
    ['touchstart', 'wheel', 'pointerdown'].forEach(function (type) {
      piste.addEventListener(type, function (e) {
        if (e.type === 'pointerdown' && e.pointerType === 'mouse' && e.button !== 1) return;
        if (e.type === 'wheel' && Math.abs(e.deltaX) <= Math.abs(e.deltaY) && !e.shiftKey) return;
        dest = -1;
        corrige = false;
        if (e.type === 'touchstart') doigt = true;
      }, { passive: true });
    });
    ['touchend', 'touchcancel'].forEach(function (type) {
      piste.addEventListener(type, function (e) {
        doigt = e.touches.length > 0;
        auRepos();
      }, { passive: true });
    });
    // Geste vers l'extérieur au bord de la piste (droite sur la première image, gauche sur la dernière) : rien ne peut
    // défiler, et Chrome en fait un retour à la page précédente, qu'overscroll-behavior n'empêche pas (vérifié le 17/09).
    // On l'annule, mais seulement une fois le geste lisible : décidé une fois pour toutes après 6 px depuis le point de
    // départ. iOS envoie dès le premier point de déplacement, et annuler ce tout premier touchmove y bloque le défilement
    // de tout le geste (revue du 17/09, source de WebKit) : un pouce qui part un peu de travers tuait le glisser.
    // Le défilement vertical de la page derrière est bloqué en CSS (html.visionneuse-ouverte), pas ici.
    var auBord = function (dx) {
      var max = piste.scrollWidth - piste.clientWidth;
      return (dx > 0 && piste.scrollLeft <= 0.5) || (dx < 0 && piste.scrollLeft >= max - 0.5);
    };
    var depart = null, bloque = null;
    visionneuse.addEventListener('touchstart', function (e) {
      depart = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
      bloque = null;
    }, { passive: true });
    visionneuse.addEventListener('touchmove', function (e) {
      if (!depart || e.touches.length !== 1 || zoomee()) { depart = null; return; }
      if (bloque === null) {
        var dx = e.touches[0].clientX - depart.x, dy = e.touches[0].clientY - depart.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return;
        bloque = Math.abs(dx) > Math.abs(dy) && (!piste.contains(e.target) || auBord(dx));
      }
      if (bloque && e.cancelable) e.preventDefault();
    }, { passive: false });
    // même chose au pavé tactile (glisser à deux doigts sur Mac) : deltaX < 0 pousse le contenu vers la droite
    visionneuse.addEventListener('wheel', function (e) {
      if (!zoomee() && Math.abs(e.deltaX) > Math.abs(e.deltaY) && auBord(-e.deltaX)) e.preventDefault();
    }, { passive: false });
    if (window.ResizeObserver) new ResizeObserver(recaler).observe(piste);
    else window.addEventListener('resize', recaler);
    chaque(liens, function (a, i) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        retour = a;
        document.documentElement.classList.add('visionneuse-ouverte');
        visionneuse.showModal(); // le focus va au bouton Fermer (autofocus)
        montrer(i, false);
      });
    });
    visionneuse.querySelector('[data-precedent]').addEventListener('click', function () { montrer(courant - 1, true); });
    visionneuse.querySelector('[data-suivant]').addEventListener('click', function () { montrer(courant + 1, true); });
    visionneuse.querySelector('[data-fermer]').addEventListener('click', function () { visionneuse.close(); });
    visionneuse.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); montrer(courant - 1, true); }
      if (e.key === 'ArrowRight') { e.preventDefault(); montrer(courant + 1, true); }
    });
    visionneuse.addEventListener('click', function (e) { if (e.target === visionneuse) visionneuse.close(); });
    visionneuse.addEventListener('close', function () {
      clearTimeout(repos); dest = -1; doigt = false;
      document.documentElement.classList.remove('visionneuse-ouverte');
      if (retour) retour.focus();
    });
  }

  // ——— Fiche : vidéo du projet, lecteur chargé au clic seulement (aucune requête vers YouTube avant) ———
  // Clic avec Cmd, Ctrl, Maj ou bouton du milieu : le lien garde son rôle et ouvre la vidéo sur YouTube.
  // Safari (iOS et macOS) ne compte pas le clic de la page comme un geste dans le lecteur : la lecture avec le son y est
  // refusée et il fallait toucher une seconde fois. On y lance donc la vidéo sans le son (bouton du lecteur pour l'activer).
  chaque(document.querySelectorAll('[data-video]'), function (bloc) {
    var lanceur = bloc.querySelector('.video__lanceur');
    if (!lanceur) return;
    lanceur.addEventListener('click', function (e) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      var cadre = document.createElement('iframe');
      cadre.title = bloc.getAttribute('data-titre');
      cadre.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      cadre.setAttribute('allowfullscreen', '');
      // YouTube refuse de lire un lecteur intégré sans référent : on le garde explicitement (origine seule)
      cadre.referrerPolicy = 'strict-origin-when-cross-origin';
      cadre.src = bloc.getAttribute('data-video') + (/Apple/.test(navigator.vendor || '') ? '&mute=1' : '');
      bloc.replaceChild(cadre, lanceur);
      cadre.focus();
    });
  });

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
