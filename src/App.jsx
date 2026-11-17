import React, { useState, useEffect, useRef } from 'react';

const app = null;
const auth = null;
const db = null;

const loadLocal = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const saveLocal = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignora errori quota storage
  }
};

const SKILL_EVALUATIONS = {
  BATTUTA: [
    { val: '#', label: 'Ace', bg: 'bg-emerald-600' },
    { val: '+', label: 'Positiva', bg: 'bg-blue-600' },
    { val: '-', label: 'Errore', bg: 'bg-red-600' }
  ],
  RICEZIONE: [
    { val: '#', label: 'Perfetta', bg: 'bg-emerald-600' },
    { val: '+', label: 'Positiva', bg: 'bg-blue-600' },
    { val: '!', label: 'Neutra', bg: 'bg-amber-600' },
    { val: '/', label: 'Errore', bg: 'bg-orange-600' },
    { val: '-', label: 'Ace Subito', bg: 'bg-red-600' }
  ],
  ATTACCO: [
    { val: '#', label: 'Punto', bg: 'bg-emerald-600' },
    { val: '+', label: 'Difeso', bg: 'bg-blue-600' },
    { val: '/', label: 'Muro Subito', bg: 'bg-orange-600' },
    { val: '-', label: 'Errore', bg: 'bg-red-600' }
  ],
  MURO: [
    { val: '#', label: 'Punto', bg: 'bg-emerald-600' },
    { val: '/', label: 'Tocco', bg: 'bg-amber-600' },
    { val: '-', label: 'Mani Out', bg: 'bg-red-600' }
  ],
  DIFESA: [
    { val: '+', label: 'Positiva', bg: 'bg-emerald-600' },
    { val: '/', label: 'Neutra', bg: 'bg-amber-600' },
    { val: '-', label: 'Errore', bg: 'bg-red-600' }
  ],
  FREEBALL: [
    { val: '+', label: 'Positiva', bg: 'bg-emerald-600' },
    { val: '/', label: 'Neutra', bg: 'bg-amber-600' },
    { val: '-', label: 'Errore', bg: 'bg-red-600' }
  ],
  FALLO: [
    { val: '-', label: 'Errore / Fallo', bg: 'bg-red-600' }
  ]
};

const ROTATION_ORDER = ['P1', 'P6', 'P5', 'P4', 'P3', 'P2'];

