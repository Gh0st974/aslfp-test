// ================================
//   HEADER SCROLL
// ================================
const headerEl = document.querySelector('.header');

window.addEventListener('scroll', () => {
  if (!headerEl) return;
  if (window.scrollY > 50) {
    headerEl.classList.add('header-scrolled');
  } else {
    headerEl.classList.remove('header-scrolled');
  }
});

// ================================
//   BURGER MENU
// ================================
const burger = document.querySelector('.burger');
const mobileNav = document.querySelector('.mobile-nav');

if (burger && mobileNav) {
  burger.addEventListener('click', () => {
    burger.classList.toggle('burger-open');
    mobileNav.classList.toggle('nav-open');
  });

  mobileNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      burger.classList.remove('burger-open');
      mobileNav.classList.remove('nav-open');
    });
  });
}

// ================================
//   GOOGLE SHEETS → ÉVÉNEMENTS
// ================================
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT5jflm0IqE_tgbyVcAhcg3WsDwFVu3P09KV3YzXSHk5qR2tyFvxxlKYPqlO4ea8pCWQ0DmCUjRiV3N/pub?output=csv';

// Couleurs par type d'événement
const TYPE_COLORS = {
  competition:  '#e74c3c',
  entrainement: '#3498db',
  sortie:       '#2ecc71',
  tournoi:      '#f39c12',
  important:    '#9b59b6',
  default:      '#6366f1'
};

// Emojis par sport
const SPORT_ICONS = {
  badminton:    '🏸',
  basketball:   '🏀',
  volleyball:   '🏐',
  football:     '⚽',
  handball:     '🤾',
  tennis:       '🎾',
  natation:     '🏊',
  athletisme:   '🏃',
  vtt:          '🚵',
  escalade:     '🧗',
  musculation:  '💪',
  default:      '🏅'
};

// Parse le CSV en tableau d'objets
function parseCSV(csv) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

  return lines.slice(1).map(line => {
    // Gestion des virgules dans les champs entre guillemets
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] || '';
    });
    return obj;
    }).filter(row => row.titre && row.debut);
}

// Convertit une ligne du Sheet en objet événement
function sheetRowToEvent(row) {
  const type = (row.type || 'default').toLowerCase().trim();
  const color = TYPE_COLORS[type] || TYPE_COLORS.default;

  // Construire l'horaire à partir de horaire_debut et horaire_fin
  let horaire = '';
  if (row.horaire_debut) {
    horaire = row.horaire_debut;
    if (row.horaire_fin) horaire += ' - ' + row.horaire_fin;
  }

  const event = {
    title: row.titre,
    start: row.debut,
    color: color,
    extendedProps: {
      description: row.description || '',
      type: type,
      lieu: row.lieu || '',
      horaire: horaire,
      inscription: (row.inscription || '').toLowerCase() === 'oui',
      formUrl: row.formUrl || ''
    }
  };

  if (row.fin) event.end = row.fin;

  return event;
}


// Fetch les données du Google Sheet
async function fetchSheetEvents() {
  try {
    const response = await fetch(SHEET_CSV_URL);
    if (!response.ok) throw new Error('Erreur réseau');
    const csv = await response.text();
    const rows = parseCSV(csv);
    return rows.map(sheetRowToEvent);
  } catch (err) {
    console.error('Erreur chargement Google Sheet:', err);
    return [];
  }
}

// ================================
//   CALENDRIER (FullCalendar)
// ================================
const calendarEl = document.getElementById('calendar');
let calendar = null;

if (calendarEl) {
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'fr',
    firstDay: 1,
    height: 'auto',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,listWeek'
    },
    buttonText: {
      today: "Aujourd'hui",
      month: 'Mois',
      list: 'Liste'
    },
    events: [], // sera rempli dynamiquement
    eventClick: function(info) {
      info.jsEvent.preventDefault();
      const props = info.event.extendedProps;

      let details = `📌 ${info.event.title}\n`;
      if (props.description) details += `\n📝 ${props.description}`;
      if (props.lieu) details += `\n📍 ${props.lieu}`;
      if (props.horaire) details += `\n🕐 ${props.horaire}`;
      if (props.type) details += `\n🏷️ Type : ${props.type}`;
      if (props.inscription && props.formUrl) {
        details += `\n\n✅ Inscription ouverte !`;
        if (confirm(details + '\n\nVoulez-vous ouvrir le formulaire ?')) {
          window.open(props.formUrl, '_blank');
        }
        return;
      }
      alert(details);
    }
  });
}

// ================================
//   PROCHAINS ÉVÉNEMENTS (sidebar)
// ================================
const DELTA_DAYS = 15;

function toUtcDateOnly(d) {
  const dt = (d instanceof Date) ? d : new Date(d);
  return Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
}

function daysUntil(date) {
  const todayUtc = toUtcDateOnly(new Date());
  const targetUtc = toUtcDateOnly(date);
  return Math.ceil((targetUtc - todayUtc) / (24 * 60 * 60 * 1000));
}

