'use strict';
/*
 * Historia de Hellfall: Survival.
 * - Introducción, escenas tras cada jefe y final (escenas saltables).
 * - Transmisiones de radio durante el combate (no pausan el juego).
 * - Registros de datos coleccionables (4 por sector) y expedientes de los jefes.
 * Todo se guarda en SaveManager.data.story y puede releerse desde el menú (ARCHIVO).
 */
(function (HF) {
  const U = HF.U;
  const $ = (id) => document.getElementById(id);

  /* ======================= PERSONAJES ======================= */
  const SPEAKERS = {
    varga: { name: 'DRA. ELENA VARGA', role: 'Directora científica · Proyecto Umbral', color: '#7fe0f0', portrait: 'portrait_varga' },
    reyes: { name: 'COMANDANTE REYES', role: '«Atalaya» · Mando de superficie', color: '#b8c870', portrait: 'portrait_reyes' },
    k7: { name: 'OPERADOR K-7', role: 'Unidad de Contención 7', color: '#7ff6ff', portrait: 'portrait_k7' },
    signal: { name: 'S̷E̷Ñ̷A̷L̷', role: 'Origen desconocido', color: '#ff4af0', portrait: 'portrait_signal' },
    archive: { name: 'ARCHIVO HELLFALL', role: 'Registro recuperado', color: '#3affaa', portrait: 'portrait_archive' },
  };

  /* ======================= ESCENAS ======================= */
  const INTRO = [
    { art: 'logo', title: 'COMPLEJO HELLFALL · 03:12', text: 'Bajo cuarenta metros de roca, el Proyecto Umbral intentaba abrir una puerta hacia una fuente de energía sin límite, al otro lado de la realidad.' },
    { art: 'boss_matriarch', title: 'LA BRECHA', text: 'La puerta se abrió. Algo la cruzó en sentido contrario. En once minutos, el complejo quedó sellado y en silencio.' },
    { art: 'player', title: 'UNIDAD DE CONTENCIÓN 7', text: 'Doce operadores descendieron para recuperar al personal. Seis horas después solo una baliza sigue transmitiendo: la tuya, K-7.' },
    { art: 'portrait_varga', speaker: 'varga', title: 'TRANSMISIÓN ENTRANTE', text: '«Si alguien me escucha… soy la doctora Varga. La Brecha sigue abierta y se está ensanchando. Tiene que llegar al Sector 0. Por favor. Es la única forma de cerrarla.»' },
  ];

  /** Escena al derrotar a cada jefe (se muestra durante la evacuación al siguiente sector). */
  const BOSS_SCENES = {
    herald: [
      { art: 'boss_herald', title: 'EL CARCELERO', text: 'Viktor Hale, jefe de seguridad, selló el Sector 7 con cuarenta y tres científicos dentro para impedir que la anomalía escapara. Fue el primero en exponerse. Hasta el final, siguió haciendo su ronda.' },
      { art: 'portrait_varga', speaker: 'varga', title: 'EVACUACIÓN', text: '«Hale… gracias, K-7. El montacargas de servicio baja a la Fundición. El calor allí es infernal, pero es el único camino hacia abajo.»' },
    ],
    forge: [
      { art: 'boss_forge', title: 'LA FORJA VIVIENTE', text: 'VULCANO-3 fundía el blindaje del reactor de Umbral. La anomalía aprendió a usarlo: fundió metal, escoria y a la cuadrilla de mantenimiento en un solo cuerpo. Fabricaba soldados para el otro lado.' },
      { art: 'portrait_reyes', speaker: 'reyes', title: 'EVACUACIÓN', text: '«Atalaya a K-7. Te tenemos en señal. Varga no te lo ha contado todo: ella dirigía Umbral. Bajo Criogenia está la cámara del director. Ten cuidado con lo que encuentres.»' },
    ],
    archon: [
      { art: 'boss_archon', title: 'ARCONTE DEL VACÍO', text: 'El director Ilyin Sarkov se encerró en una cápsula criogénica cuando la Brecha se abrió. No buscaba sobrevivir: esperaba despertar al otro lado. La anomalía cumplió su deseo… a medias.' },
      { art: 'portrait_varga', speaker: 'varga', title: 'EVACUACIÓN', text: '«Sí, yo dirigía el equipo. Yo calculé la frecuencia que la abrió. Te lo explicaré todo en el Sector 0. Ahora solo necesito que sigas con vida un poco más.»' },
    ],
    matriarch: [
      { art: 'boss_matriarch', title: 'NÚCLEO DE RUPTURA', text: 'No era una criatura. Era la herida misma: el borde vivo de la Brecha, que aprendió a defenderse con todo lo que la rodeaba.' },
    ],
  };

  const ENDING = [
    { art: 'boss_matriarch', title: 'EL NÚCLEO SE APAGA', text: 'El Núcleo de Ruptura se pliega sobre sí mismo. La Brecha se estrecha hasta convertirse en una línea de luz que vibra en el centro de la sala.' },
    { art: 'portrait_varga', speaker: 'varga', title: 'DRA. VARGA', text: '«Para cerrarse necesita un ancla al otro lado. Siempre lo supe, K-7. Yo la abrí. Lo justo es que sea yo quien la cierre desde dentro.»' },
    { art: 'portrait_signal', speaker: 'signal', title: 'SILENCIO', text: 'La señal de Varga se funde con la luz. Durante un segundo, todas las pantallas del complejo muestran la misma palabra: GRACIAS. Después, la Brecha desaparece.' },
    { art: 'portrait_reyes', speaker: 'reyes', title: 'ATALAYA', text: '«Atalaya a K-7. Las lecturas de la anomalía caen a cero. Buen trabajo, operador. Te sacamos de ahí.»' },
    { art: 'player', title: 'FIN… POR AHORA', text: 'Pero en las rejillas del Sector 7, algo sigue arañando el metal. Lo que cruzó la Brecha no se fue con ella. La partida continúa: la anomalía regresa más fuerte en cada vuelta al complejo.' },
  ];

  /* ======================= RADIO ======================= */
  // Mensajes por sector: al llegar y en oleadas concretas (relativas a la llegada al sector).
  const SECTOR_RADIO = {
    s7: {
      arrive: [['varga', 'K-7, ¿me recibes? Estás en el Sector 7. Salen de las rejillas de ventilación: no te alejes de la terminal central.']],
      waves: {
        2: [['reyes', 'Aquí Atalaya, mando de superficie. Tu escuadra no responde. Sobrevive y mantén la señal activa.']],
        5: [['varga', 'Cada cinco oleadas la terminal recibe suministros del montacargas. Úsala.']],
        7: [['varga', 'Los Errantes eran personal del laboratorio. No dudes. Ellos ya no pueden.']],
      },
    },
    foundry: {
      arrive: [['varga', 'La Fundición. No pises la escoria: atraviesa las botas en segundos.']],
      waves: {
        2: [['reyes', 'Detecto artillería en tu sector. Algo está usando los hornos para fabricar munición.']],
        6: [['varga', 'VULCANO-3 sigue encendido. Si la anomalía lo controla, ya sé de dónde salen los Colosos.']],
      },
    },
    cryo: {
      arrive: [['varga', 'Criogenia. Las fugas de refrigerante te frenarán: muévete por los pasillos entre las cápsulas.']],
      waves: {
        2: [['reyes', 'K-7, las cápsulas de este sector estaban ocupadas. Todas. Comprueba lo que te dispare por la espalda.']],
        6: [['varga', 'La cápsula del director está vacía. Sarkov no debería poder moverse… a menos que ya no sea Sarkov.']],
      },
    },
    rift: {
      arrive: [['varga', 'Sector 0. Estás en el borde de la Brecha. Aquí la realidad es más fina: no te quedes en las grietas.']],
      waves: {
        2: [['signal', 'V̷U̷E̷L̷V̷E̷ ̷A̷T̷R̷Á̷S̷']],
        5: [['varga', 'Puedo verte desde aquí, K-7. Estoy más cerca de lo que crees.']],
        8: [['reyes', 'Atalaya a K-7: la señal de Varga sale del interior del anillo. No hay forma humana de estar ahí.']],
      },
    },
  };
  const BOSS_RADIO = {
    herald: { spawn: [['varga', 'Esa firma… es Hale, el jefe de seguridad. Selló el sector con nosotros dentro. Sigue haciendo su ronda.']], final: [['signal', 'N̷A̷D̷I̷E̷ ̷S̷A̷L̷E̷']] },
    forge: { spawn: [['reyes', '¡Lectura térmica enorme! La anomalía ha tomado VULCANO-3. Esa cosa es la fundición entera.']], final: [['signal', 'T̷E̷ ̷F̷U̷N̷D̷I̷R̷É̷']] },
    archon: { spawn: [['varga', 'Sarkov… ¿qué te ha hecho? K-7, no mires a su ojo demasiado tiempo. Sus rayos avisan antes de disparar.']], final: [['signal', '¿̷C̷U̷Á̷L̷ ̷D̷E̷ ̷N̷O̷S̷O̷T̷R̷O̷S̷ ̷E̷S̷ ̷R̷E̷A̷L̷?̷']] },
    matriarch: { spawn: [['varga', 'Ese es el Núcleo: el borde de la Brecha. Si cae, puedo cerrarla. Te lo prometo.']], final: [['signal', 'E̷L̷L̷A̷ ̷N̷O̷S̷ ̷A̷B̷R̷I̷Ó̷']] },
  };
  /** Primera vez que aparece cada criatura (una vez por partida guardada). */
  const ENEMY_RADIO = {
    stalker: ['varga', 'Acechadores: rápidos y frágiles. Saltan cuando estás cerca; usa el dash para esquivar el salto.'],
    spitter: ['varga', 'Tejedores: mantienen la distancia. Acércate rodeando las coberturas.'],
    warlock: ['reyes', 'Ese Guardián protege a los demás con un escudo. Derríbalo primero.'],
    bloater: ['varga', 'Incinerador: va a estallar. Dispárale antes de que te alcance.'],
    brute: ['reyes', 'Coloso en el sector. Cuando levante los puños, sal del círculo.'],
    phantom: ['varga', 'Espectros: se desvanecen y reaparecen a tu lado. Si uno se vuelve transparente, gírate.'],
    mortar: ['reyes', 'Artilleros: bombardean desde lejos. Las marcas del suelo te dicen dónde caerá. No te quedes quieto.'],
    swarm: ['varga', 'Parásitos de la Brecha. Vienen en enjambre: un explosivo o la escopeta los barren.'],
  };
  const LOWHP_RADIO = ['reyes', 'K-7, tus constantes vitales caen. Busca un botiquín o retrocede hacia la terminal.'];

  /* ======================= REGISTROS ======================= */
  const LOGS = [
    // Sector 7
    { id: 's7_1', sector: 's7', title: 'Diario de turno — técnico Ortega', text: 'Día 212. Hoy han ensayado la apertura a baja potencia. Las luces del laboratorio B parpadearon durante seis segundos y mi café hirvió en la taza. Varga dice que es normal. La doctora no ha dormido en tres días.' },
    { id: 's7_2', sector: 's7', title: 'Protocolo de contención 7-C', text: 'En caso de brecha biológica, el jefe de seguridad sellará el sector afectado sin esperar autorización. Las vidas del personal atrapado son secundarias frente al riesgo de propagación. — Firmado: V. Hale.' },
    { id: 's7_3', sector: 's7', title: 'Nota pegada en una taquilla', text: 'Marta: si lees esto, no abras la puerta aunque oigas mi voz. Ya no soy yo. Las rejillas están calientes. Escuchan.' },
    { id: 's7_4', sector: 's7', title: 'Grabación de Hale', text: '«Sector 7 sellado. Cuarenta y tres dentro. Que Dios me perdone. Voy a hacer la ronda… alguien tiene que hacer la ronda… la ronda… la ronda…»' },
    // Fundición
    { id: 'foundry_1', sector: 'foundry', title: 'Informe de mantenimiento VULCANO-3', text: 'El horno principal funde a 1.800 °C las placas que blindan el anillo de Umbral. Tras la apertura, la temperatura subió a 2.400 °C sin que nadie tocara los controles. El sistema no responde a la parada de emergencia.' },
    { id: 'foundry_2', sector: 'foundry', title: 'Mensaje de la cuadrilla 4', text: 'El metal se mueve dentro del crisol. Forma manos. Ruiz se acercó a mirar y el horno lo llamó por su nombre. Cerramos la compuerta. Seguimos oyéndolo.' },
    { id: 'foundry_3', sector: 'foundry', title: 'Inventario de munición pesada', text: 'Faltan 312 proyectiles de mortero del almacén. Ninguna firma de acceso. Las cámaras muestran criaturas con caparazón cargándolos sobre la espalda.' },
    { id: 'foundry_4', sector: 'foundry', title: 'Correo interno — Dr. Sarkov', text: 'Varga, deje de hablar de riesgos. Lo que hay al otro lado no es energía: es conciencia. Si Umbral funciona, dejaremos de ser lo que somos. Eso no es un riesgo, doctora. Es el objetivo.' },
    // Criogenia
    { id: 'cryo_1', sector: 'cryo', title: 'Registro de cápsula 01 — S. Sarkov', text: 'Ocupante: director Ilyin Sarkov. Entrada voluntaria a las 03:14, dos minutos después de la apertura. Observación del técnico: «Sonreía».' },
    { id: 'cryo_2', sector: 'cryo', title: 'Alarma de temperatura', text: 'Las cápsulas 04 a 31 registran actividad cerebral en sujetos clínicamente muertos. Patrón sincronizado. Frecuencia idéntica a la de la Brecha.' },
    { id: 'cryo_3', sector: 'cryo', title: 'Audio sin identificar', text: '«…no nos movemos. Saltamos de un frío a otro. Estamos aquí y allí. Vosotros solo veis la mitad de nosotros…»' },
    { id: 'cryo_4', sector: 'cryo', title: 'Confesión — Dra. Varga', text: 'Yo calculé la frecuencia. Sarkov la subió un 3 % por encima de mi límite. Podría culparlo a él, pero los números eran míos. Si la puerta se abre del todo, quiero ser yo quien la cierre.' },
    // La Brecha
    { id: 'rift_1', sector: 'rift', title: 'Telemetría del anillo', text: 'El anillo de contención está roto en ocho puntos. La Brecha no crece hacia fuera: crece hacia dentro, hacia nosotros, como si alguien tirara desde el otro lado.' },
    { id: 'rift_2', sector: 'rift', title: 'Fragmento cristalino analizado', text: 'Los cristales del Sector 0 no tienen estructura atómica estable. Emiten una señal de radio en bucle. Traducida: «¿Hay alguien ahí?». Es la voz de Varga.' },
    { id: 'rift_3', sector: 'rift', title: 'Última entrada — Dra. Varga', text: 'Entré en el anillo a las 05:40. No sé cuánto tiempo llevo aquí; el reloj marca la misma hora desde entonces. Puedo ver el complejo desde dentro, como a través de un cristal. Veo a K-7. Sigue vivo.' },
    { id: 'rift_4', sector: 'rift', title: 'Orden de esterilización', text: 'Si a las 12:00 la anomalía no está contenida, se detonará la carga térmica del pozo principal. Sin evacuación. Autorizado: Comandante Reyes, «Atalaya». Nota manuscrita: «Hazlo rápido, K-7».' },
  ];

  /* ======================= GESTOR ======================= */
  const Story = {
    SPEAKERS, LOGS, INTRO, ENDING, BOSS_SCENES,
    game: null,
    queue: [],
    cur: null,
    scene: null,

    get data() {
      const d = HF.SaveManager.data;
      d.story = d.story || {};
      const s = d.story;
      s.logs = s.logs || []; s.seenEnemies = s.seenEnemies || []; s.dossiers = s.dossiers || [];
      return s;
    },
    get radioOn() { return HF.SaveManager.settings.radio !== false; },

    init(game) {
      this.game = game;
      $('story-next').onclick = () => this.next();
      $('story-skip').onclick = () => this.skip();
      $('story-screen').addEventListener('click', (e) => { if (!e.target.closest('button')) this.next(); });
    },

    /* ---------------- escenas ---------------- */
    playScene(slides, onDone) {
      const g = this.game;
      this.scene = { slides, i: 0, onDone, prev: g.state, shown: 0 };
      g.state = 'story';
      if (document.pointerLockElement) document.exitPointerLock();
      $('story-screen').classList.remove('hidden');
      this.showSlide();
    },
    showSlide() {
      const sc = this.scene, s = sc.slides[sc.i];
      const art = $('story-art');
      art.innerHTML = '';
      if (s.art === 'logo') art.innerHTML = `<img src="${HF.Assets.url('logo')}" alt="" class="story-logo">`;
      else if (s.art === 'player') art.appendChild(HF.Assets.frameCanvas('player_rifle', 'idle', 0, 24, 4));
      else if (s.art && s.art.startsWith('portrait_')) art.innerHTML = `<img src="${HF.Assets.url(s.art)}" alt="" class="story-portrait">`;
      else if (s.art) art.appendChild(HF.Assets.frameCanvas(s.art, 'idle', 0, 2, 2));
      const sp = s.speaker ? SPEAKERS[s.speaker] : null;
      $('story-title').textContent = s.title;
      $('story-title').style.color = sp ? sp.color : '';
      $('story-count').textContent = `${sc.i + 1} / ${sc.slides.length}`;
      sc.full = s.text;
      sc.shown = 0;
      $('story-text').textContent = '';
      HF.Audio.play('ui');
    },
    next() {
      const sc = this.scene;
      if (!sc) return;
      if (sc.shown < sc.full.length) { sc.shown = sc.full.length; $('story-text').textContent = sc.full; return; }
      sc.i++;
      if (sc.i >= sc.slides.length) this.endScene();
      else this.showSlide();
    },
    skip() { if (this.scene) this.endScene(); },
    endScene() {
      const sc = this.scene, g = this.game;
      this.scene = null;
      $('story-screen').classList.add('hidden');
      g.state = sc.prev === 'story' ? 'playing' : sc.prev;
      if (g.state === 'playing') g.lockPointer();
      if (sc.onDone) sc.onDone();
    },

    /* ---------------- radio ---------------- */
    radio(speaker, text, dur) {
      if (!this.radioOn) return;
      this.queue.push({ speaker, text, dur: dur || Math.max(4, text.length * 0.055) });
    },
    radioList(list) { for (const [sp, t] of list || []) this.radio(sp, t); },
    update(dt) {
      // texto de escena escribiéndose
      const sc = this.scene;
      if (sc && sc.shown < sc.full.length) {
        sc.shown = Math.min(sc.full.length, sc.shown + dt * 55);
        $('story-text').textContent = sc.full.slice(0, Math.floor(sc.shown));
      }
      // radio
      const box = $('radio');
      if (!this.cur && this.queue.length && this.game.state === 'playing') {
        this.cur = this.queue.shift();
        this.cur.t = 0;
        const sp = SPEAKERS[this.cur.speaker];
        $('radio-portrait').src = HF.Assets.url(sp.portrait);
        $('radio-name').textContent = sp.name;
        $('radio-name').style.color = sp.color;
        $('radio-role').textContent = sp.role;
        box.classList.toggle('glitch', this.cur.speaker === 'signal');
        box.classList.remove('hidden');
        HF.Audio.play('switch');
      }
      if (this.cur) {
        if (this.game.state === 'playing' || this.game.state === 'dying') this.cur.t += dt;
        const c = this.cur;
        $('radio-text').textContent = c.text.slice(0, Math.floor(c.t * 60));
        if (c.t > c.dur) { this.cur = null; box.classList.add('hidden'); }
      }
    },
    clearRadio() { this.queue.length = 0; this.cur = null; $('radio').classList.add('hidden'); },

    /* ---------------- eventos de juego ---------------- */
    onRunStart(sectorId) {
      this.clearRadio();
      this.sectorWave = 0;
      this.lowHpSaid = false;
      const begin = () => this.radioList(SECTOR_RADIO[sectorId].arrive);
      if (!this.data.introSeen) {
        this.data.introSeen = true;
        HF.SaveManager.save();
        this.playScene(INTRO, begin);
      } else begin();
    },
    onWaveStart() {
      this.sectorWave = (this.sectorWave || 0) + 1;
      const r = SECTOR_RADIO[this.game.map.sector.id];
      if (r && r.waves[this.sectorWave]) this.radioList(r.waves[this.sectorWave]);
    },
    onEnemySeen(type) {
      const d = this.data;
      if (!ENEMY_RADIO[type] || d.seenEnemies.includes(type)) return;
      d.seenEnemies.push(type);
      HF.SaveManager.save();
      this.radio(...ENEMY_RADIO[type]);
    },
    onBossSpawn(type) { this.radioList(BOSS_RADIO[type] && BOSS_RADIO[type].spawn); },
    onBossFinalPhase(type) { this.radioList(BOSS_RADIO[type] && BOSS_RADIO[type].final); },
    onBossKilled(type) {
      const d = this.data;
      if (!d.dossiers.includes(type)) { d.dossiers.push(type); HF.SaveManager.save(); }
      this.pendingBoss = type;
    },
    onLowHp() {
      if (this.lowHpSaid) return;
      this.lowHpSaid = true;
      this.radio(...LOWHP_RADIO);
    },
    /** Durante la evacuación: escena del jefe derrotado (y el final la primera vez que cae el Núcleo). */
    onEvacuate(nextSector, afterScene) {
      const type = this.pendingBoss;
      this.pendingBoss = null;
      this.sectorWave = 0;
      this.clearRadio();
      const d = this.data;
      let slides = (type && BOSS_SCENES[type]) || [];
      const ending = type === 'matriarch' && !d.endingSeen;
      if (ending) { slides = slides.concat(ENDING); d.endingSeen = true; HF.SaveManager.save(); }
      const done = () => {
        if (ending) { this.game.unlock('ending'); this.game.ui.toast('MODO INFINITO: la anomalía regresa más fuerte', 'achievement'); }
        afterScene();
        this.radioList(SECTOR_RADIO[nextSector].arrive);
      };
      if (slides.length) this.playScene(slides, done); else done();
    },

    /* ---------------- registros ---------------- */
    nextLog(sectorId) { return LOGS.find((l) => l.sector === sectorId && !this.data.logs.includes(l.id)); },
    /** Al completar una oleada puede aparecer un registro del sector en algún punto del mapa. */
    maybeDropLog() {
      const g = this.game;
      if (g.items.items.some((it) => it.active && it.type === 'log')) return;
      const log = this.nextLog(g.map.sector.id);
      if (!log || Math.random() > 0.65) return;
      const p = g.player;
      for (let k = 0; k < 30; k++) {
        const a = Math.random() * U.TAU, r = U.rand(220, 520);
        const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
        if (g.map.isFreeCircle(x, y, 16) && g.map.flowDist(x, y) < 65535 && !g.map.inToxic(x, y)) {
          const it = g.spawnItem('log', x, y, log.id);
          if (it) { it.vx = it.vy = 0; it.life = 120; }
          g.ui.toast('SEÑAL DE DATOS DETECTADA (mira el minimapa)', 'info');
          return;
        }
      }
    },
    collectLog(id) {
      const d = this.data;
      const log = LOGS.find((l) => l.id === id);
      if (!log || d.logs.includes(id)) return;
      d.logs.push(id);
      HF.SaveManager.save();
      this.game.ui.toast('REGISTRO RECUPERADO: ' + log.title, 'achievement');
      this.radio('archive', log.title + ' — ' + log.text.slice(0, 110) + (log.text.length > 110 ? '… (léelo completo en ARCHIVO)' : ''), 7);
      if (d.logs.length >= LOGS.length) this.game.unlock('archivist');
    },
  };

  HF.Story = Story;
})(window.HF);