export default function App() {
  const [view, setView] = useState('HOME');
  const [appNotice, setAppNotice] = useState(null);
  const backupInputRef = useRef(null);

  // DATABASE SQUADRE & PARTITE
  const [savedTeams, setSavedTeams] = useState(() => loadLocal('vsp_teams', []));
  const [editingTeam, setEditingTeam] = useState(null);
  const [newPlayer, setNewPlayer] = useState({ num: '', cognome: '', nome: '', isLibero: false });

  const [inProgressMatches, setInProgressMatches] = useState(() => loadLocal('vsp_in_progress', []));
  const [matchArchive, setMatchArchive] = useState(() => loadLocal('vsp_archive', []));
  const [currentMatchId, setCurrentMatchId] = useState(null);
  const [isViewingArchive, setIsViewingArchive] = useState(false);

  // DATI PARTITA CORRENTE
  const [teamUsName, setTeamUsName] = useState('');
  const [teamOppName, setTeamOppName] = useState('');
  const [roster, setRoster] = useState([]);

  const [gameState, setGameState] = useState({
    currentSet: 1,
    scoreUs: 0,
    scoreOpp: 0,
    phase: 'CP',
    setsWonUs: 0,
    setsWonOpp: 0,
    matchPartials: {},
    currentRotation: 'P1'
  });

  const [court, setCourt] = useState({ 1: null, 2: null, 3: null, 4: null, 5: null, 6: null });
  const [lastInitialCourt, setLastInitialCourt] = useState(null);
  const [startingSetterNum, setStartingSetterNum] = useState(null);
  const [servingFirst, setServingFirst] = useState('US');
  const [firstSetServer, setFirstSetServer] = useState('US');
  const [setupStep, setSetupStep] = useState('CHOICE');
  const [setupSelectedZone, setSetupSelectedZone] = useState(null);

  // GESTIONE CAMBI, LIBERO & TIMEOUT
  const [subsCount, setSubsCount] = useState(0);
  const [closedSubs, setClosedSubs] = useState([]);
  const [liberoTracker, setLiberoTracker] = useState({ replaced: null });
  const [recentBenchPlayers, setRecentBenchPlayers] = useState({});
  const [timeouts, setTimeouts] = useState({ us: 0, opp: 0 });

  // STATISTICHE & LOG
  const [stats, setStats] = useState([]);
  const [rallies, setRallies] = useState([]);
  const [historyStack, setHistoryStack] = useState([]);
  const [playByPlay, setPlayByPlay] = useState([]);
  const [lastRallySummary, setLastRallySummary] = useState([]);
  const [ballInPlay, setBallInPlay] = useState(false);

  // UI GIOCO & REPORT
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [showSubModal, setShowSubModal] = useState(false);
  const [subTargetZone, setSubTargetZone] = useState(null);
  const [pendingSub, setPendingSub] = useState(null);
  const [pointBanner, setPointBanner] = useState(null);

  const [statsFilter, setStatsFilter] = useState('ALL');
  const [phaseFilter, setPhaseFilter] = useState('ALL');
  const [rotationFilter, setRotationFilter] = useState('ALL');

  // SINCRONIZZAZIONE LOCALE
  useEffect(() => {
    saveLocal('vsp_teams', savedTeams);
  }, [savedTeams]);

  useEffect(() => {
    saveLocal('vsp_in_progress', inProgressMatches);
  }, [inProgressMatches]);

  useEffect(() => {
    saveLocal('vsp_archive', matchArchive);
  }, [matchArchive]);

  // ESPORTA & IMPORTA BACKUP COMPLETO
  const handleExportBackup = () => {
    const backupPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      teams: savedTeams,
      inProgress: inProgressMatches,
      archive: matchArchive
    };
    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `volleyball-scout-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result);
        if (!parsed || (!Array.isArray(parsed.teams) && !Array.isArray(parsed.archive))) {
          throw new Error('Formato file non valido');
        }
        if (Array.isArray(parsed.teams)) setSavedTeams(parsed.teams);
        if (Array.isArray(parsed.inProgress)) setInProgressMatches(parsed.inProgress);
        if (Array.isArray(parsed.archive)) setMatchArchive(parsed.archive);
        setAppNotice({
          title: '✅ Backup Ripristinato',
          message: `Importate con successo ${parsed.teams?.length || 0} squadre, ${parsed.inProgress?.length || 0} gare in corso e ${parsed.archive?.length || 0} gare in archivio!`
        });
      } catch {
        setAppNotice({
          title: '❌ Errore Importazione',
          message: 'Il file selezionato non è un backup valido di Volleyball Scout Pro.'
        });
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  // HELPERS NOME GIOCATORE
  const getShortName = (p) => {
    if (!p) return '';
    return p.cognome || p.name || '';
  };

  const getFullName = (p) => {
    if (!p) return '';
    if (p.cognome) return `${p.cognome} ${p.nome || ''}`.trim();
    return p.name || '';
  };

  // PERSISTENZA SQUADRE & PARTITE
  const saveTeamToStorage = (teamObj) => {
    const cleanTeam = JSON.parse(JSON.stringify(teamObj));
    setSavedTeams((prev) => {
      const exists = prev.findIndex((t) => t.id === cleanTeam.id);
      if (exists >= 0) {
        const nt = [...prev];
        nt[exists] = cleanTeam;
        return nt;
      }
      return [...prev, cleanTeam];
    });
  };

  const deleteTeamFromStorage = (teamId) => {
    setSavedTeams((prev) => prev.filter((x) => x.id !== teamId));
  };

  const deleteInProgressMatch = (matchId) => {
    setInProgressMatches((prev) => prev.filter((item) => item.id !== matchId));
  };

  const deleteArchivedMatch = (matchId) => {
    setMatchArchive((prev) => prev.filter((item) => item.id !== matchId));
  };

  const saveInProgressMatch = () => {
    const matchId = currentMatchId || Date.now();
    const savedAt = new Date().toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const inProgressData = JSON.parse(
      JSON.stringify({
        id: matchId,
        updatedAt: Date.now(),
        savedAt,
        teamUsName,
        teamOppName,
        roster,
        gameState,
        court,
        servingFirst,
        firstSetServer,
        lastInitialCourt: lastInitialCourt || null,
        startingSetterNum: startingSetterNum || null,
        subsCount,
        closedSubs,
        liberoTracker,
        recentBenchPlayers,
        timeouts,
        stats,
        rallies,
        playByPlay,
        lastRallySummary,
        ballInPlay
      })
    );

    setInProgressMatches((prev) => {
      const idx = prev.findIndex((m) => m.id === matchId);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = inProgressData;
        return updated;
      }
      return [inProgressData, ...prev];
    });

    resetGame();
    setView('HOME');
  };

  const resumeInProgressMatch = (m) => {
    setCurrentMatchId(m.id);
    setIsViewingArchive(false);
    setTeamUsName(m.teamUsName || '');
    setTeamOppName(m.teamOppName || '');
    setRoster(m.roster || []);
    setGameState(m.gameState);
    setCourt(m.court || { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null });
    setServingFirst(m.servingFirst || 'US');
    setFirstSetServer(m.firstSetServer || m.servingFirst || 'US');
    setLastInitialCourt(m.lastInitialCourt || null);
    setStartingSetterNum(m.startingSetterNum || null);
    setSubsCount(m.subsCount || 0);
    setClosedSubs(m.closedSubs || []);
    setLiberoTracker(m.liberoTracker || { replaced: null });
    setRecentBenchPlayers(m.recentBenchPlayers || {});
    setTimeouts(m.timeouts || { us: 0, opp: 0 });
    setStats(m.stats || []);
    setRallies(m.rallies || []);
    setPlayByPlay(m.playByPlay || []);
    setLastRallySummary(m.lastRallySummary || []);
    setBallInPlay(Boolean(m.ballInPlay));
    setHistoryStack([]);
    setSelectedPlayer(null);
    setSelectedSkill(null);
    setStatsFilter('ALL');
    setPhaseFilter('ALL');
    setRotationFilter('ALL');

    const target = m.gameState.currentSet === 5 ? 15 : 25;
    const sUs = m.gameState.scoreUs;
    const sOpp = m.gameState.scoreOpp;
    const setDone = (sUs >= target || sOpp >= target) && Math.abs(sUs - sOpp) >= 2;
    setView(setDone ? 'STATS' : 'GAME');
  };

  const saveMatchToArchive = () => {
    const matchId = currentMatchId || Date.now();
    const matchData = JSON.parse(
      JSON.stringify({
        id: matchId,
        createdAt: Date.now(),
        date: new Date().toLocaleDateString('it-IT'),
        teamUsName,
        teamOppName,
        gameState,
        stats,
        rallies,
        roster
      })
    );

    setMatchArchive((prev) => [matchData, ...prev.filter((m) => m.id !== matchId)]);
    if (currentMatchId) {
      setInProgressMatches((prev) => prev.filter((m) => m.id !== currentMatchId));
    }

    resetGame();
    setView('HOME');
  };

  // RESET MOTORE DI GIOCO
  const resetGame = () => {
    setCurrentMatchId(null);
    setIsViewingArchive(false);
    setGameState({
      currentSet: 1,
      scoreUs: 0,
      scoreOpp: 0,
      phase: 'CP',
      setsWonUs: 0,
      setsWonOpp: 0,
      matchPartials: {},
      currentRotation: 'P1'
    });
    setCourt({ 1: null, 2: null, 3: null, 4: null, 5: null, 6: null });
    setLastInitialCourt(null);
    setStartingSetterNum(null);
    setSubsCount(0);
    setClosedSubs([]);
    setLiberoTracker({ replaced: null });
    setRecentBenchPlayers({});
    setTimeouts({ us: 0, opp: 0 });
    setStats([]);
    setRallies([]);
    setHistoryStack([]);
    setPlayByPlay([]);
    setLastRallySummary([]);
    setBallInPlay(false);
    setSelectedPlayer(null);
    setSelectedSkill(null);
    setShowSubModal(false);
    setSubTargetZone(null);
    setPendingSub(null);
    setPointBanner(null);
    setStatsFilter('ALL');
    setPhaseFilter('ALL');
    setRotationFilter('ALL');
  };

  // PARTITA DEMO PER TEST REPORT PDF
  const startDemoMatch = () => {
    const demoRoster = [
      { num: '1', cognome: 'Orro', nome: 'Alessia', isLibero: false, isPresent: true },
      { num: '4', cognome: 'Bosetti', nome: 'Caterina', isLibero: false, isPresent: true },
      { num: '7', cognome: 'De Gennaro', nome: 'Monica', isLibero: true, isPresent: true },
      { num: '11', cognome: 'Danesi', nome: 'Anna', isLibero: false, isPresent: true },
      { num: '14', cognome: 'Pietrini', nome: 'Elena', isLibero: false, isPresent: true },
      { num: '17', cognome: 'Sylla', nome: 'Myriam', isLibero: false, isPresent: true },
      { num: '18', cognome: 'Egonu', nome: 'Paola', isLibero: false, isPresent: true }
    ];

    const demoStats = [
      { set: 1, phase: 'BP', rotation: 'P1', playerNum: '1', skill: 'BATTUTA', evalVal: '#' },
      { set: 1, phase: 'CP', rotation: 'P1', playerNum: '7', skill: 'RICEZIONE', evalVal: '#' },
      { set: 1, phase: 'CP', rotation: 'P1', playerNum: '18', skill: 'ATTACCO', evalVal: '#' },
      { set: 1, phase: 'BP', rotation: 'P6', playerNum: '11', skill: 'MURO', evalVal: '#' },
      { set: 1, phase: 'CP', rotation: 'P6', playerNum: '4', skill: 'RICEZIONE', evalVal: '+' },
      { set: 1, phase: 'CP', rotation: 'P6', playerNum: '17', skill: 'ATTACCO', evalVal: '-' },
      { set: 1, phase: 'BP', rotation: 'P5', playerNum: '7', skill: 'DIFESA', evalVal: '+' },
      { set: 1, phase: 'BP', rotation: 'P5', playerNum: '18', skill: 'ATTACCO', evalVal: '#' },
      { set: 1, phase: 'CP', rotation: 'P4', playerNum: null, skill: 'GEN', evalVal: 'err_battuta_avv' },
      { set: 2, phase: 'CP', rotation: 'P1', playerNum: '17', skill: 'RICEZIONE', evalVal: '#' },
      { set: 2, phase: 'CP', rotation: 'P1', playerNum: '18', skill: 'ATTACCO', evalVal: '#' },
      { set: 2, phase: 'BP', rotation: 'P6', playerNum: '18', skill: 'BATTUTA', evalVal: '#' },
      { set: 2, phase: 'BP', rotation: 'P6', playerNum: '18', skill: 'BATTUTA', evalVal: '-' },
      { set: 2, phase: 'CP', rotation: 'P5', playerNum: '7', skill: 'FREEBALL', evalVal: '+' },
      { set: 2, phase: 'CP', rotation: 'P5', playerNum: '11', skill: 'ATTACCO', evalVal: '#' },
      { set: 2, phase: 'BP', rotation: 'P4', playerNum: '4', skill: 'DIFESA', evalVal: '-' },
      { set: 3, phase: 'BP', rotation: 'P1', playerNum: '1', skill: 'BATTUTA', evalVal: '+' },
      { set: 3, phase: 'BP', rotation: 'P1', playerNum: '11', skill: 'MURO', evalVal: '#' },
      { set: 3, phase: 'CP', rotation: 'P6', playerNum: '7', skill: 'RICEZIONE', evalVal: '-' },
      { set: 3, phase: 'CP', rotation: 'P5', playerNum: '14', skill: 'ATTACCO', evalVal: '#' },
      { set: 3, phase: 'BP', rotation: 'P4', playerNum: null, skill: 'GEN', evalVal: 'err_attacco_avv' }
    ];

    const demoRallies = [];
    const rots = ['P1', 'P6', 'P5', 'P4', 'P3', 'P2'];
    [
      { set: 1, us: 25, opp: 20 },
      { set: 2, us: 25, opp: 22 },
      { set: 3, us: 25, opp: 19 }
    ].forEach((s) => {
      for (let i = 0; i < s.us; i++) {
        demoRallies.push({
          set: s.set,
          phase: i % 2 === 0 ? 'CP' : 'BP',
          rotation: rots[i % 6],
          winner: 'US'
        });
      }
      for (let i = 0; i < s.opp; i++) {
        demoRallies.push({
          set: s.set,
          phase: i % 2 === 0 ? 'BP' : 'CP',
          rotation: rots[(i + 2) % 6],
          winner: 'OPP'
        });
      }
    });

    setTeamUsName('Volley Italia Demo');
    setTeamOppName('Club Avversario');
    setRoster(demoRoster);
    setStats(demoStats);
    setRallies(demoRallies);
    setIsViewingArchive(true);
    setGameState({
      currentSet: 3,
      scoreUs: 25,
      scoreOpp: 19,
      phase: 'BP',
      setsWonUs: 3,
      setsWonOpp: 0,
      currentRotation: 'P1',
      matchPartials: {
        1: { p8: '8-6', p16: '16-13', p21: '21-18', scoreUs: 25, scoreOpp: 20 },
        2: { p8: '7-8', p16: '16-15', p21: '21-20', scoreUs: 25, scoreOpp: 22 },
        3: { p8: '8-5', p16: '16-12', p21: '21-15', scoreUs: 25, scoreOpp: 19 }
      }
    });
    setStatsFilter('ALL');
    setPhaseFilter('ALL');
    setRotationFilter('ALL');
    setView('STATS');
  };

  // UNDO STACK
  const saveHistory = () => {
    setHistoryStack((prev) => [
      ...prev.slice(-25),
      JSON.parse(
        JSON.stringify({
          gameState,
          court,
          subsCount,
          closedSubs,
          liberoTracker,
          recentBenchPlayers,
          timeouts,
          stats,
          rallies,
          playByPlay,
          lastRallySummary,
          ballInPlay
        })
      )
    ]);
  };

  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const last = historyStack[historyStack.length - 1];
    setGameState(last.gameState);
    setCourt(last.court);
    setSubsCount(last.subsCount);
    setClosedSubs(last.closedSubs);
    setLiberoTracker(last.liberoTracker);
    setRecentBenchPlayers(last.recentBenchPlayers);
    setTimeouts(last.timeouts);
    setStats(last.stats);
    setRallies(last.rallies || []);
    setPlayByPlay(last.playByPlay);
    setLastRallySummary(last.lastRallySummary || []);
    setBallInPlay(last.ballInPlay);
    setSelectedPlayer(null);
    setSelectedSkill(null);
    setHistoryStack((prev) => prev.slice(0, -1));
  };

  // CONTROLLO FINE SET / PARTITA
  const checkSetEnd = (sUs, sOpp) => {
    const target = gameState.currentSet === 5 ? 15 : 25;
    if ((sUs >= target || sOpp >= target) && Math.abs(sUs - sOpp) >= 2) {
      const weWon = sUs > sOpp;
      const newSetsUs = weWon ? gameState.setsWonUs + 1 : gameState.setsWonUs;
      const newSetsOpp = !weWon ? gameState.setsWonOpp + 1 : gameState.setsWonOpp;

      setGameState((prev) => ({
        ...prev,
        setsWonUs: newSetsUs,
        setsWonOpp: newSetsOpp
      }));

      setStatsFilter(String(gameState.currentSet));
      setPhaseFilter('ALL');
      setRotationFilter('ALL');
      setView('STATS');
    }
  };

  // PUNTO & ROTAZIONE AUTOMATICA
  const handlePoint = (team, finalLogEntry = null) => {
    const completedRallyLog = finalLogEntry ? [...playByPlay, finalLogEntry] : [...playByPlay];

    const rallyRecord = {
      set: gameState.currentSet,
      phase: gameState.phase,
      rotation: gameState.currentRotation,
      winner: team
    };
    setRallies((prev) => [...prev, rallyRecord]);

    const oldScoreUs = gameState.scoreUs;
    const oldScoreOpp = gameState.scoreOpp;
    let newScoreUs = gameState.scoreUs;
    let newScoreOpp = gameState.scoreOpp;
    let newPhase = gameState.phase;
    let newCourt = { ...court };
    let newRotation = gameState.currentRotation;

    if (team === 'US') {
      newScoreUs++;
      if (gameState.phase === 'CP') {
        newPhase = 'BP';
        newCourt = { 1: court[2], 2: court[3], 3: court[4], 4: court[5], 5: court[6], 6: court[1] };
        const currentIdx = ROTATION_ORDER.indexOf(newRotation);
        newRotation = ROTATION_ORDER[(currentIdx + 1) % 6] || 'P1';
      }
    } else {
      newScoreOpp++;
      if (gameState.phase === 'BP') {
        newPhase = 'CP';
      }
    }

    const newPartials = { ...gameState.matchPartials };
    if (!newPartials[gameState.currentSet]) newPartials[gameState.currentSet] = {};
    const pts = team === 'US' ? newScoreUs : newScoreOpp;
    if (pts === 8 && !newPartials[gameState.currentSet].p8) {
      newPartials[gameState.currentSet].p8 = `${newScoreUs}-${newScoreOpp}`;
    }
    if (pts === 16 && !newPartials[gameState.currentSet].p16) {
      newPartials[gameState.currentSet].p16 = `${newScoreUs}-${newScoreOpp}`;
    }
    if (pts === 21 && !newPartials[gameState.currentSet].p21) {
      newPartials[gameState.currentSet].p21 = `${newScoreUs}-${newScoreOpp}`;
    }
    newPartials[gameState.currentSet].scoreUs = newScoreUs;
    newPartials[gameState.currentSet].scoreOpp = newScoreOpp;

    setGameState((prev) => ({
      ...prev,
      scoreUs: newScoreUs,
      scoreOpp: newScoreOpp,
      phase: newPhase,
      matchPartials: newPartials,
      currentRotation: newRotation
    }));

    setLastRallySummary(completedRallyLog);
    setCourt(newCourt);
    setBallInPlay(false);
    setPlayByPlay([]);
    setSelectedPlayer(null);
    setSelectedSkill(null);

    setRecentBenchPlayers((prev) => {
      const next = { ...prev };
      for (const key in next) next[key]++;
      return next;
    });

    setPointBanner({
      team,
      text: team === 'US' ? 'PUNTO!' : 'PUNTO AVVERSARIO!',
      oldUs: oldScoreUs,
      newUs: newScoreUs,
      oldOpp: oldScoreOpp,
      newOpp: newScoreOpp
    });

    setTimeout(() => {
      setPointBanner(null);
      checkSetEnd(newScoreUs, newScoreOpp);
    }, 900);
  };

  // REGISTRAZIONE EVENTO STATISTICO
  const addStat = (playerNum, skill, evalVal, isGeneral = false, generalType = null) => {
    saveHistory();
    let pointWinner = null;
    let logEntry = '';

    if (isGeneral) {
      setStats((prev) => [
        ...prev,
        {
          set: gameState.currentSet,
          phase: gameState.phase,
          rotation: gameState.currentRotation,
          playerNum: null,
          skill: 'GEN',
          evalVal: generalType
        }
      ]);

      if (generalType === 'err_battuta_avv') {
        pointWinner = 'US';
        logEntry = 'Errore Battuta Avversaria (+1 Noi)';
      } else if (generalType === 'err_attacco_avv') {
        pointWinner = 'US';
        logEntry = 'Errore Attacco Avversario (+1 Noi)';
      } else if (generalType === 'err_gen_avv') {
        pointWinner = 'US';
        logEntry = 'Errore/Fallo Generico Avversario (+1 Noi)';
      } else if (generalType === 'free_concessa') {
        logEntry = 'Freeball Concessa (Squadra)';
        setBallInPlay(true);
      }
    } else {
      const pObj = roster.find((x) => x.num === playerNum);
      const pLabel = pObj ? `${pObj.num} ${getShortName(pObj)}` : `#${playerNum}`;

      setStats((prev) => [
        ...prev,
        {
          set: gameState.currentSet,
          phase: gameState.phase,
          rotation: gameState.currentRotation,
          playerNum,
          skill,
          evalVal
        }
      ]);

      logEntry = `${pLabel} - ${skill} (${evalVal})`;
      setBallInPlay(true);

      if (skill === 'BATTUTA') {
        if (evalVal === '#') pointWinner = 'US';
        if (evalVal === '-') pointWinner = 'OPP';
      } else if (skill === 'RICEZIONE') {
        if (evalVal === '-') pointWinner = 'OPP';
      } else if (skill === 'ATTACCO') {
        if (evalVal === '#') pointWinner = 'US';
        if (evalVal === '/' || evalVal === '-') pointWinner = 'OPP';
      } else if (skill === 'MURO') {
        if (evalVal === '#') pointWinner = 'US';
        if (evalVal === '-') pointWinner = 'OPP';
      } else if (skill === 'DIFESA') {
        if (evalVal === '-') pointWinner = 'OPP';
      } else if (skill === 'FREEBALL') {
        if (evalVal === '-') pointWinner = 'OPP';
      } else if (skill === 'FALLO') {
        pointWinner = 'OPP';
      }
    }

    setSelectedPlayer(null);
    setSelectedSkill(null);

    if (pointWinner) {
      handlePoint(pointWinner, logEntry);
    } else {
      setPlayByPlay((prev) => [...prev, logEntry]);
    }
  };

  // GESTIONE SOSTITUZIONI CON REGOLAMENTO E FORZATURA
  const validateSubstitution = (zone, incomingPlayer) => {
    const outgoingPlayer = court[zone];
    if (!outgoingPlayer || !incomingPlayer) return { valid: false, reason: 'Giocatore non valido.' };

    const involvesLibero = outgoingPlayer.isLibero || incomingPlayer.isLibero;

    if (recentBenchPlayers[incomingPlayer.num] !== undefined && recentBenchPlayers[incomingPlayer.num] < 1) {
      return {
        valid: false,
        reason: `Il giocatore ${incomingPlayer.num} (${getShortName(incomingPlayer)}) è appena uscito: da regolamento deve trascorrere almeno 1 punto intero in panchina prima di poter rientrare.`
      };
    }

    if (involvesLibero) {
      if (incomingPlayer.isLibero) {
        if ([2, 3, 4].includes(zone)) {
          return {
            valid: false,
            reason: 'Il Libero non può entrare direttamente nelle zone di prima linea (Zona 2, 3 o 4).'
          };
        }
        if (liberoTracker.replaced && liberoTracker.replaced !== outgoingPlayer.num) {
          return {
            valid: false,
            reason: `Il Libero sta già sostituendo il n° ${liberoTracker.replaced}.`
          };
        }
      }
      if (outgoingPlayer.isLibero) {
        if (liberoTracker.replaced && incomingPlayer.num !== liberoTracker.replaced) {
          const expectedP = roster.find((p) => p.num === liberoTracker.replaced);
          return {
            valid: false,
            reason: `Il Libero può uscire esclusivamente per far rientrare il giocatore che aveva sostituito: n° ${liberoTracker.replaced}${expectedP ? ` (${getShortName(expectedP)})` : ''}.`
          };
        }
      }
      return { valid: true };
    }

    const existingPairIndex = closedSubs.findIndex(
      (pair) => pair.starter === outgoingPlayer.num || pair.bench === outgoingPlayer.num
    );
    const incomingPairIndex = closedSubs.findIndex(
      (pair) => pair.starter === incomingPlayer.num || pair.bench === incomingPlayer.num
    );

    if (existingPairIndex >= 0) {
      const pair = closedSubs[existingPairIndex];
      if (pair.isClosed) {
        return {
          valid: false,
          reason: `Il giocatore ${outgoingPlayer.num} (${getShortName(outgoingPlayer)}) ha già aperto e chiuso la sua sostituzione in questo set e non può più essere cambiato.`
        };
      }
      if (pair.bench === outgoingPlayer.num && pair.starter === incomingPlayer.num) {
        if (subsCount >= 8) {
          return { valid: false, reason: 'Limite massimo di 8 sostituzioni per set già raggiunto.' };
        }
        return { valid: true, closesPairIndex: existingPairIndex };
      }
      return {
        valid: false,
        reason: `Chiusura cambio obbligatoria: ${outgoingPlayer.num} (${getShortName(outgoingPlayer)}) può uscire esclusivamente per far rientrare il titolare n° ${pair.starter}.`
      };
    }

    if (incomingPairIndex >= 0) {
      const pair = closedSubs[incomingPairIndex];
      return {
        valid: false,
        reason: `Il giocatore ${incomingPlayer.num} (${getShortName(incomingPlayer)}) è già vincolato a un'altra coppia di cambio in questo set (con n° ${pair.starter === incomingPlayer.num ? pair.bench : pair.starter}).`
      };
    }

    if (subsCount >= 8) {
      return {
        valid: false,
        reason: 'Limite massimo di 8 sostituzioni regolamentari per set già raggiunto!'
      };
    }

    return { valid: true, opensNewPair: true };
  };

  const executeSubstitution = (zone, incomingPlayer, validationResult = {}) => {
    saveHistory();
    const outgoingPlayer = court[zone];
    const involvesLibero = outgoingPlayer.isLibero || incomingPlayer.isLibero;

    const inheritsSetter = Boolean(outgoingPlayer.isSetter);
    const updatedIncoming = { ...incomingPlayer, isSetter: inheritsSetter };
    const updatedOutgoing = { ...outgoingPlayer, isSetter: false };

    setCourt((prev) => ({
      ...prev,
      [zone]: updatedIncoming
    }));

    setRecentBenchPlayers((prev) => {
      const next = { ...prev };
      delete next[incomingPlayer.num];
      next[updatedOutgoing.num] = 0;
      return next;
    });

    if (involvesLibero) {
      if (incomingPlayer.isLibero) {
        setLiberoTracker({ replaced: outgoingPlayer.num });
      } else if (outgoingPlayer.isLibero) {
        setLiberoTracker({ replaced: null });
      }
    } else {
      setSubsCount((prev) => prev + 1);
      if (typeof validationResult.closesPairIndex === 'number') {
        setClosedSubs((prev) =>
          prev.map((item, idx) => (idx === validationResult.closesPairIndex ? { ...item, isClosed: true } : item))
        );
      } else {
        setClosedSubs((prev) => {
          const alreadyExists = prev.some(
            (p) =>
              (p.starter === outgoingPlayer.num && p.bench === incomingPlayer.num) ||
              (p.bench === outgoingPlayer.num && p.starter === incomingPlayer.num)
          );
          if (alreadyExists) return prev;
          return [...prev, { starter: outgoingPlayer.num, bench: incomingPlayer.num, isClosed: false }];
        });
      }
    }

    setPendingSub(null);
    setShowSubModal(false);
    setSubTargetZone(null);
  };

  const handleSubRequest = (zone, incomingPlayer) => {
    const check = validateSubstitution(zone, incomingPlayer);
    if (!check.valid) {
      setPendingSub({ zone, incomingPlayer, reason: check.reason });
      return;
    }
    executeSubstitution(zone, incomingPlayer, check);
  };

  // AVANZAMENTO SET SUCCESSIVO
  const handlePrepareNextSet = () => {
    const nextSet = gameState.currentSet + 1;
    const isFifthSet = nextSet === 5;
    const autoServer =
      nextSet % 2 === 1 ? firstSetServer : firstSetServer === 'US' ? 'OPP' : 'US';

    setGameState((prev) => ({
      ...prev,
      currentSet: nextSet,
      scoreUs: 0,
      scoreOpp: 0,
      phase: autoServer === 'US' ? 'BP' : 'CP',
      currentRotation: 'P1'
    }));

    if (lastInitialCourt) {
      setCourt(JSON.parse(JSON.stringify(lastInitialCourt)));
    } else {
      setCourt({ 1: null, 2: null, 3: null, 4: null, 5: null, 6: null });
    }

    setServingFirst(autoServer);
    setSetupStep(isFifthSet ? 'CHOICE' : 'COURT');
    setSetupSelectedZone(null);
    setSubsCount(0);
    setClosedSubs([]);
    setLiberoTracker({ replaced: null });
    setRecentBenchPlayers({});
    setTimeouts({ us: 0, opp: 0 });
    setPlayByPlay([]);
    setLastRallySummary([]);
    setBallInPlay(false);
    setHistoryStack([]);
    setView('SETUP_COURT');
  };

  // =========================================================================
  // VISTE DELL'APPLICAZIONE
  // =========================================================================

  const renderHome = () => (
    <div className="min-h-screen bg-slate-900 text-white p-6 md:p-8 flex flex-col items-center justify-center font-sans gap-5">
      <div className="text-center mb-2">
        <h1 className="text-4xl md:text-5xl font-black text-blue-400">Volleyball Scout Pro</h1>
        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-slate-800 border border-slate-700">
          <span className="text-emerald-300">💾 Salvataggio automatico locale (Offline Ready)</span>
        </div>
      </div>

      <button
        onClick={() => {
          setIsViewingArchive(false);
          setView('NEW_MATCH');
        }}
        className="w-full max-w-xl bg-green-600 hover:bg-green-500 p-5 md:p-6 rounded-2xl font-black text-2xl shadow-xl flex items-center justify-center gap-4 transition-transform hover:scale-[1.02]"
      >
        🏐 NUOVA GARA
      </button>

      <button
        onClick={() => setView('TEAM_MANAGEMENT')}
        className="w-full max-w-xl bg-blue-600 hover:bg-blue-500 p-4 md:p-5 rounded-2xl font-black text-xl shadow-xl flex items-center justify-center gap-3 transition-transform hover:scale-[1.02]"
      >
        👥 GESTIONE SQUADRE
      </button>

      <button
        onClick={() => setView('MATCH_ARCHIVE')}
        className="w-full max-w-xl bg-purple-600 hover:bg-purple-500 p-4 md:p-5 rounded-2xl font-black text-xl shadow-xl flex items-center justify-center gap-3 transition-transform hover:scale-[1.02]"
      >
        🏆 ARCHIVIO GARE CONCLUSE ({matchArchive.length})
      </button>

      {/* SEZIONE GARE IN CORSO */}
      <div className="w-full max-w-xl bg-slate-800/90 border border-slate-700 rounded-2xl p-4 md:p-5 shadow-xl mt-1">
        <h3 className="text-base md:text-lg font-black text-amber-400 mb-3 flex items-center justify-between">
          <span>⏸️ Gare in Corso Salvate</span>
          <span className="text-xs bg-slate-700 text-gray-300 px-2.5 py-0.5 rounded-full">{inProgressMatches.length}</span>
        </h3>
        {inProgressMatches.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-3">
            Nessuna partita sospesa al momento.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 max-h-60 overflow-y-auto pr-1">
            {inProgressMatches.map((m) => (
              <div
                key={`in-progress-${m.id}`}
                className="bg-slate-900/90 border border-slate-700 p-3.5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="text-[11px] text-gray-400">{m.savedAt}</div>
                  <div className="font-black text-base text-white">
                    {m.teamUsName} vs {m.teamOppName}
                  </div>
                  <div className="text-xs font-bold text-blue-400 mt-0.5">
                    Set {m.gameState.currentSet} ({m.gameState.scoreUs} - {m.gameState.scoreOpp}) • Set vinti: {m.gameState.setsWonUs} - {m.gameState.setsWonOpp}
                  </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => resumeInProgressMatch(m)}
                    className="flex-1 sm:flex-initial bg-amber-600 hover:bg-amber-500 text-white px-4 py-2.5 rounded-xl font-black text-sm shadow transition-transform active:scale-95"
                  >
                    ▶️ Riprendi
                  </button>
                  <button
                    onClick={() => deleteInProgressMatch(m.id)}
                    className="bg-slate-700 hover:bg-red-700 text-gray-300 hover:text-white px-3 py-2.5 rounded-xl font-bold text-sm transition-colors"
                    title="Elimina gara salvata"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BACKUP & TRASFERIMENTO DATI */}
      <div className="w-full max-w-xl flex flex-col sm:flex-row gap-3 mt-1">
        <button
          onClick={handleExportBackup}
          className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 p-3.5 rounded-xl font-bold text-sm text-emerald-300 flex items-center justify-center gap-2 shadow"
        >
          📤 Esporta Backup Dati
        </button>
        <button
          onClick={() => backupInputRef.current?.click()}
          className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 p-3.5 rounded-xl font-bold text-sm text-blue-300 flex items-center justify-center gap-2 shadow"
        >
          📥 Importa Backup Dati
        </button>
        <input
          ref={backupInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleImportBackup}
          className="hidden"
        />
      </div>

      <button onClick={startDemoMatch} className="mt-1 text-sm text-gray-400 hover:text-white underline">
        Carica Partita Demo (Per testare Report PDF)
      </button>
    </div>
  );

  const renderTeamManagement = () => {
    if (editingTeam) {
      const sortedEditingRoster = [...editingTeam.roster].sort(
        (a, b) => (parseInt(a.num, 10) || 0) - (parseInt(b.num, 10) || 0)
      );

      return (
        <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8 font-sans">
          <button
            onClick={() => setEditingTeam(null)}
            className="bg-slate-700 px-4 py-2 rounded font-bold hover:bg-slate-600 mb-6"
          >
            🔙 Torna alle Squadre
          </button>
          <div className="bg-slate-800 p-6 rounded-xl w-full max-w-2xl mx-auto shadow-2xl">
            <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Nome Squadra</label>
            <input
              type="text"
              value={editingTeam.name}
              onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
              className="p-3 bg-slate-700 rounded text-white font-bold w-full text-2xl mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nome Squadra..."
            />

            <h3 className="text-xl font-bold mb-3">Aggiungi Atleta</h3>
            <div className="flex flex-col md:flex-row gap-2 mb-8">
              <input
                type="text"
                pattern="\d*"
                placeholder="N°"
                value={newPlayer.num}
                onChange={(e) => setNewPlayer({ ...newPlayer, num: e.target.value.replace(/\D/g, '') })}
                className="p-3 bg-slate-700 rounded w-full md:w-20 text-center font-bold"
              />
              <input
                type="text"
                placeholder="Cognome"
                value={newPlayer.cognome}
                onChange={(e) => setNewPlayer({ ...newPlayer, cognome: e.target.value })}
                className="p-3 bg-slate-700 rounded flex-1 font-bold"
              />
              <input
                type="text"
                placeholder="Nome"
                value={newPlayer.nome}
                onChange={(e) => setNewPlayer({ ...newPlayer, nome: e.target.value })}
                className="p-3 bg-slate-700 rounded flex-1"
              />
              <label className="flex items-center gap-2 bg-slate-700 px-4 py-3 rounded cursor-pointer font-bold justify-center">
                <input
                  type="checkbox"
                  checked={newPlayer.isLibero}
                  onChange={(e) => setNewPlayer({ ...newPlayer, isLibero: e.target.checked })}
                  className="w-5 h-5"
                />
                <span>Libero (L)</span>
              </label>
              <button
                onClick={() => {
                  if (newPlayer.num && newPlayer.cognome) {
                    const existsNum = editingTeam.roster.some((x) => x.num === newPlayer.num);
                    if (existsNum) {
                      setAppNotice({
                        title: 'Numero già presente',
                        message: `Esiste già un'atleta con il numero di maglia ${newPlayer.num} in questa squadra.`
                      });
                      return;
                    }
                    const updatedRoster = [...editingTeam.roster, { ...newPlayer, isPresent: false }].sort(
                      (a, b) => (parseInt(a.num, 10) || 0) - (parseInt(b.num, 10) || 0)
                    );
                    setEditingTeam((prev) => ({ ...prev, roster: updatedRoster }));
                    setNewPlayer({ num: '', cognome: '', nome: '', isLibero: false });
                  } else {
                    setAppNotice({
                      title: 'Dati incompleti',
                      message: 'Inserisci almeno il numero di maglia e il cognome della giocatrice!'
                    });
                  }
                }}
                className="bg-green-600 hover:bg-green-500 px-6 py-3 rounded font-bold"
              >
                Aggiungi
              </button>
            </div>

            <h3 className="text-lg font-bold mb-2">Roster Squadra (Ordinato per N° maglia)</h3>
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-2">
              {sortedEditingRoster.length === 0 && (
                <div className="text-gray-400">Nessun giocatore inserito.</div>
              )}
              {sortedEditingRoster.map((p, i) => (
                <div
                  key={`edit-roster-${p.num}-${i}`}
                  className="bg-slate-700 p-3 rounded flex justify-between items-center"
                >
                  <span className="font-bold text-lg">
                    <span className="text-blue-300 mr-2">#{p.num}</span>
                    {p.cognome} {p.nome}
                    {p.isLibero && (
                      <span className="bg-red-600 text-xs px-2 py-0.5 rounded ml-2 uppercase">Libero</span>
                    )}
                  </span>
                  <button
                    onClick={() =>
                      setEditingTeam((prev) => ({
                        ...prev,
                        roster: prev.roster.filter((x) => x.num !== p.num)
                      }))
                    }
                    className="text-red-400 hover:text-red-300 font-bold"
                  >
                    Rimuovi
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                if (!editingTeam.name.trim()) {
                  setAppNotice({
                    title: 'Nome mancante',
                    message: 'Inserisci il nome della squadra prima di salvare.'
                  });
                  return;
                }
                saveTeamToStorage(editingTeam);
                setEditingTeam(null);
              }}
              className="w-full bg-blue-600 hover:bg-blue-500 p-4 rounded-xl font-bold mt-8 text-xl"
            >
              💾 Salva Squadra
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8 font-sans">
        <button
          onClick={() => setView('HOME')}
          className="bg-slate-700 px-4 py-2 rounded font-bold hover:bg-slate-600 mb-6"
        >
          🔙 Torna alla Home
        </button>
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <h2 className="text-3xl font-black text-blue-400">Le Tue Squadre</h2>
            <button
              onClick={() => setEditingTeam({ id: Date.now(), name: '', roster: [] })}
              className="bg-green-600 px-6 py-3 rounded-lg font-bold hover:bg-green-500"
            >
              ➕ Crea Nuova Squadra
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savedTeams.length === 0 && (
              <div className="text-gray-400 col-span-2 text-center py-10 bg-slate-800 rounded-xl">
                Nessuna squadra salvata. Creane una per iniziare.
              </div>
            )}
            {savedTeams.map((t, idx) => (
              <div
                key={`team-${t.id}-${idx}`}
                className="bg-slate-800 p-6 rounded-xl flex flex-col gap-4 border border-slate-700 shadow-lg"
              >
                <h3 className="text-2xl font-black">{t.name}</h3>
                <div className="text-gray-400">{t.roster.length} Atlete a roster</div>
                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={() => setEditingTeam(t)}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 py-2.5 rounded font-bold"
                  >
                    Modifica Roster
                  </button>
                  <button
                    onClick={() => deleteTeamFromStorage(t.id)}
                    className="bg-red-600 hover:bg-red-500 px-4 py-2.5 rounded font-bold"
                  >
                    Elimina
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderNewMatch = () => {
    const sortedRoster = [...roster].sort(
      (a, b) => (parseInt(a.num, 10) || 0) - (parseInt(b.num, 10) || 0)
    );
    const presentCount = roster.filter((p) => p.isPresent).length;

    return (
      <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8 font-sans">
        <button
          onClick={() => setView('HOME')}
          className="bg-slate-700 px-4 py-2 rounded font-bold hover:bg-slate-600 mb-6"
        >
          🔙 Torna alla Home
        </button>

        <div className="max-w-3xl mx-auto bg-slate-800 p-6 md:p-8 rounded-2xl shadow-2xl border border-slate-700">
          <h2 className="text-3xl font-black text-green-400 mb-6">Configura Nuova Gara</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-2">
                La Tua Squadra (Seleziona)
              </label>
              <select
                value={teamUsName}
                onChange={(e) => {
                  const chosenName = e.target.value;
                  setTeamUsName(chosenName);
                  const found = savedTeams.find((t) => t.name === chosenName);
                  if (found) {
                    const cloned = found.roster
                      .map((p) => ({ ...p, isPresent: true }))
                      .sort((a, b) => (parseInt(a.num, 10) || 0) - (parseInt(b.num, 10) || 0));
                    setRoster(cloned);
                  } else {
                    setRoster([]);
                  }
                }}
                className="w-full p-3.5 bg-slate-700 rounded-xl text-white font-bold border border-slate-600 outline-none"
              >
                <option value="">-- Seleziona Squadra --</option>
                {savedTeams.map((t) => (
                  <option key={`select-team-${t.id}`} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
              {savedTeams.length === 0 && (
                <button
                  onClick={() => setView('TEAM_MANAGEMENT')}
                  className="text-xs text-blue-400 underline mt-2"
                >
                  Non hai ancora squadre salvate: creane una ora
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-2">
                Squadra Avversaria
              </label>
              <input
                type="text"
                placeholder="Nome squadra avversaria..."
                value={teamOppName}
                onChange={(e) => setTeamOppName(e.target.value)}
                className="w-full p-3.5 bg-slate-700 rounded-xl text-white font-bold border border-slate-600 outline-none"
              />
            </div>
          </div>

          {roster.length > 0 && (
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-black text-blue-300">
                  Convocazioni e Assenze ({presentCount} convocate)
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setRoster((prev) => prev.map((p) => ({ ...p, isPresent: true })))}
                    className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded font-bold"
                  >
                    Tutte Presenti
                  </button>
                  <button
                    onClick={() => setRoster((prev) => prev.map((p) => ({ ...p, isPresent: false })))}
                    className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded font-bold"
                  >
                    Deseleziona Tutte
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                {sortedRoster.map((p) => (
                  <div
                    key={`conv-${p.num}`}
                    onClick={() =>
                      setRoster((prev) =>
                        prev.map((item) =>
                          item.num === p.num ? { ...item, isPresent: !item.isPresent } : item
                        )
                      )
                    }
                    className={`p-3 rounded-xl border-2 cursor-pointer flex items-center justify-between transition-all ${
                      p.isPresent
                        ? 'bg-emerald-950/60 border-emerald-500 text-white'
                        : 'bg-slate-900/60 border-slate-700 text-gray-500'
                    }`}
                  >
                    <div className="font-bold">
                      <span className="text-lg mr-2">#{p.num}</span>
                      <span>
                        {p.cognome} {p.nome}
                      </span>
                      {p.isLibero && (
                        <span className="ml-2 text-xs bg-red-600 text-white px-1.5 py-0.5 rounded">
                          L
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-xs font-black px-2.5 py-1 rounded ${
                        p.isPresent ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-gray-400'
                      }`}
                    >
                      {p.isPresent ? 'CONVOCATA' : 'ASSENTE'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => {
              if (!teamUsName.trim() || !teamOppName.trim()) {
                setAppNotice({
                  title: 'Dati gara mancanti',
                  message: 'Seleziona la tua squadra e inserisci il nome della squadra avversaria!'
                });
                return;
              }
              if (roster.filter((p) => p.isPresent).length < 6) {
                setAppNotice({
                  title: 'Convocazioni insufficienti',
                  message: 'Devi convocare almeno 6 giocatrici per iniziare la gara!'
                });
                return;
              }
              resetGame();
              setSetupStep('CHOICE');
              setView('SETUP_COURT');
            }}
            className="w-full bg-green-600 hover:bg-green-500 p-5 rounded-xl font-black text-2xl mt-2 shadow-xl transition-transform active:scale-95"
          >
            INIZIA GARA ➔
          </button>
        </div>
      </div>
    );
  };

  const renderMatchArchive = () => (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8 font-sans">
      <button
        onClick={() => setView('HOME')}
        className="bg-slate-700 px-4 py-2 rounded font-bold hover:bg-slate-600 mb-6"
      >
        🔙 Torna alla Home
      </button>
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-black text-purple-400 mb-8">Archivio Gare Concluse & Report</h2>
        <div className="flex flex-col gap-4">
          {matchArchive.length === 0 && (
            <div className="text-gray-400 bg-slate-800 p-8 rounded-xl text-center">
              Nessuna gara conclusa salvata in archivio.
            </div>
          )}
          {matchArchive.map((m) => (
            <div
              key={`archive-${m.id}`}
              className="bg-slate-800 p-6 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4 border border-slate-700 shadow-lg"
            >
              <div>
                <div className="text-sm text-gray-400">{m.date}</div>
                <div className="text-2xl font-black">
                  {m.teamUsName} vs {m.teamOppName}
                </div>
                <div className="text-sm font-bold text-blue-400 mt-1">
                  Set Vinti: {m.gameState.setsWonUs} - {m.gameState.setsWonOpp}
                </div>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <button
                  onClick={() => {
                    setTeamUsName(m.teamUsName);
                    setTeamOppName(m.teamOppName);
                    setGameState(m.gameState);
                    setStats(m.stats || []);
                    setRallies(m.rallies || []);
                    setRoster(m.roster || []);
                    setStatsFilter('ALL');
                    setPhaseFilter('ALL');
                    setRotationFilter('ALL');
                    setIsViewingArchive(true);
                    setView('STATS');
                  }}
                  className="flex-1 md:flex-initial bg-purple-600 hover:bg-purple-500 px-6 py-4 rounded-xl font-bold whitespace-nowrap"
                >
                  📊 Apri Report PDF
                </button>
                <button
                  onClick={() => deleteArchivedMatch(m.id)}
                  className="bg-slate-700 hover:bg-red-700 text-gray-300 hover:text-white px-4 py-4 rounded-xl font-bold transition-colors"
                  title="Elimina gara dall'archivio"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSetupCourt = () => {
    const activeRoster = roster
      .filter((p) => p.isPresent)
      .sort((a, b) => (parseInt(a.num, 10) || 0) - (parseInt(b.num, 10) || 0));

    const rotateCourt = (direction) => {
      const c = { ...court };
      if (direction === 'CW') {
        const temp = c[2];
        c[2] = c[3];
        c[3] = c[4];
        c[4] = c[5];
        c[5] = c[6];
        c[6] = c[1];
        c[1] = temp;
      } else {
        const temp = c[1];
        c[1] = c[6];
        c[6] = c[5];
        c[5] = c[4];
        c[4] = c[3];
        c[3] = c[2];
        c[2] = temp;
      }
      setCourt(c);
    };

    const handleZoneClick = (z) => {
      if (setupSelectedZone === null) {
        setSetupSelectedZone(z);
      } else if (setupSelectedZone === z) {
        setSetupSelectedZone(null);
      } else {
        const c = { ...court };
        const temp = c[setupSelectedZone];
        c[setupSelectedZone] = c[z];
        c[z] = temp;
        setCourt(c);
        setSetupSelectedZone(null);
      }
    };

    const assignBenchPlayerToCourt = (p, targetZone = null) => {
      if (targetZone !== null) {
        setCourt((prev) => ({ ...prev, [targetZone]: p }));
        setSetupSelectedZone(null);
        return;
      }
      if (setupSelectedZone !== null) {
        setCourt((prev) => ({ ...prev, [setupSelectedZone]: p }));
        setSetupSelectedZone(null);
        return;
      }
      const zoneOrder = [4, 3, 2, 5, 6, 1];
      const firstEmpty = zoneOrder.find((z) => !court[z]);
      if (firstEmpty) {
        setCourt((prev) => ({ ...prev, [firstEmpty]: p }));
      }
    };

    if (setupStep === 'CHOICE') {
      return (
        <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8 flex flex-col items-center justify-center font-sans">
          <div className="bg-slate-800 p-8 rounded-2xl max-w-lg w-full text-center shadow-2xl border border-slate-700">
            <h2 className="text-2xl font-black mb-4 text-blue-400">
              Inizio Set {gameState.currentSet} {gameState.currentSet === 5 ? '(Tie-Break)' : ''}
            </h2>
            <p className="text-gray-300 mb-8">
              Quale squadra comincia al servizio all'inizio di questo set?
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => {
                  setServingFirst('US');
                  if (gameState.currentSet === 1) setFirstSetServer('US');
                  setSetupStep('COURT');
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-500 p-4 rounded-xl font-bold text-lg"
              >
                Noi ({teamUsName})
              </button>
              <button
                onClick={() => {
                  setServingFirst('OPP');
                  if (gameState.currentSet === 1) setFirstSetServer('OPP');
                  setSetupStep('COURT');
                }}
                className="flex-1 bg-red-600 hover:bg-red-500 p-4 rounded-xl font-bold text-lg"
              >
                Avversario ({teamOppName})
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-900 text-white p-4 md:p-6 flex flex-col font-sans">
        <h2 className="text-2xl font-black mb-1 text-center text-blue-400">
          Schieramento Formazione Iniziale - Set {gameState.currentSet}
        </h2>
        <div className="text-center text-sm text-yellow-400 mb-4 font-bold">
          Servizio iniziale: {servingFirst === 'US' ? `${teamUsName} (Fase BP)` : `${teamOppName} (Fase CP)`}
        </div>

        <div className="flex flex-wrap justify-center gap-3 mb-5">
          <button
            onClick={() => rotateCourt('CCW')}
            className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg font-bold text-sm shadow"
          >
            ↺ Ruota Antiorario
          </button>
          <button
            onClick={() => rotateCourt('CW')}
            className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg font-bold text-sm shadow"
          >
            ↻ Ruota Orario
          </button>
          <button
            onClick={() => setCourt({ 1: null, 2: null, 3: null, 4: null, 5: null, 6: null })}
            className="bg-red-900/60 hover:bg-red-800 px-4 py-2 rounded-lg font-bold text-sm shadow text-red-200"
          >
            🗑️ Svuota Campo
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-6 items-start justify-center max-w-5xl mx-auto w-full">
          <div className="bg-slate-800 p-4 rounded-xl w-full md:w-1/3 shadow-lg border border-slate-700">
            <h3 className="font-bold mb-1">Panchina Convocate</h3>
            <p className="text-xs text-gray-400 mb-3">
              Tocca un'atleta (o trascinala sul campo) per inserirla nella zona selezionata o nel primo posto libero.
            </p>
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
              {activeRoster
                .filter((p) => !Object.values(court).find((c) => c && c.num === p.num))
                .map((p, i) => (
                  <button
                    key={`bench-player-${p.num}-${i}`}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('playerNum', p.num)}
                    onClick={() => assignBenchPlayerToCourt(p)}
                    className="bg-slate-700 hover:bg-slate-600 p-3 rounded-lg text-sm w-full text-left flex justify-between items-center font-bold transition-colors"
                  >
                    <span>
                      #{p.num} {getShortName(p)} {p.isLibero && <span className="text-red-400">(L)</span>}
                    </span>
                    <span className="text-xs text-blue-300 bg-blue-950 px-2 py-1 rounded">
                      {setupSelectedZone !== null ? `Metti in Z${setupSelectedZone}` : '+ Inserisci'}
                    </span>
                  </button>
                ))}
            </div>
            {setupSelectedZone !== null && (
              <div className="mt-3 text-yellow-400 text-xs animate-pulse text-center font-bold">
                Zona {setupSelectedZone} selezionata: tocca una giocatrice o un'altra zona per scambiarle
              </div>
            )}
          </div>

          <div className="relative w-full max-w-lg aspect-square bg-orange-200/20 border-4 border-white rounded-xl grid grid-cols-3 grid-rows-2 p-2 gap-2 shadow-2xl">
            <div className="absolute top-1/2 left-0 right-0 border-t-2 border-white/50 border-dashed pointer-events-none"></div>
            {[4, 3, 2, 5, 6, 1].map((z) => {
              const p = court[z];
              return (
                <div
                  key={`court-setup-z-${z}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const pNum = e.dataTransfer.getData('playerNum');
                    const foundP = activeRoster.find((x) => x.num === pNum);
                    if (foundP) assignBenchPlayerToCourt(foundP, z);
                  }}
                  onClick={() => handleZoneClick(z)}
                  className={`relative flex items-center justify-center border-2 rounded-xl cursor-pointer transition-all p-2 ${
                    setupSelectedZone === z
                      ? 'border-yellow-400 bg-yellow-400/30 scale-[1.03] ring-4 ring-yellow-400/50'
                      : p?.isLibero
                      ? 'border-red-400/60 bg-red-950/60 hover:bg-red-900/60'
                      : 'border-white/30 bg-slate-800/70 hover:bg-slate-700/80'
                  }`}
                >
                  <span className="absolute top-1.5 left-2 text-xs font-black text-white/60">Z{z}</span>
                  {p ? (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCourt((prev) => ({ ...prev, [z]: null }));
                          if (startingSetterNum === p.num) setStartingSetterNum(null);
                        }}
                        className="absolute top-1 right-1 bg-black/50 hover:bg-red-600 text-white rounded-full w-6 h-6 text-xs font-bold flex items-center justify-center"
                        title="Rimuovi dal campo"
                      >
                        ✕
                      </button>
                      <div className="text-center font-bold">
                        <div className="text-3xl drop-shadow">{p.num}</div>
                        <div className="text-xs truncate max-w-[110px]">
                          {getShortName(p)} {p.isLibero && '(L)'}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-white/40 font-bold text-2xl">Z{z}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 mb-4 flex flex-col items-center">
          <h3 className="font-bold text-gray-300 mb-2">Indica la Palleggiatrice Titolare in Campo:</h3>
          <select
            value={startingSetterNum || ''}
            onChange={(e) => setStartingSetterNum(e.target.value)}
            className="bg-slate-700 text-white p-3 rounded-lg font-bold border-2 border-purple-500 outline-none min-w-[270px]"
          >
            <option value="">-- Seleziona Palleggiatrice --</option>
            {Object.values(court)
              .filter((c) => c && !c.isLibero)
              .map((p) => (
                <option key={`setter-opt-${p.num}`} value={p.num}>
                  #{p.num} - {getShortName(p)}
                </option>
              ))}
          </select>
          <p className="text-xs text-purple-300 mt-2 font-bold bg-purple-900/30 px-3 py-1 rounded">
            La rotazione (P1-P6) verrà calcolata automaticamente in base alla sua zona in campo.
          </p>
        </div>

        <div className="mt-2 flex justify-center">
          <button
            onClick={() => {
              if (!Object.values(court).every((c) => c !== null)) {
                setAppNotice({
                  title: 'Formazione incompleta',
                  message: 'Completa tutte e 6 le zone del sestetto in campo prima di iniziare!'
                });
                return;
              }
              if (!startingSetterNum) {
                setAppNotice({
                  title: 'Palleggiatrice mancante',
                  message: 'Seleziona la Palleggiatrice titolare per calcolare automaticamente la rotazione!'
                });
                return;
              }
              const setterZone = Object.keys(court).find((z) => court[z]?.num === startingSetterNum);
              if (!setterZone) {
                setAppNotice({
                  title: 'Palleggiatrice non in campo',
                  message: 'La palleggiatrice selezionata deve essere schierata in una delle 6 zone in campo!'
                });
                return;
              }

              const initialRotation = `P${setterZone}`;
              const finalCourt = { ...court };
              for (const z in finalCourt) {
                if (finalCourt[z]) {
                  finalCourt[z] = {
                    ...finalCourt[z],
                    isSetter: finalCourt[z].num === startingSetterNum
                  };
                }
              }

              setSubsCount(0);
              setClosedSubs([]);
              setRecentBenchPlayers({});
              setTimeouts({ us: 0, opp: 0 });
              setLastInitialCourt(finalCourt);
              setCourt(finalCourt);
              setGameState((prev) => ({
                ...prev,
                phase: servingFirst === 'US' ? 'BP' : 'CP',
                currentRotation: initialRotation
              }));
              setView('GAME');
            }}
            className="bg-green-600 hover:bg-green-500 py-4 px-12 rounded-xl font-black text-xl shadow-lg transition-transform active:scale-95"
          >
            CONFERMA E INIZIA SET
          </button>
        </div>
      </div>
    );
  };

  const renderGame = () => {
    const courtZones = [4, 3, 2, 5, 6, 1];
    const bench = roster
      .filter((p) => p.isPresent && !Object.values(court).find((c) => c && c.num === p.num))
      .sort((a, b) => (parseInt(a.num, 10) || 0) - (parseInt(b.num, 10) || 0));

    const subTargetPlayer = subTargetZone ? court[subTargetZone] : null;

    let expectedBenchNum = null;
    if (subTargetPlayer) {
      if (subTargetPlayer.isLibero && liberoTracker.replaced) {
        expectedBenchNum = liberoTracker.replaced;
      } else {
        const activePair = closedSubs.find(
          (pair) => !pair.isClosed && (pair.bench === subTargetPlayer.num || pair.starter === subTargetPlayer.num)
        );
        if (activePair) {
          expectedBenchNum =
            activePair.bench === subTargetPlayer.num ? activePair.starter : activePair.bench;
        }
      }
    }

    let quickLiberoBtn = null;
    if (subTargetPlayer && subTargetPlayer.isLibero && liberoTracker.replaced) {
      const replacedPlayer = roster.find((p) => p.num === liberoTracker.replaced);
      if (replacedPlayer) {
        quickLiberoBtn = (
          <button
            onClick={() => handleSubRequest(subTargetZone, replacedPlayer)}
            className="w-full bg-orange-600 hover:bg-orange-500 p-3.5 rounded-xl font-black mb-4 shadow-lg flex items-center justify-center gap-2 text-sm md:text-base"
          >
            🔄 CAMBIO RAPIDO: Fuori Libero, Entra #{replacedPlayer.num} {getShortName(replacedPlayer)}
          </button>
        );
      }
    } else if (subTargetPlayer && !subTargetPlayer.isLibero) {
      const liberoOnBench = bench.find((p) => p.isLibero);
      if (liberoOnBench) {
        quickLiberoBtn = (
          <button
            onClick={() => handleSubRequest(subTargetZone, liberoOnBench)}
            className="w-full bg-orange-600 hover:bg-orange-500 p-3.5 rounded-xl font-black mb-4 shadow-lg flex items-center justify-center gap-2 text-sm md:text-base"
          >
            🔄 CAMBIO RAPIDO: Entra Libero (#{liberoOnBench.num} {getShortName(liberoOnBench)})
          </button>
        );
      }
    }

    const handleActionClick = (num, skill) => {
      const isLiberoInFrontRow = [2, 3, 4].some((z) => court[z] && court[z].isLibero);
      if (isLiberoInFrontRow) {
        setAppNotice({
          title: '⛔ Azione Bloccata',
          message:
            "Il Libero si trova in prima linea (Zona 2, 3 o 4)! Da regolamento non può proseguire l'azione: effettua prima la sostituzione obbligatoria toccando l'etichetta del giocatore."
        });
        return;
      }
      setSelectedPlayer(num);
      setSelectedSkill(skill);
    };

    const activePlayerObj = selectedPlayer ? roster.find((p) => p.num === selectedPlayer) : null;

    return (
      <div className="h-screen bg-slate-900 text-white flex flex-col font-sans relative overflow-hidden">
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @keyframes rollUp {
                0% { transform: translateY(0); }
                20% { transform: translateY(0); }
                75% { transform: translateY(-50%); }
                100% { transform: translateY(-50%); }
              }
            `
          }}
        />

        {pointBanner && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center pointer-events-none bg-black/40 backdrop-blur-[2px]">
            <div className="bg-slate-900/95 border-2 border-white/30 px-8 py-5 rounded-3xl shadow-2xl flex flex-col items-center">
              <div
                className={`text-sm font-black uppercase tracking-widest mb-2 ${
                  pointBanner.team === 'US' ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {pointBanner.text}
              </div>
              <div className="flex items-center gap-6 text-5xl font-black">
                <div className="h-14 overflow-hidden flex flex-col items-center">
                  <div
                    style={
                      pointBanner.oldUs !== pointBanner.newUs
                        ? { animation: 'rollUp 0.8s ease-out forwards' }
                        : {}
                    }
                    className="flex flex-col"
                  >
                    <span className="h-14 flex items-center justify-center text-blue-400">
                      {pointBanner.oldUs}
                    </span>
                    <span className="h-14 flex items-center justify-center text-emerald-400">
                      {pointBanner.newUs}
                    </span>
                  </div>
                </div>
                <span className="text-gray-500 text-3xl">-</span>
                <div className="h-14 overflow-hidden flex flex-col items-center">
                  <div
                    style={
                      pointBanner.oldOpp !== pointBanner.newOpp
                        ? { animation: 'rollUp 0.8s ease-out forwards' }
                        : {}
                    }
                    className="flex flex-col"
                  >
                    <span className="h-14 flex items-center justify-center text-red-400">
                      {pointBanner.oldOpp}
                    </span>
                    <span className="h-14 flex items-center justify-center text-red-300">
                      {pointBanner.newOpp}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center px-3 py-2 bg-slate-800 border-b border-slate-700 shrink-0">
          <button
            onClick={handleUndo}
            disabled={historyStack.length === 0}
            className={`px-3 py-2 rounded font-bold text-sm ${
              historyStack.length > 0
                ? 'bg-slate-700 hover:bg-slate-600 text-white'
                : 'bg-slate-800 text-gray-600 cursor-not-allowed'
            }`}
          >
            ↩️ Undo
          </button>

          <div className="text-center">
            <div className="text-xs font-bold text-gray-400">
              SET {gameState.currentSet} • Set Vinti: {gameState.setsWonUs} - {gameState.setsWonOpp}
            </div>
            <div className="text-2xl md:text-3xl font-black tracking-wider flex items-center justify-center gap-3">
              <span className="text-xs md:text-sm font-bold text-blue-300 truncate max-w-[110px]">
                {teamUsName}
              </span>
              <span className={gameState.phase === 'BP' ? 'text-yellow-400' : 'text-white'}>
                {gameState.scoreUs}
              </span>
              <span className="text-lg text-gray-500">-</span>
              <span className={gameState.phase === 'CP' ? 'text-yellow-400' : 'text-white'}>
                {gameState.scoreOpp}
              </span>
              <span className="text-xs md:text-sm font-bold text-red-300 truncate max-w-[110px]">
                {teamOppName}
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              setStatsFilter('ALL');
              setPhaseFilter('ALL');
              setRotationFilter('ALL');
              setView('STATS');
            }}
            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded font-bold text-sm shadow"
          >
            📊 Stats / Report
          </button>
        </div>

        <div className="flex justify-between items-center px-4 py-1.5 bg-slate-800/60 text-xs md:text-sm border-b border-slate-700 shrink-0">
          <div className="flex gap-2 md:gap-4 items-center">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-blue-400">T.O:</span>
              <button
                onClick={() =>
                  timeouts.us < 2 && setTimeouts((prev) => ({ ...prev, us: prev.us + 1 }))
                }
                className={`px-2.5 py-0.5 rounded font-black ${
                  timeouts.us < 2
                    ? 'bg-slate-700 hover:bg-slate-600 text-white'
                    : 'bg-red-900/60 text-red-300 cursor-not-allowed'
                }`}
              >
                {2 - timeouts.us}/2
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-emerald-400">Cambi:</span>
              <span
                className={`px-2.5 py-0.5 rounded font-black ${
                  subsCount < 8 ? 'bg-slate-700 text-white' : 'bg-red-900/60 text-red-300'
                }`}
              >
                {8 - subsCount}/8
              </span>
            </div>
          </div>

          <div className="font-black text-base md:text-lg flex items-center gap-3">
            <span
              className={`px-2.5 py-0.5 rounded ${
                gameState.phase === 'BP'
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}
            >
              {gameState.phase}
            </span>
            <span className="text-gray-500">|</span>
            <span className="text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded border border-blue-500/30">
              {gameState.currentRotation}
            </span>
          </div>

          <div className="flex gap-2 items-center">
            <span className="font-bold text-red-400">T.O (Avv):</span>
            <button
              onClick={() =>
                timeouts.opp < 2 && setTimeouts((prev) => ({ ...prev, opp: prev.opp + 1 }))
              }
              className={`px-2.5 py-0.5 rounded font-black ${
                timeouts.opp < 2
                  ? 'bg-slate-700 hover:bg-slate-600 text-white'
                  : 'bg-red-900/60 text-red-300 cursor-not-allowed'
              }`}
            >
              {2 - timeouts.opp}/2
            </button>
          </div>
        </div>

        <div className="flex-1 flex p-2 gap-2 overflow-hidden">
          <div className="w-[64%] md:w-[67%] relative bg-[#d68453] border-4 border-white rounded-xl shadow-2xl grid grid-cols-3 grid-rows-2 p-1.5 gap-1.5">
            <div className="absolute top-1/2 left-0 right-0 border-t-2 border-white/60 border-dashed z-0 pointer-events-none"></div>
            {courtZones.map((z) => {
              const p = court[z];
              const isLiberoInFront = p?.isLibero && [2, 3, 4].includes(z);
              const isSetter = p?.isSetter;

              const wrapperBaseClass = p?.isLibero
                ? 'bg-gradient-to-br from-red-900 to-red-950/95'
                : isSetter
                ? 'bg-gradient-to-br from-indigo-900/95 to-purple-900/95'
                : 'bg-gradient-to-br from-blue-900/95 to-slate-900';

              const headerBaseClass = p?.isLibero
                ? 'bg-gradient-to-r from-red-700 to-red-800 hover:from-red-600 hover:to-red-700'
                : isSetter
                ? 'bg-gradient-to-r from-indigo-700 to-purple-800 hover:from-indigo-600 hover:to-purple-700'
                : 'bg-gradient-to-r from-blue-700 to-blue-800 hover:from-blue-600 hover:to-blue-700';

              const ringColor = p?.isLibero
                ? 'ring-red-400'
                : isSetter
                ? 'ring-purple-400'
                : 'ring-blue-400';

              return (
                <div
                  key={`court-zone-${z}`}
                  className={`relative z-10 flex flex-col rounded-lg p-1 transition-transform ${
                    selectedPlayer === p?.num
                      ? `ring-4 ${ringColor} scale-[1.01] z-20 ${wrapperBaseClass}`
                      : wrapperBaseClass
                  }`}
                >
                  <div
                    onClick={() => {
                      if (!ballInPlay && !selectedSkill) {
                        setSubTargetZone(z);
                        setShowSubModal(true);
                      }
                    }}
                    title={!ballInPlay ? 'Tocca per effettuare una sostituzione' : 'Palla in gioco: cambi bloccati'}
                    className={`flex-[0_0_34%] min-h-[38px] flex justify-between items-center border-b border-white/20 relative rounded-t px-2 overflow-hidden shadow-inner ${headerBaseClass} ${
                      !ballInPlay ? 'cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <div className="font-black text-lg md:text-2xl text-white truncate w-full flex items-center gap-1.5 drop-shadow">
                      <span>{p?.num}</span>
                      <span className="text-xs md:text-sm font-bold text-gray-100 truncate">
                        {getShortName(p)}
                        {p?.isLibero && <span className="font-black text-red-200 ml-1">(L)</span>}
                        {isSetter && <span className="font-black text-purple-200 ml-1">(P)</span>}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0 z-10">
                      <span className="text-[10px] bg-black/60 px-1.5 rounded font-bold">Z{z}</span>
                      {!ballInPlay && (
                        <span className="text-[8px] md:text-[9px] bg-white/20 px-1 rounded font-bold text-white">
                          🔄 CAMBIO
                        </span>
                      )}
                    </div>
                  </div>

                  {isLiberoInFront && (
                    <div
                      className="absolute top-1 right-14 text-lg md:text-xl animate-bounce drop-shadow-md z-30"
                      title="Attenzione: Libero in prima linea!"
                    >
                      ⚠️
                    </div>
                  )}

                  <div className="flex-[0_0_66%] flex flex-col justify-end w-full pt-1">
                    {!ballInPlay ? (
                      gameState.phase === 'BP' ? (
                        z === 1 ? (
                          <button
                            onClick={() => handleActionClick(p.num, 'BATTUTA')}
                            className={`h-full w-full rounded font-black text-sm md:text-lg shadow-md flex items-center justify-center transition-all ${
                              selectedPlayer === p.num && selectedSkill === 'BATTUTA'
                                ? 'bg-yellow-400 text-slate-900 ring-2 ring-white'
                                : 'bg-blue-500 hover:bg-blue-400 text-white'
                            }`}
                          >
                            BATTUTA
                          </button>
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-center text-[10px] md:text-xs text-gray-300 font-bold px-1">
                            In attesa di battuta...
                          </div>
                        )
                      ) : (
                        <button
                          onClick={() => handleActionClick(p.num, 'RICEZIONE')}
                          className={`h-full w-full rounded font-black text-sm md:text-lg shadow-md flex items-center justify-center transition-all ${
                            selectedPlayer === p.num && selectedSkill === 'RICEZIONE'
                              ? 'bg-yellow-400 text-slate-900 ring-2 ring-white'
                              : 'bg-green-600 hover:bg-green-500 text-white'
                          }`}
                        >
                          RICEZIONE
                        </button>
                      )
                    ) : (
                      <div className="h-full w-full flex flex-col gap-1">
                        <div className="flex-1 grid grid-cols-2 gap-1">
                          <button
                            onClick={() => handleActionClick(p.num, 'ATTACCO')}
                            className={`rounded font-black text-[11px] md:text-sm shadow-sm flex items-center justify-center leading-none ${
                              selectedPlayer === p.num && selectedSkill === 'ATTACCO'
                                ? 'bg-yellow-400 text-slate-900'
                                : 'bg-red-500 hover:bg-red-400 text-white'
                            }`}
                          >
                            ATTACCO
                          </button>
                          <button
                            onClick={() => handleActionClick(p.num, 'MURO')}
                            className={`rounded font-black text-[11px] md:text-sm shadow-sm flex items-center justify-center leading-none ${
                              selectedPlayer === p.num && selectedSkill === 'MURO'
                                ? 'bg-yellow-400 text-slate-900'
                                : 'bg-orange-500 hover:bg-orange-400 text-white'
                            }`}
                          >
                            MURO
                          </button>
                          <button
                            onClick={() => handleActionClick(p.num, 'DIFESA')}
                            className={`rounded font-black text-[11px] md:text-sm shadow-sm flex items-center justify-center leading-none ${
                              selectedPlayer === p.num && selectedSkill === 'DIFESA'
                                ? 'bg-yellow-400 text-slate-900'
                                : 'bg-amber-600 hover:bg-amber-500 text-white'
                            }`}
                          >
                            DIFESA
                          </button>
                          <button
                            onClick={() => handleActionClick(p.num, 'FREEBALL')}
                            className={`rounded font-black text-[10px] md:text-xs shadow-sm flex items-center justify-center leading-none text-center ${
                              selectedPlayer === p.num && selectedSkill === 'FREEBALL'
                                ? 'bg-yellow-400 text-slate-900'
                                : 'bg-teal-600 hover:bg-teal-500 text-white'
                            }`}
                          >
                            FREEBALL
                          </button>
                        </div>
                        <button
                          onClick={() => handleActionClick(p.num, 'FALLO')}
                          className={`h-[26%] min-h-[22px] shrink-0 rounded font-bold text-[10px] md:text-xs shadow-sm ${
                            selectedPlayer === p.num && selectedSkill === 'FALLO'
                              ? 'bg-yellow-400 text-slate-900'
                              : 'bg-slate-700 hover:bg-slate-600 text-red-200'
                          }`}
                        >
                          FALLO / ERRORE (-)
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="w-[36%] md:w-[33%] flex flex-col gap-2 h-full overflow-hidden bg-slate-800 p-3 rounded-xl border border-slate-700 shadow-xl">
            {selectedPlayer && selectedSkill ? (
              <div className="flex-1 flex flex-col justify-between overflow-y-auto">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2 mb-3">
                    <div>
                      <div className="text-xs font-bold uppercase text-blue-400">Valutazione Fondamentale</div>
                      <div className="text-lg md:text-xl font-black text-white">
                        #{selectedPlayer} {getShortName(activePlayerObj)} •{' '}
                        <span className="text-yellow-400">{selectedSkill}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    {SKILL_EVALUATIONS[selectedSkill].map((ev) => (
                      <button
                        key={ev.val}
                        onClick={() => addStat(selectedPlayer, selectedSkill, ev.val)}
                        className={`${ev.bg} hover:brightness-110 py-3.5 px-4 rounded-xl flex flex-col items-center justify-center shadow-lg border border-white/20 transition-transform active:scale-95`}
                      >
                        <span className="font-black text-white text-3xl md:text-4xl leading-none">
                          {ev.val}
                        </span>
                        <span className="text-xs md:text-sm text-white/95 font-bold mt-1">
                          ({ev.label})
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedPlayer(null);
                    setSelectedSkill(null);
                  }}
                  className="w-full bg-slate-600 hover:bg-slate-500 text-white py-3.5 rounded-xl font-black text-sm mt-3 shadow"
                >
                  🔙 ANNULLA SELEZIONE
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => {
                      saveHistory();
                      handlePoint('US', 'Punto diretto assegnato a Noi (+1)');
                    }}
                    className="flex-1 bg-green-700 hover:bg-green-600 rounded-xl flex flex-col items-center justify-center py-2.5 border border-green-500 shadow-lg transition-transform active:scale-95"
                  >
                    <span className="text-lg leading-none mb-0.5">➕</span>
                    <span className="text-xs md:text-sm font-black">P.to Noi</span>
                  </button>
                  <button
                    onClick={() => {
                      saveHistory();
                      handlePoint('OPP', 'Punto diretto assegnato agli Avversari (+1)');
                    }}
                    className="flex-1 bg-red-700 hover:bg-red-600 rounded-xl flex flex-col items-center justify-center py-2.5 border border-red-500 shadow-lg transition-transform active:scale-95"
                  >
                    <span className="text-lg leading-none mb-0.5">➖</span>
                    <span className="text-xs md:text-sm font-black">P.to Avv</span>
                  </button>
                </div>

                <div className="flex-1 bg-slate-900 rounded-xl p-3 overflow-y-auto text-xs border border-slate-700 shadow-inner flex flex-col">
                  <div className="font-bold text-gray-400 mb-2 border-b border-gray-700 pb-1 uppercase tracking-wider text-[11px] shrink-0">
                    Log Rally & Recap
                  </div>

                  {playByPlay.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {playByPlay.map((log, idx) => (
                        <div
                          key={`pbp-log-${idx}`}
                          className="text-gray-100 border-b border-white/10 pb-1.5 leading-snug font-semibold"
                        >
                          {idx + 1}. {log}
                        </div>
                      ))}
                    </div>
                  ) : lastRallySummary.length > 0 ? (
                    <div className="p-2.5 bg-slate-800/95 rounded-lg border border-yellow-500/40 text-yellow-100">
                      <div className="text-[10px] font-black uppercase tracking-wider text-yellow-400 mb-1.5">
                        Ultimo Punto Concluso:
                      </div>
                      {lastRallySummary.map((l, idx) => (
                        <div key={`last-rally-${idx}`} className="text-gray-200 mb-1 text-xs leading-snug">
                          {idx + 1}. {l}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-500 text-center italic my-auto">
                      In attesa della prima azione...
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 shrink-0">
                  <button
                    onClick={() => addStat(null, null, null, true, 'err_gen_avv')}
                    className="bg-slate-700 p-3 rounded-xl text-xs font-black text-red-300 hover:bg-slate-600 leading-tight shadow border border-slate-600 text-center"
                  >
                    Errore generico / Fallo avversario
                  </button>
                  <button
                    onClick={() => addStat(null, null, null, true, 'err_battuta_avv')}
                    className="bg-slate-700 p-3 rounded-xl text-xs font-black text-red-300 hover:bg-slate-600 leading-tight shadow border border-slate-600 text-center"
                  >
                    Errore Battuta Avversaria
                  </button>
                  <button
                    onClick={() => addStat(null, null, null, true, 'err_attacco_avv')}
                    className="bg-slate-700 p-3 rounded-xl text-xs font-black text-red-300 hover:bg-slate-600 leading-tight shadow border border-slate-600 text-center"
                  >
                    Errore Attacco Avversario
                  </button>
                  <button
                    onClick={() => addStat(null, null, null, true, 'free_concessa')}
                    className="bg-slate-700 p-3 rounded-xl text-xs font-black text-blue-200 hover:bg-slate-600 leading-tight shadow border border-slate-600 text-center"
                  >
                    Freeball Concessa
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {showSubModal && subTargetPlayer && (
          <div className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-slate-800 border-2 border-blue-500 rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-black text-blue-400">
                  Sostituzione Zona {subTargetZone}
                </h3>
                <button
                  onClick={() => {
                    setShowSubModal(false);
                    setSubTargetZone(null);
                    setPendingSub(null);
                  }}
                  className="bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="bg-slate-900 p-3 rounded-xl mb-4 border border-slate-700">
                <span className="text-xs text-gray-400 block">Giocatrice in uscita:</span>
                <span className="text-lg font-black text-white">
                  #{subTargetPlayer.num} {getShortName(subTargetPlayer)}{' '}
                  {subTargetPlayer.isLibero && '(L)'}
                  {subTargetPlayer.isSetter && '(P)'}
                </span>
              </div>

              {quickLiberoBtn}

              {pendingSub && (
                <div className="bg-red-950/90 border-2 border-red-500 p-4 rounded-xl mb-4">
                  <div className="font-black text-red-400 text-sm mb-1">
                    ⚠️ SOSTITUZIONE NON REGOLAMENTARE
                  </div>
                  <p className="text-xs text-gray-200 mb-3 leading-relaxed">{pendingSub.reason}</p>
                  <button
                    onClick={() => executeSubstitution(pendingSub.zone, pendingSub.incomingPlayer)}
                    className="w-full bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-lg font-black text-xs uppercase tracking-wider shadow"
                  >
                    ⚠️ FORZA CAMBIO (Eccezione / Infortunio)
                  </button>
                </div>
              )}

              <div className="text-xs font-bold uppercase text-gray-400 mb-2">
                Seleziona Giocatrice dalla Panchina:
              </div>
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                {bench.length === 0 && (
                  <div className="text-gray-400 text-sm text-center py-4">
                    Nessuna giocatrice disponibile in panchina.
                  </div>
                )}
                {bench.map((bp) => {
                  const isExpected = expectedBenchNum === bp.num;
                  return (
                    <button
                      key={`sub-bench-${bp.num}`}
                      onClick={() => handleSubRequest(subTargetZone, bp)}
                      className={`p-3.5 rounded-xl flex justify-between items-center font-bold text-left transition-all ${
                        isExpected
                          ? 'bg-emerald-900/80 border-2 border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.4)]'
                          : 'bg-slate-700 hover:bg-slate-600 border border-slate-600'
                      }`}
                    >
                      <span>
                        #{bp.num} {getShortName(bp)} {bp.isLibero && '(L)'}
                      </span>
                      {isExpected && (
                        <span className="text-[10px] font-black bg-emerald-500 text-slate-950 px-2 py-0.5 rounded uppercase">
                          CAMBIO ATTESO
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStats = () => {
    const targetPts = gameState.currentSet === 5 ? 15 : 25;
    const isCurrentSetFinished =
      (gameState.scoreUs >= targetPts || gameState.scoreOpp >= targetPts) &&
      Math.abs(gameState.scoreUs - gameState.scoreOpp) >= 2;
    const isMatchFinished = gameState.setsWonUs >= 3 || gameState.setsWonOpp >= 3;

    const filteredStats = stats.filter((s) => {
      if (statsFilter !== 'ALL' && String(s.set) !== String(statsFilter)) return false;
      if (phaseFilter !== 'ALL' && s.phase !== phaseFilter) return false;
      if (rotationFilter !== 'ALL' && s.rotation !== rotationFilter) return false;
      return true;
    });

    const filteredRallies = rallies.filter((r) => {
      if (statsFilter !== 'ALL' && String(r.set) !== String(statsFilter)) return false;
      return true;
    });

    const totalRalliesCount = filteredRallies.length;
    const cpRallies = filteredRallies.filter((r) => r.phase === 'CP');
    const bpRallies = filteredRallies.filter((r) => r.phase === 'BP');
    const cpWon = cpRallies.filter((r) => r.winner === 'US').length;
    const bpWon = bpRallies.filter((r) => r.winner === 'US').length;

    const pct = (num, den) => (den > 0 ? `${Math.round((num / den) * 100)}%` : '-');

    const freeConcesse = filteredStats.filter((s) => s.skill === 'GEN' && s.evalVal === 'free_concessa').length;
    const errGenAvv = filteredStats.filter((s) => s.skill === 'GEN' && s.evalVal === 'err_gen_avv').length;
    const errBattAvv = filteredStats.filter((s) => s.skill === 'GEN' && s.evalVal === 'err_battuta_avv').length;
    const errAttAvv = filteredStats.filter((s) => s.skill === 'GEN' && s.evalVal === 'err_attacco_avv').length;
    const falliInd = filteredStats.filter((s) => s.skill === 'FALLO').length;

    const ricEvents = filteredStats.filter((s) => s.skill === 'RICEZIONE');
    const oppAce = ricEvents.filter((s) => s.evalVal === '-').length;
    const oppServePos = ricEvents.filter((s) => s.evalVal !== '-').length;
    const oppServeTot = errBattAvv + oppServePos + oppAce;

    const difEvents = filteredStats.filter((s) => s.skill === 'DIFESA');
    const oppAttPoint = difEvents.filter((s) => s.evalVal === '-').length;
    const oppAttDug = difEvents.filter((s) => s.evalVal === '+' || s.evalVal === '/').length;
    const oppAttTot = errAttAvv + oppAttDug + oppAttPoint;

    const sortedReportRoster = [...roster].sort(
      (a, b) => (parseInt(a.num, 10) || 0) - (parseInt(b.num, 10) || 0)
    );

    const calcPlayerRow = (pNum) => {
      const pStats = pNum === 'TEAM' ? filteredStats : filteredStats.filter((s) => s.playerNum === pNum);

      const srv = pStats.filter((s) => s.skill === 'BATTUTA');
      const srvAce = srv.filter((s) => s.evalVal === '#').length;
      const srvPos = srv.filter((s) => s.evalVal === '+').length;
      const srvErr = srv.filter((s) => s.evalVal === '-').length;

      const ric = pStats.filter((s) => s.skill === 'RICEZIONE');
      const ricPrf = ric.filter((s) => s.evalVal === '#').length;
      const ricPos = ric.filter((s) => s.evalVal === '+').length;
      const ricNeu = ric.filter((s) => s.evalVal === '!').length;
      const ricErr = ric.filter((s) => s.evalVal === '/').length;
      const ricAceSub = ric.filter((s) => s.evalVal === '-').length;

      const att = pStats.filter((s) => s.skill === 'ATTACCO');
      const attPti = att.filter((s) => s.evalVal === '#').length;
      const attDif = att.filter((s) => s.evalVal === '+').length;
      const attMur = att.filter((s) => s.evalVal === '/').length;
      const attErr = att.filter((s) => s.evalVal === '-').length;

      const mur = pStats.filter((s) => s.skill === 'MURO');
      const murPti = mur.filter((s) => s.evalVal === '#').length;
      const murToc = mur.filter((s) => s.evalVal === '/').length;
      const murOut = mur.filter((s) => s.evalVal === '-').length;

      const dif = pStats.filter((s) => s.skill === 'DIFESA');
      const difPos = dif.filter((s) => s.evalVal === '+').length;
      const difNeu = dif.filter((s) => s.evalVal === '/').length;
      const difErr = dif.filter((s) => s.evalVal === '-').length;

      const fb = pStats.filter((s) => s.skill === 'FREEBALL');
      const fbPos = fb.filter((s) => s.evalVal === '+').length;
      const fbNeu = fb.filter((s) => s.evalVal === '/').length;
      const fbErr = fb.filter((s) => s.evalVal === '-').length;

      const falli = pStats.filter((s) => s.skill === 'FALLO').length;

      const totPti = srvAce + attPti + murPti;
      const totErr = srvErr + ricAceSub + attErr + murOut + difErr + fbErr + falli;

      return {
        totPti,
        totErr,
        srv: { tot: srv.length, ace: srvAce, pos: srvPos, err: srvErr, pctPos: pct(srvAce + srvPos, srv.length) },
        ric: {
          tot: ric.length,
          prf: ricPrf,
          pos: ricPos,
          neu: ricNeu,
          err: ricErr,
          aceSub: ricAceSub,
          pctPos: pct(ricPrf + ricPos, ric.length),
          pctPrf: pct(ricPrf, ric.length)
        },
        att: { tot: att.length, pti: attPti, dif: attDif, mur: attMur, err: attErr, pctPti: pct(attPti, att.length) },
        mur: { tot: mur.length, pti: murPti, toc: murToc, out: murOut, pctPti: pct(murPti, mur.length) },
        dif: { tot: dif.length, pos: difPos, neu: difNeu, err: difErr, pctPos: pct(difPos, dif.length) },
        fb: { tot: fb.length, pos: fbPos, neu: fbNeu, err: fbErr, pctPos: pct(fbPos, fb.length) }
      };
    };

    const teamTotals = calcPlayerRow('TEAM');
    const availableSets = Array.from(
      new Set([
        ...Object.keys(gameState.matchPartials || {}).map(Number),
        gameState.currentSet
      ])
    ).sort((a, b) => a - b);

    return (
      <div className="min-h-screen bg-slate-900 text-white p-4 md:p-6 font-sans print:bg-white print:text-black print:p-2">
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @media print {
                @page { size: landscape; margin: 8mm; }
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .no-print { display: none !important; }
              }
            `
          }}
        />

        <div className="no-print flex flex-wrap justify-between items-center gap-3 mb-6 bg-slate-800 p-4 rounded-2xl border border-slate-700">
          <div className="flex flex-wrap gap-2">
            {isViewingArchive ? (
              <button
                onClick={() => {
                  setIsViewingArchive(false);
                  setView('MATCH_ARCHIVE');
                }}
                className="bg-slate-700 hover:bg-slate-600 px-4 py-2.5 rounded-xl font-bold"
              >
                🔙 Torna all'Archivio
              </button>
            ) : (
              <>
                {!isMatchFinished && !isCurrentSetFinished && (
                  <button
                    onClick={() => setView('GAME')}
                    className="bg-blue-600 hover:bg-blue-500 px-4 py-2.5 rounded-xl font-bold"
                  >
                    🔙 Torna al Campo
                  </button>
                )}
                {!isMatchFinished && isCurrentSetFinished && (
                  <button
                    onClick={handlePrepareNextSet}
                    className="bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 rounded-xl font-black shadow-lg animate-pulse"
                  >
                    ➡️ Prepara Set {gameState.currentSet + 1}
                  </button>
                )}
                {!isMatchFinished ? (
                  <button
                    onClick={saveInProgressMatch}
                    className="bg-amber-600 hover:bg-amber-500 px-4 py-2.5 rounded-xl font-bold"
                  >
                    💾 Salva gara e torna in home
                  </button>
                ) : (
                  <button
                    onClick={saveMatchToArchive}
                    className="bg-purple-600 hover:bg-purple-500 px-5 py-2.5 rounded-xl font-black shadow-lg"
                  >
                    🏆 Salva in Archivio e Torna in Home
                  </button>
                )}
              </>
            )}
          </div>

          <button
            onClick={() => window.print()}
            className="bg-slate-700 hover:bg-slate-600 px-5 py-2.5 rounded-xl font-black flex items-center gap-2 border border-slate-500"
          >
            🖨️ Esporta / Stampa PDF
          </button>
        </div>

        <div className="mb-4 border-b border-slate-700 print:border-gray-400 pb-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-blue-400 print:text-black">
              Report Scouting: {teamUsName} vs {teamOppName}
            </h2>
            <div className="text-sm font-bold text-gray-300 print:text-gray-700">
              Set Vinti: {gameState.setsWonUs} - {gameState.setsWonOpp} • Filtro:{' '}
              {statsFilter === 'ALL' ? 'Globale Partita' : `Set ${statsFilter}`} | Fase:{' '}
              {phaseFilter === 'ALL' ? 'Tutte (CP+BP)' : phaseFilter} | Rotazione:{' '}
              {rotationFilter === 'ALL' ? 'Tutte (P1-P6)' : rotationFilter}
            </div>
          </div>

          <div className="no-print flex flex-wrap gap-2">
            <select
              value={statsFilter}
              onChange={(e) => setStatsFilter(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm font-bold"
            >
              <option value="ALL">Globale Partita</option>
              {availableSets.map((sNum) => (
                <option key={`filter-set-${sNum}`} value={String(sNum)}>
                  Set {sNum}
                </option>
              ))}
            </select>

            <select
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm font-bold"
            >
              <option value="ALL">Tutte le Fasi</option>
              <option value="CP">Solo CP (Cambio Palla)</option>
              <option value="BP">Solo BP (Break Point)</option>
            </select>

            <select
              value={rotationFilter}
              onChange={(e) => setRotationFilter(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm font-bold"
            >
              <option value="ALL">Tutte le Rotazioni</option>
              {ROTATION_ORDER.map((r) => (
                <option key={`filter-rot-${r}`} value={r}>
                  Rotazione {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-800 print:bg-gray-100 p-4 rounded-xl border border-slate-700 print:border-gray-300">
            <h3 className="text-sm font-black uppercase text-blue-400 print:text-black mb-2">
              {statsFilter === 'ALL' ? 'Risultati Set Disputati' : `Parziali Set ${statsFilter}`}
            </h3>
            {statsFilter === 'ALL' ? (
              <div className="flex flex-col gap-1.5 text-sm">
                {availableSets.map((sNum) => {
                  const pData = gameState.matchPartials?.[sNum];
                  const sUs =
                    sNum === gameState.currentSet && !pData?.scoreUs
                      ? gameState.scoreUs
                      : pData?.scoreUs ?? '-';
                  const sOpp =
                    sNum === gameState.currentSet && !pData?.scoreOpp
                      ? gameState.scoreOpp
                      : pData?.scoreOpp ?? '-';
                  return (
                    <div
                      key={`set-summary-${sNum}`}
                      className="flex justify-between bg-slate-900/70 print:bg-white px-3 py-1.5 rounded font-bold"
                    >
                      <span>Set {sNum}:</span>
                      <span>
                        {sUs} - {sOpp}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-slate-900/70 print:bg-white p-2 rounded">
                  <span className="text-gray-400 print:text-gray-600 block text-xs">8 Punti:</span>
                  <span className="font-black">
                    {gameState.matchPartials?.[statsFilter]?.p8 || '-'}
                  </span>
                </div>
                <div className="bg-slate-900/70 print:bg-white p-2 rounded">
                  <span className="text-gray-400 print:text-gray-600 block text-xs">16 Punti:</span>
                  <span className="font-black">
                    {gameState.matchPartials?.[statsFilter]?.p16 || '-'}
                  </span>
                </div>
                <div className="bg-slate-900/70 print:bg-white p-2 rounded">
                  <span className="text-gray-400 print:text-gray-600 block text-xs">21 Punti:</span>
                  <span className="font-black">
                    {gameState.matchPartials?.[statsFilter]?.p21 || '-'}
                  </span>
                </div>
                <div className="bg-slate-900/70 print:bg-white p-2 rounded">
                  <span className="text-gray-400 print:text-gray-600 block text-xs">Punteggio:</span>
                  <span className="font-black">
                    {gameState.matchPartials?.[statsFilter]?.scoreUs ?? gameState.scoreUs} -{' '}
                    {gameState.matchPartials?.[statsFilter]?.scoreOpp ?? gameState.scoreOpp}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-800 print:bg-gray-100 p-4 rounded-xl border border-slate-700 print:border-gray-300">
            <h3 className="text-sm font-black uppercase text-emerald-400 print:text-black mb-2">
              Fasi CP & BP (Punti / Azioni)
            </h3>
            <div className="grid grid-cols-2 gap-2 mb-2.5 text-xs">
              <div className="bg-emerald-950/60 print:bg-white border border-emerald-600/40 p-2 rounded">
                <div className="font-black text-emerald-300 print:text-black">
                  Totale CP: {cpWon}/{cpRallies.length} ({pct(cpWon, cpRallies.length)})
                </div>
                <div className="text-gray-400 print:text-gray-600">
                  Freq. gioco: {pct(cpRallies.length, totalRalliesCount)}
                </div>
              </div>
              <div className="bg-orange-950/60 print:bg-white border border-orange-600/40 p-2 rounded">
                <div className="font-black text-orange-300 print:text-black">
                  Totale BP: {bpWon}/{bpRallies.length} ({pct(bpWon, bpRallies.length)})
                </div>
                <div className="text-gray-400 print:text-gray-600">
                  Freq. gioco: {pct(bpRallies.length, totalRalliesCount)}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-[11px]">
              {ROTATION_ORDER.map((rot) => {
                const rCp = cpRallies.filter((r) => r.rotation === rot);
                const rCpW = rCp.filter((r) => r.winner === 'US').length;
                const rBp = bpRallies.filter((r) => r.rotation === rot);
                const rBpW = rBp.filter((r) => r.winner === 'US').length;
                return (
                  <div
                    key={`rot-stat-${rot}`}
                    className="bg-slate-900/80 print:bg-white p-1.5 rounded border border-slate-700 print:border-gray-300"
                  >
                    <div className="font-black text-blue-300 print:text-black">{rot}</div>
                    <div>
                      CP: {rCpW}/{rCp.length} ({pct(rCpW, rCp.length)})
                    </div>
                    <div>
                      BP: {rBpW}/{rBp.length} ({pct(rBpW, rBp.length)})
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-800 print:bg-gray-100 p-4 rounded-xl border border-slate-700 print:border-gray-300 text-xs">
            <h3 className="text-sm font-black uppercase text-purple-400 print:text-black mb-2">
              Generali & Squadra Avversaria
            </h3>
            <div className="flex flex-col gap-1.5">
              <div className="bg-slate-900/70 print:bg-white p-2 rounded">
                <span className="font-black text-blue-300 print:text-black">Battuta Avversaria:</span>{' '}
                Tot {oppServeTot} (Ace: {oppAce} | Pos: {oppServePos} | Err: {errBattAvv})
              </div>
              <div className="bg-slate-900/70 print:bg-white p-2 rounded">
                <span className="font-black text-red-300 print:text-black">Attacco Avversario:</span>{' '}
                Tot {oppAttTot} (Pti: {oppAttPoint} | Dif: {oppAttDug} | Err: {errAttAvv})
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-center font-bold">
                <div className="bg-slate-900/70 print:bg-white p-1.5 rounded">
                  Err/Falli Avv: <span className="text-emerald-400 print:text-black">{errGenAvv}</span>
                </div>
                <div className="bg-slate-900/70 print:bg-white p-1.5 rounded">
                  Freeball Conc: <span className="text-amber-400 print:text-black">{freeConcesse}</span>
                </div>
                <div className="bg-slate-900/70 print:bg-white p-1.5 rounded">
                  Falli Nostri: <span className="text-red-400 print:text-black">{falliInd}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto bg-slate-800 print:bg-white rounded-xl border border-slate-700 print:border-gray-400 shadow-xl">
          <table className="w-full text-[11px] text-center border-collapse">
            <thead>
              <tr className="bg-slate-950 print:bg-gray-200 text-gray-200 print:text-black uppercase font-black border-b border-slate-700 print:border-gray-400">
                <th className="p-2 text-left sticky left-0 bg-slate-950 print:bg-gray-200 z-10">Atleta</th>
                <th className="p-1.5 bg-emerald-950/60 print:bg-gray-100">Pti</th>
                <th className="p-1.5 bg-red-950/60 print:bg-gray-100 border-r border-slate-700">Err</th>

                <th colSpan="5" className="p-1.5 border-r border-slate-700 text-blue-300 print:text-black">
                  Battuta
                </th>
                <th colSpan="8" className="p-1.5 border-r border-slate-700 text-green-300 print:text-black">
                  Ricezione
                </th>
                <th colSpan="6" className="p-1.5 border-r border-slate-700 text-red-300 print:text-black">
                  Attacco
                </th>
                <th colSpan="5" className="p-1.5 border-r border-slate-700 text-orange-300 print:text-black">
                  Muro
                </th>
                <th colSpan="5" className="p-1.5 border-r border-slate-700 text-amber-300 print:text-black">
                  Difesa
                </th>
                <th colSpan="5" className="p-1.5 text-teal-300 print:text-black">
                  Freeball Ric.
                </th>
              </tr>
              <tr className="bg-slate-900 print:bg-gray-100 text-gray-400 print:text-black font-bold border-b border-slate-700 print:border-gray-400">
                <th className="p-1.5 text-left sticky left-0 bg-slate-900 print:bg-gray-100 z-10">
                  N° Cognome Nome
                </th>
                <th className="p-1">Tot</th>
                <th className="p-1 border-r border-slate-700">Tot</th>

                <th className="p-1">Tot</th>
                <th className="p-1">Ace</th>
                <th className="p-1">Pos</th>
                <th className="p-1">Err</th>
                <th className="p-1 border-r border-slate-700">%Pos</th>

                <th className="p-1">Tot</th>
                <th className="p-1">#</th>
                <th className="p-1">+</th>
                <th className="p-1">!</th>
                <th className="p-1">/</th>
                <th className="p-1">-</th>
                <th className="p-1">%Pos</th>
                <th className="p-1 border-r border-slate-700">%Prf</th>

                <th className="p-1">Tot</th>
                <th className="p-1">#</th>
                <th className="p-1">+</th>
                <th className="p-1">/</th>
                <th className="p-1">-</th>
                <th className="p-1 border-r border-slate-700">%Pti</th>

                <th className="p-1">Tot</th>
                <th className="p-1">#</th>
                <th className="p-1">/</th>
                <th className="p-1">-</th>
                <th className="p-1 border-r border-slate-700">%Pti</th>

                <th className="p-1">Tot</th>
                <th className="p-1">+</th>
                <th className="p-1">/</th>
                <th className="p-1">-</th>
                <th className="p-1 border-r border-slate-700">%Pos</th>

                <th className="p-1">Tot</th>
                <th className="p-1">+</th>
                <th className="p-1">/</th>
                <th className="p-1">-</th>
                <th className="p-1">%Pos</th>
              </tr>
            </thead>
            <tbody>
              {sortedReportRoster.map((p) => {
                const r = calcPlayerRow(p.num);
                return (
                  <tr
                    key={`report-row-${p.num}`}
                    className="border-b border-slate-700/70 print:border-gray-300 hover:bg-slate-700/40"
                  >
                    <td className="p-2 text-left font-bold whitespace-nowrap sticky left-0 bg-slate-800 print:bg-white z-10">
                      #{p.num} {getFullName(p)} {p.isLibero && '(L)'}
                    </td>
                    <td className="p-1 font-black text-emerald-400 print:text-black">{r.totPti}</td>
                    <td className="p-1 font-black text-red-400 print:text-black border-r border-slate-700">
                      {r.totErr}
                    </td>

                    <td className="p-1">{r.srv.tot}</td>
                    <td className="p-1 font-bold">{r.srv.ace}</td>
                    <td className="p-1">{r.srv.pos}</td>
                    <td className="p-1 text-red-400 print:text-black">{r.srv.err}</td>
                    <td className="p-1 font-bold border-r border-slate-700">{r.srv.pctPos}</td>

                    <td className="p-1">{r.ric.tot}</td>
                    <td className="p-1 font-bold">{r.ric.prf}</td>
                    <td className="p-1">{r.ric.pos}</td>
                    <td className="p-1">{r.ric.neu}</td>
                    <td className="p-1">{r.ric.err}</td>
                    <td className="p-1 text-red-400 print:text-black">{r.ric.aceSub}</td>
                    <td className="p-1 font-bold">{r.ric.pctPos}</td>
                    <td className="p-1 font-bold border-r border-slate-700">{r.ric.pctPrf}</td>

                    <td className="p-1">{r.att.tot}</td>
                    <td className="p-1 font-bold">{r.att.pti}</td>
                    <td className="p-1">{r.att.dif}</td>
                    <td className="p-1">{r.att.mur}</td>
                    <td className="p-1 text-red-400 print:text-black">{r.att.err}</td>
                    <td className="p-1 font-bold border-r border-slate-700">{r.att.pctPti}</td>

                    <td className="p-1">{r.mur.tot}</td>
                    <td className="p-1 font-bold">{r.mur.pti}</td>
                    <td className="p-1">{r.mur.toc}</td>
                    <td className="p-1 text-red-400 print:text-black">{r.mur.out}</td>
                    <td className="p-1 font-bold border-r border-slate-700">{r.mur.pctPti}</td>

                    <td className="p-1">{r.dif.tot}</td>
                    <td className="p-1 font-bold">{r.dif.pos}</td>
                    <td className="p-1">{r.dif.neu}</td>
                    <td className="p-1 text-red-400 print:text-black">{r.dif.err}</td>
                    <td className="p-1 font-bold border-r border-slate-700">{r.dif.pctPos}</td>

                    <td className="p-1">{r.fb.tot}</td>
                    <td className="p-1 font-bold">{r.fb.pos}</td>
                    <td className="p-1">{r.fb.neu}</td>
                    <td className="p-1 text-red-400 print:text-black">{r.fb.err}</td>
                    <td className="p-1 font-bold">{r.fb.pctPos}</td>
                  </tr>
                );
              })}

              <tr className="bg-slate-950 print:bg-gray-200 font-black text-white print:text-black border-t-2 border-blue-500 print:border-black">
                <td className="p-2 text-left uppercase sticky left-0 bg-slate-950 print:bg-gray-200 z-10">
                  TOTALI SQUADRA
                </td>
                <td className="p-1 text-emerald-400 print:text-black">{teamTotals.totPti}</td>
                <td className="p-1 text-red-400 print:text-black border-r border-slate-700">
                  {teamTotals.totErr}
                </td>

                <td className="p-1">{teamTotals.srv.tot}</td>
                <td className="p-1">{teamTotals.srv.ace}</td>
                <td className="p-1">{teamTotals.srv.pos}</td>
                <td className="p-1">{teamTotals.srv.err}</td>
                <td className="p-1 border-r border-slate-700">{teamTotals.srv.pctPos}</td>

                <td className="p-1">{teamTotals.ric.tot}</td>
                <td className="p-1">{teamTotals.ric.prf}</td>
                <td className="p-1">{teamTotals.ric.pos}</td>
                <td className="p-1">{teamTotals.ric.neu}</td>
                <td className="p-1">{teamTotals.ric.err}</td>
                <td className="p-1">{teamTotals.ric.aceSub}</td>
                <td className="p-1">{teamTotals.ric.pctPos}</td>
                <td className="p-1 border-r border-slate-700">{teamTotals.ric.pctPrf}</td>

                <td className="p-1">{teamTotals.att.tot}</td>
                <td className="p-1">{teamTotals.att.pti}</td>
                <td className="p-1">{teamTotals.att.dif}</td>
                <td className="p-1">{teamTotals.att.mur}</td>
                <td className="p-1">{teamTotals.att.err}</td>
                <td className="p-1 border-r border-slate-700">{teamTotals.att.pctPti}</td>

                <td className="p-1">{teamTotals.mur.tot}</td>
                <td className="p-1">{teamTotals.mur.pti}</td>
                <td className="p-1">{teamTotals.mur.toc}</td>
                <td className="p-1">{teamTotals.mur.out}</td>
                <td className="p-1 border-r border-slate-700">{teamTotals.mur.pctPti}</td>

                <td className="p-1">{teamTotals.dif.tot}</td>
                <td className="p-1">{teamTotals.dif.pos}</td>
                <td className="p-1">{teamTotals.dif.neu}</td>
                <td className="p-1">{teamTotals.dif.err}</td>
                <td className="p-1 border-r border-slate-700">{teamTotals.dif.pctPos}</td>

                <td className="p-1">{teamTotals.fb.tot}</td>
                <td className="p-1">{teamTotals.fb.pos}</td>
                <td className="p-1">{teamTotals.fb.neu}</td>
                <td className="p-1">{teamTotals.fb.err}</td>
                <td className="p-1">{teamTotals.fb.pctPos}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderCurrentView = () => {
    switch (view) {
      case 'HOME':
        return renderHome();
      case 'TEAM_MANAGEMENT':
        return renderTeamManagement();
      case 'NEW_MATCH':
        return renderNewMatch();
      case 'MATCH_ARCHIVE':
        return renderMatchArchive();
      case 'SETUP_COURT':
        return renderSetupCourt();
      case 'GAME':
        return renderGame();
      case 'STATS':
        return renderStats();
      default:
        return renderHome();
    }
  };

  return (
    <>
      {renderCurrentView()}
      {appNotice && (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-800 border-2 border-amber-500 text-white p-6 rounded-2xl max-w-md w-full shadow-2xl text-center">
            <h3 className="text-xl font-black text-amber-400 mb-3">{appNotice.title}</h3>
            <p className="text-sm md:text-base text-gray-200 mb-6 leading-relaxed">{appNotice.message}</p>
            <button
              onClick={() => setAppNotice(null)}
              className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black py-3 rounded-xl shadow-lg transition-transform active:scale-95"
            >
              Ho capito
            </button>
          </div>
        </div>
      )}
    </>
  );
}