function displayUpcomingEventsWithCTA(events) {
  const container = document.getElementById('upcoming-events');
  if (!container) return;

  // Date d'aujourd'hui en format string YYYY-MM-DD (local)
  const now = new Date();
  const todayStr = now.getFullYear() + '-' + 
    String(now.getMonth() + 1).padStart(2, '0') + '-' + 
    String(now.getDate()).padStart(2, '0');

  console.log('🔍 Date aujourdhui:', todayStr);

  // Filtrer les événements futurs en comparant les STRINGS (pas de Date())
  const futureEvents = events
    .filter(ev => {
      console.log('  🔎 Comparaison:', ev.title, ev.start, '>=', todayStr, '→', ev.start >= todayStr);
      return ev.start >= todayStr;
    })
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 3);

  console.log('🔍 Événements futurs trouvés:', futureEvents.length);

  if (futureEvents.length === 0) {
    container.innerHTML = '<p style="color:#888;">Aucun événement à venir.</p>';
    return;
  }

  container.innerHTML = '';

  futureEvents.forEach(ev => {
    // Parser la date SANS problème de timezone
    const [year, month, day] = ev.start.split('-').map(Number);
    const evDate = new Date(year, month - 1, day);
    const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((evDate - todayLocal) / (1000 * 60 * 60 * 24));

    // 👇 AJOUTE CES LIGNES
  console.log('--- Événement:', ev.title);
  console.log('    diffDays:', diffDays);
  console.log('    extendedProps:', ev.extendedProps);
  console.log('    formUrl:', ev.extendedProps?.formUrl);
  console.log('    hasFormUrl:', ev.extendedProps?.formUrl && ev.extendedProps.formUrl.trim() !== '');
  console.log('    condition bouton:', ev.extendedProps?.formUrl && diffDays <= DELTA_DAYS);
    
    const type = (ev.extendedProps?.type || '').toLowerCase();
    const isCompetition = type.startsWith('comp');
    const hasFormUrl = ev.extendedProps?.formUrl && ev.extendedProps.formUrl.trim() !== '';

    const bulletColor = isCompetition ? '#e74c3c' : '#3498db';
    const bulletIcon = isCompetition ? '🏆' : 'ℹ️';

    const dateStr = evDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

    // Utiliser l'horaire déjà construit dans sheetRowToEvent
    const horaire = ev.extendedProps?.horaire || '';
    const horaireStr = horaire ? `🕐 ${horaire}` : '';

    const lieu = ev.extendedProps?.lieu || '';
    const lieuStr = lieu ? `📍 ${lieu}` : '';

    let countdownStr = '';
    if (diffDays === 0) countdownStr = "⏳ Aujourd'hui !";
    else if (diffDays === 1) countdownStr = "⏳ Demain !";
    else countdownStr = `⏳ Dans ${diffDays} jours`;

    let btnHtml = '';
    if (hasFormUrl && diffDays <= DELTA_DAYS) {
      btnHtml = `<a href="${ev.extendedProps.formUrl}" target="_blank" class="btn-inscription">S'inscrire</a>`;
    }

    const card = document.createElement('div');
    card.className = `upcoming-event-card type-${type.replace(/\s+/g, '-')}`;
    card.innerHTML = `
  <span class="upcoming-event-date">${dateStr}</span>
  <strong class="upcoming-event-title">${bulletIcon} ${ev.title}</strong>
  <div class="upcoming-event-details">
    <div class="upcoming-event-type-row">
      <span style="color:${bulletColor}; font-weight:bold;">${isCompetition ? 'Compétition' : type}</span>
      <span class="upcoming-event-countdown">${countdownStr}</span>
    </div>
    ${lieuStr ? `<span>${lieuStr}</span>` : ''}
    ${horaireStr ? `<span>${horaireStr}</span>` : ''}
  </div>
  ${btnHtml}
`;

    container.appendChild(card);
  });
}



// ================================
//   SCROLL REVEAL
// ================================
function initRevealAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });

  const revealElements = document.querySelectorAll(
    '.activite-card, .section-title, .underline, .inscription-intro, .inscription-cta, .galerie-intro, .contact-container'
  );
  revealElements.forEach(el => {
    el.classList.add('fade-up');
    observer.observe(el);
  });
}

// ================================
//   GALERIE SWIPER
// ================================
function initSwiper() {
  const swiperEl = document.querySelector('.mySwiper');
  if (swiperEl) {
    new Swiper('.mySwiper', {
      loop: true,
      autoplay: {
        delay: 4000,
        disableOnInteraction: false,
        pauseOnMouseEnter: true,
      },
      speed: 600,
      grabCursor: true,
      effect: 'slide',
      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      },
      pagination: {
        el: '.swiper-pagination',
        clickable: true,
      },
      keyboard: { enabled: true },
    });
  }
}

// ================================
//   INIT — TOUT DÉMARRE ICI
// ================================
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Charger les événements depuis Google Sheets
  const sheetEvents = await fetchSheetEvents();
  console.log('📅 Événements chargés:', sheetEvents.length);

  // 2. Ajouter au calendrier et afficher
  if (calendar) {
    sheetEvents.forEach(ev => calendar.addEvent(ev));
    calendar.render();
  }

 // 3. Afficher les prochains événements
displayUpcomingEventsWithCTA(sheetEvents);


  // 4. Animations
  initRevealAnimations();

  // 5. Swiper galerie
  initSwiper();
});


