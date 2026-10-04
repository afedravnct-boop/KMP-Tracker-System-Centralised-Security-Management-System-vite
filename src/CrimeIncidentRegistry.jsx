import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {  
  Shield, Users, PlusCircle, Edit, Search, X, AlertTriangle, CheckCircle, Lock, Camera, Filter, HardDrive, Save, Sprout, Loader2
} from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import LockupMatrixLedger from './LockupMatrixLedger';
import { stripHtmlTags } from './App';
import { authFetch, hasValidSession } from './api';

const REGIONAL_HIERARCHY = {
  "KMP NORTH": ["KMP NORTH HEADQUARTERS", "KMP NORTH", "KAWEMPE", "KAKIRI", "KASANGATI", "MATUGGA", "NANSANA", "OLD KAMPALA", "WAKISO", "WANDEGEYA"],
  "KMP EAST": ["KMP EAST HEADQUARTERS", "KMP EAST", "JINJA ROAD", "KIRA", "KIRA DIV", "KIRA ROAD", "MUKONO", "NAGGALAMA", "SEETA"],
  "KMP SOUTH": ["KMP SOUTH HEADQUARTERS", "KMP SOUTH", "NATEETE", "CPS KAMPALA", "PARLIAMENT", "ENTEBBE", "KABALAGALA", "KAJJANSI", "KASENYI", "KATWE", "KYENGERA", "NSANGI"],
  "KMP HEADQUARTERS": ["KMP HEADQUARTERS", "TRAFFIC", "LOGISTICS", "FLYING SQUAD", "CRIME INTELLIGENCE", "PRO"],
  "POLICE HEADQUARTERS": ["NAGURU"]
};

const isStationEquivalent = (statA, statB) => {
  const a = stripHtmlTags(statA || '').trim().toUpperCase();
  const b = stripHtmlTags(statB || '').trim().toUpperCase();
  if (!a || !b) return false;
  if (a === b) return true;

  const cleanA = a.replace(/(\s+HEADQUARTERS|\s+HQ)$/, '');
  const cleanB = b.replace(/(\s+HEADQUARTERS|\s+HQ)$/, '');

  return cleanA === cleanB && cleanA.length > 0;
};

const getOfficialRegionForStation = (stationName, dbRegion) => {
  const cleanStation = stripHtmlTags(stationName || '').trim().toUpperCase();
  const cleanDbRegion = stripHtmlTags(dbRegion || '').trim().toUpperCase();

  if (REGIONAL_HIERARCHY[cleanDbRegion] && REGIONAL_HIERARCHY[cleanDbRegion].some(s => isStationEquivalent(s, cleanStation))) {
    return cleanDbRegion;
  }

  for (const [regionName, stationsList] of Object.entries(REGIONAL_HIERARCHY)) {
    if (stationsList.some(s => isStationEquivalent(s, cleanStation))) {
      return regionName;
    }
  }

  return cleanDbRegion || 'KMP GENERAL';
};

const autoCapitalize = (text) => {
  if (!text) return '';
  return stripHtmlTags(text).replace(/(^\s*(?:<[^>]+>\s*)*|[\.\!\?]\s+(?:<[^>]+>\s*)*|<(?:p|br|div|li|h[1-6])[^>]*>\s*)([a-z])/gi, (match, prefix, letter) => {
    return prefix + letter.toUpperCase();
  });
};

const extractPlainText = (htmlString) => {
  if (!htmlString) return '';
  return stripHtmlTags(htmlString);
};

const MetricCard = ({ title, value, colorClass }) => {
  const isKMPMaster = title === 'KMP Master Lock-up' || title === 'KMP Master';
  return (
    <div className={`bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex flex-col items-center justify-center text-center hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${isKMPMaster ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 ring-1 ring-amber-300 dark:ring-amber-800 shadow-md scale-[1.02]' : ''}`}>
      <h4 className={`text-[8px] font-extrabold mb-0.5 uppercase tracking-wider leading-tight w-full break-words ${isKMPMaster ? 'text-amber-800 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
        {stripHtmlTags(title)}
      </h4>
      <div className={`text-sm font-black leading-none flex items-center justify-center ${colorClass}`}>
        {value === "Pending" ? (
          <span className="text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-900 animate-pulse">Pending</span>
        ) : (
          stripHtmlTags(String(value))
        )}
      </div>
    </div>
  );
};

const ExpandableTableCard = ({ title, children, onToggle }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      {expanded && <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9990] animate-in fade-in" />}
      <div className={expanded ? "fixed inset-4 sm:inset-10 z-[9999] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-300 dark:border-slate-700 flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden" : "bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col"}>
        <div className="bg-slate-900 dark:bg-slate-950 px-3.5 py-2.5 sm:px-5 sm:py-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
          <h3 className="font-extrabold text-white text-xs uppercase tracking-wider">{stripHtmlTags(title)}</h3>
          <button onClick={(e) => { e.stopPropagation(); const nextState = !expanded; setExpanded(nextState); if (onToggle) onToggle(nextState); }} className="text-[11px] text-blue-400 hover:text-white font-bold transition flex items-center bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-md border border-slate-700 shadow-inner cursor-pointer">
            {expanded ? 'Collapse View ↙' : 'Expand View ↗'}
          </button>
        </div>
        <div className={`w-full ${expanded ? 'flex-1 overflow-hidden [&>div]:max-h-full [&>div]:h-full' : ''}`}>
          {children}
        </div>
      </div>
    </>
  );
};

const CrimeIncidentRegistry = ({ currentUser, canViewGlobal = false, setReports, setSidebarOpen, isReadOnlyObserver }) => {
  const [serverReports, setServerReports] = useState([]);
  const [isFetchingReports, setIsFetchingReports] = useState(false);
  const [lockupData, setLockupData] = useState([]);

  const [standalonePopInput, setStandalonePopInput] = useState({ 
    total: '', male: '', male_juvenile: '', female: '', female_juvenile: '', d1: '', d2: '', d3: '' 
  });
  const [isEditingLockup, setIsEditingLockup] = useState(false);
  const [editLockupTarget, setEditLockupTarget] = useState(null);

  const [showAgriculturalOnly, setShowAgriculturalOnly] = useState(false);

  const userRoleClean = stripHtmlTags(currentUser?.role || '').toUpperCase();
  const userPosClean = stripHtmlTags(currentUser?.position || '').toUpperCase();
  const userRegClean = stripHtmlTags(currentUser?.region || '').toUpperCase();

  const isGlobalTier = ['SUPER_ADMIN', 'ADMIN', 'ASSISTANT_SUPER_ADMIN'].includes(userRoleClean) || 
    ['KMP COMMANDER', 'DEPUTY KMP COMMANDER', 'KMP ADMIN OFFICER'].includes(userPosClean) || 
    currentUser?.permissions?.view_global_roster === true;

  const isKmpSystemManager = userRoleClean === 'SYSTEM_MANAGER' && ['KMP HEADQUARTERS', 'POLICE HEADQUARTERS'].includes(userRegClean) && userPosClean.includes('KMP');
  const isKmpSpecialist = userRoleClean === 'ASSISTANT_SYSTEM_MANAGER' && ['KMP HEADQUARTERS', 'POLICE HEADQUARTERS'].includes(userRegClean) && userPosClean.includes('KMP');

  const canViewGlobalLevel = canViewGlobal || isGlobalTier || isKmpSystemManager || isKmpSpecialist;
  const canViewGlobalActive = canViewGlobalLevel;
  
  const isRegionalCommand = ['RPC', 'DEPUTY_RPC', 'SYSTEM_MANAGER', 'ASSISTANT_SYSTEM_MANAGER', 'REGIONAL_ADMIN', 'ASSISTANT_REGIONAL_ADMIN'].includes(userRoleClean) && !canViewGlobalLevel;

  const [filterRegion, setFilterRegion] = useState(canViewGlobalActive ? 'ALL REGIONS' : userRegClean);
  const [filterStation, setFilterStation] = useState((canViewGlobalActive || isRegionalCommand) ? 'ALL STATIONS' : stripHtmlTags(currentUser?.station || '').toUpperCase());

  const isFilterInitialized = useRef(false);
  useEffect(() => {
    if (!isFilterInitialized.current && currentUser?.station) {
      if (canViewGlobalActive) {
        setFilterRegion('ALL REGIONS');
        setFilterStation('ALL STATIONS');
      } else if (isRegionalCommand) {
        setFilterRegion(userRegClean);
        setFilterStation('ALL STATIONS');
      } else {
        setFilterRegion(userRegClean);
        setFilterStation(stripHtmlTags(currentUser?.station || '').toUpperCase());
      }
      isFilterInitialized.current = true;
    }
  }, [canViewGlobalActive, isRegionalCommand, userRegClean, currentUser?.station]);

  const [operation, setOperation] = useState('new');
  const [notification, setNotification] = useState(null);
  const [selectedCase, setSelectedCase] = useState(null);
   
  const [showHqGrandModal, setShowHqGrandModal] = useState(false);
  const [hqGrandTotalInput, setHqGrandTotalInput] = useState('');
  const [showLockupMatrixModal, setShowLockupMatrixModal] = useState(false);  

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const [dateFilter, setDateFilter] = useState('ALL TIME');
  const [updateSearch, setUpdateSearch] = useState('');
  const [summaryTimeFilter, setSummaryTimeFilter] = useState('ALL');

  const [showLockup, setShowLockup] = useState(false);
  const [newSuspect, setNewSuspect] = useState({ name: '', sex: 'MALE', age: '', tribe: '', nationality: '', residence: '', contact: '', mental_health_status: 'NORMAL', photo_url: '' });

  const getTodayString = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' }).split(',')[0].replace(/\//g, '-');

  const [formData, setFormData] = useState({
    sn: null, sd_ref: '', ref_type: 'SD Ref:', ref_number: '',
    region: userRegClean, station: stripHtmlTags(currentUser?.station || REGIONAL_HIERARCHY[currentUser?.region]?.[0] || ''),
    date: getTodayString(), time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }).replace(':', '') + 'Hrs',
    offence: '', customOffence: '', narrative: '', status: 'ACTIVE INVESTIGATION', suspectDetails: [], updateText: ''
  });

  useEffect(() => {
    const fetchLockupData = async () => {
      if (!hasValidSession()) return;
      try {
        const response = await authFetch('/api/v1/lockup-matrix');
        if (response.ok) {
          const data = await response.json();
          setLockupData(data);
        }
      } catch (err) {
        console.error("Failed to load lockup matrix:", err);
      }
    };
    fetchLockupData();
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchFilteredDatabaseReports = useCallback(async () => {
    if (!hasValidSession()) return;

    setIsFetchingReports(true);
    try {
      const params = new URLSearchParams();
      // 🟢 Always fetch full reports list when global or regional to ensure all stations can view entries logged for them
      if (!canViewGlobalActive && filterRegion && filterRegion !== 'ALL REGIONS') {
        params.append('region', filterRegion);
      }
      if (debouncedSearch) params.append('search', debouncedSearch);
      params.append('limit', '300');

      const response = await authFetch(`/api/v1/reports?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setServerReports(data);
        if (setReports) setReports(data);
      }
    } catch (err) {
      console.error("Failed to execute SQL fetch:", err);
    } finally {
      setIsFetchingReports(false);
    }
  }, [filterRegion, debouncedSearch, setReports, canViewGlobalActive]);

  useEffect(() => {
    fetchFilteredDatabaseReports();
  }, [fetchFilteredDatabaseReports]);

  const resetFormToBlank = () => {
    setFormData({
      sn: null, sd_ref: '', ref_type: 'SD Ref:', ref_number: '',
      region: userRegClean, station: stripHtmlTags(currentUser?.station || REGIONAL_HIERARCHY[currentUser?.region]?.[0] || ''),
      date: getTodayString(), time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }).replace(':', '') + 'Hrs',
      offence: '', customOffence: '', narrative: '', status: 'ACTIVE INVESTIGATION', suspectDetails: [], updateText: ''
    });
    setUpdateSearch('');
  };

  const handleOperationToggle = (mode) => {
    setOperation(mode);
    setNotification(null);
    if (mode === 'new') resetFormToBlank();
  };

  const populateUpdateCrimeForm = (caseData) => {
    setFormData({ 
      ...caseData, 
      sn: caseData.sn || caseData.id, 
      sd_ref: stripHtmlTags(caseData.sdRef || caseData.sd_ref), 
      offence: stripHtmlTags(caseData.offence || 'Other'),
      customOffence: '', 
      suspectDetails: caseData.suspectDetails || [], 
      updateText: '' 
    });
  };

  // 🟢 Enhanced Filtering Engine: Guarantees station-level users see cases logged for their station regardless of who logged it
  const finalFilteredReports = useMemo(() => {
    if (!Array.isArray(serverReports)) return [];
      
    return serverReports.filter(r => {
      if (r.is_hq_general_total || (r.offence || '').toUpperCase().includes("LOCK-UP TOTAL")) return false;

      const stn = stripHtmlTags(r.station || '').trim().toUpperCase();
      const reg = getOfficialRegionForStation(stn, r.region);

      if (canViewGlobalActive && filterRegion === 'ALL REGIONS' && filterStation === 'ALL STATIONS') {
        // Global viewing allowed
      } else {
        const belongsToRegion = filterRegion === 'ALL REGIONS' || 
                                reg === filterRegion || 
                                (REGIONAL_HIERARCHY[filterRegion] && REGIONAL_HIERARCHY[filterRegion].some(s => isStationEquivalent(s, stn)));

        if (!belongsToRegion) return false;

        if (filterStation !== 'ALL STATIONS') {
          if (!isStationEquivalent(stn, filterStation)) return false;
        }
      }

      if (showAgriculturalOnly) {
        const offenceText = stripHtmlTags(r.offence || '').toLowerCase();
        const narrativeText = extractPlainText(r.narrative || '').toLowerCase();
        const combinedText = `${offenceText} ${narrativeText}`;

        const excludedTerms = ['murder', 'homicide', 'killed', 'death', 'accident', 'tar', 'collision', 'hit and run', 'overturned', 'crash', 'boda boda', 'motorcycle', 'motor cycle', 'bajaj', 'tvs', 'boxer', 'scooter', 'traffic', 'aggravated robbery', 'defilement', 'rape'];
        if (excludedTerms.some(term => offenceText.includes(term) || combinedText.includes(term))) {
          return false;
        }

        const agriCrimeIndicators = ['theft of produce', 'produce theft', 'animal theft', 'cattle theft', 'stole a cow', 'stole cattle', 'stock theft', 'theft of livestock', 'granary', 'granaries', 'broke into food store', 'food stores', 'storehouse', 'barn', 'silo', 'silos', 'cutting down crops', 'cutting crops', 'slashing crops', 'burning crops', 'burning produce', 'destroying crops', 'crop destruction', 'arson of crops', 'arson of produce', 'theft of crops', 'theft of coffee', 'theft of vanilla', 'theft of cassava', 'theft of maize', 'coffee theft', 'vanilla theft', 'maize theft', 'matooke theft', 'theft of matooke', 'bribery to receive farm inputs', 'extortion of farmers', 'farm break-in', 'farm robbery', 'farm trespass', 'fire on crops', 'fire in the sugarcane', 'fire on farm house', 'crop theft', 'suspected stolen cows', 'suspected stolen cattle', 'suspected stolen goats', 'suspected stolen sheep', 'suspected stolen chicken', 'suspected stolen eggs', 'suspected stolen produce', 'suspected stolen coffee', 'suspected stolen vanilla', 'suspected stolen maize', 'suspected stolen matooke', 'suspected stolen cassava', 'suspected stolen livestock', 'suspected stolen funds for farmers'];

        const isAgriCrimeMatch = agriCrimeIndicators.some(indicator => combinedText.includes(indicator));
        if (!isAgriCrimeMatch) return false;
      }
        
      const diffDays = Math.ceil(Math.abs(new Date() - new Date(r.date)) / (1000 * 60 * 60 * 24));
      if (dateFilter === 'TODAY') {
        const todayStr = getTodayString();
        if (r.date !== todayStr) return false;
      } 
      else if (dateFilter === 'LAST 7 DAYS') { if (diffDays > 7) return false; } 
      else if (dateFilter === 'LAST 14 DAYS') { if (diffDays > 14) return false; } 
      else if (dateFilter === 'LAST 21 DAYS') { if (diffDays > 21) return false; } 
      else if (dateFilter === 'LAST 30 DAYS') { if (diffDays > 30) return false; } 
      else if (dateFilter === 'LAST 60 DAYS') { if (diffDays > 60) return false; } 
      else if (dateFilter === 'LAST 90 DAYS') { if (diffDays > 90) return false; } 
      else if (dateFilter === 'LAST 120 DAYS') { if (diffDays > 120) return false; } 
      else if (dateFilter === 'LAST 180 DAYS') { if (diffDays > 180) return false; }
        
      return true;
    }).sort((a, b) => (b.sn || b.id || 0) - (a.sn || a.id || 0));

  }, [serverReports, dateFilter, showAgriculturalOnly, filterRegion, filterStation, canViewGlobalActive]);

  const isStationSpecific = filterStation && filterStation !== 'ALL STATIONS';

  const availableUpdateCases = useMemo(() => {
    return finalFilteredReports.filter(r => {
      const stn = stripHtmlTags(r.station || '').trim().toUpperCase();
      const reg = getOfficialRegionForStation(stn, r.region);

      if (!canViewGlobalActive) {
        const belongsToRegion = reg === userRegClean || 
                                (REGIONAL_HIERARCHY[userRegClean] && REGIONAL_HIERARCHY[userRegClean].some(s => isStationEquivalent(s, stn)));
        if (!belongsToRegion) return false;
      }

      if (updateSearch) {
        const query = stripHtmlTags(updateSearch).toLowerCase();
        return stripHtmlTags(r.sdRef || r.sd_ref || '').toLowerCase().includes(query) || (r.id || r.sn || '').toString().includes(query) || extractPlainText(r.narrative).toLowerCase().includes(query);
      }
      return true;
    });
  }, [finalFilteredReports, updateSearch, canViewGlobalActive, userRegClean]);

  const metrics = useMemo(() => {
    const stationCellPop = {};
    const todayStr = getTodayString();
      
    let hqGrandTotalToday = null;
    let latestHqGrandTotal = null;
    let hasLockupUpdateToday = false;
      
    lockupData.forEach(l => {
      const lStation = stripHtmlTags(l.station || '').trim().toUpperCase();
      const lRegion = getOfficialRegionForStation(lStation, l.region);
      
      // 🟢 Check if this entry is an HQ Master entry or General Total log
      const isHQTotal = lStation === 'HEADQUARTERS GENERAL TOTAL' || 
                        lStation.includes('GENERAL TOTAL') || 
                        lRegion === 'KMP HEADQUARTERS';
      
      if (isHQTotal) {
        if (l.date === todayStr && Number(l.suspects) > 0) hqGrandTotalToday = Number(l.suspects);
        if (!latestHqGrandTotal && Number(l.suspects) > 0) latestHqGrandTotal = Number(l.suspects);
      } else {
        if (l.date === todayStr) {
          stationCellPop[lStation] = Number(l.suspects) || 0;
          if (isStationEquivalent(lStation, filterStation)) hasLockupUpdateToday = true;
        }
      }
    });
      
    const calculatedGlobalSum = Object.values(stationCellPop).reduce((sum, pop) => sum + pop, 0);
    
    // 🟢 Priority: 1. Today's HQ manual paper total, 2. Sum of all station cell populations, 3. Most recent HQ log
    const kmpGeneralTotal = hqGrandTotalToday !== null ? hqGrandTotalToday : 
                            calculatedGlobalSum > 0 ? calculatedGlobalSum : 
                            latestHqGrandTotal;

    let localJurisdictionTotal = 0;
    if (filterStation && filterStation !== 'ALL STATIONS') {
      localJurisdictionTotal = Object.keys(stationCellPop)
        .filter(stn => isStationEquivalent(stn, filterStation))
        .reduce((sum, stn) => sum + stationCellPop[stn], 0);
    } else if (filterRegion && filterRegion !== 'ALL REGIONS') {
      const regionStations = REGIONAL_HIERARCHY[filterRegion] || [];
      localJurisdictionTotal = regionStations.reduce((sum, stat) => sum + (stationCellPop[stat] || 0), 0);
    } else {
      localJurisdictionTotal = calculatedGlobalSum;
    }

    const totalCaseSuspects = finalFilteredReports.reduce((sum, r) => sum + (r.suspectDetails || r.suspect_details || []).length, 0);

    return {
      localLockup: (hasLockupUpdateToday || localJurisdictionTotal > 0) ? localJurisdictionTotal : "Pending",
      // 🟢 Universal Fallback: If no explicit master total is found, fallback to the computed sum so it never shows "Pending" for station users
      kmpGeneralLockup: kmpGeneralTotal !== null && kmpGeneralTotal !== undefined && kmpGeneralTotal !== 0 ? kmpGeneralTotal : (calculatedGlobalSum > 0 ? calculatedGlobalSum : "Pending"),
      newCases: finalFilteredReports.length,
      active: finalFilteredReports.filter(r => stripHtmlTags(r.status) === 'ACTIVE INVESTIGATION').length,
      sanctioned: finalFilteredReports.filter(r => stripHtmlTags(r.status) === 'FORWARDED TO COURT').length,
      closed: finalFilteredReports.filter(r => stripHtmlTags(r.status) === 'CLOSED / CONVICTED').length,
      adr: finalFilteredReports.filter(r => stripHtmlTags(r.status) === 'ADR').length,
      totalSuspects: totalCaseSuspects
    };
  }, [finalFilteredReports, lockupData, filterRegion, filterStation]);

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    const cleanValue = stripHtmlTags(value);
    if (name === 'region') {
      setFormData(prev => ({ ...prev, region: cleanValue, station: REGIONAL_HIERARCHY[cleanValue]?.[0] || '' }));
    } else if (['customOffence'].includes(name)) {
      setFormData(prev => ({ ...prev, [name]: cleanValue.toUpperCase() }));
    } else {
      setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseInt(cleanValue) || 0 : cleanValue }));
    }
  };

  const handleAddSuspect = () => {
    if (!newSuspect.name.trim()) return alert("Suspect name is required.");
    const sanitizedSuspect = {
      ...newSuspect,
      name: stripHtmlTags(newSuspect.name),
      tribe: stripHtmlTags(newSuspect.tribe),
      nationality: stripHtmlTags(newSuspect.nationality),
      residence: stripHtmlTags(newSuspect.residence),
      contact: stripHtmlTags(newSuspect.contact),
      id: Date.now()
    };
    setFormData({ ...formData, suspectDetails: [...formData.suspectDetails, sanitizedSuspect] });
    setNewSuspect({ name: '', sex: 'MALE', age: '', tribe: '', nationality: '', residence: '', contact: '', mental_health_status: 'NORMAL', photo_url: '' }); 
  };

  const handleRemoveSuspect = (id) => setFormData({ ...formData, suspectDetails: formData.suspectDetails.filter(s => s.id !== id) });

  const handleSuspectPhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setNotification("⏳ Uploading suspect mugshot...");
      const uploadData = new FormData();
      uploadData.append("file", file);
      uploadData.append("category", "suspect_mugshot");
      uploadData.append("case_id", stripHtmlTags(formData.sd_ref || "NEW_CASE"));

      try {
        const token = localStorage.getItem('kmp_authToken') || sessionStorage.getItem('kmp_authToken');
        const API_URL = import.meta.env?.VITE_API_URL || "https://kmp-tracker-system-centralised-security.onrender.com";
        const response = await fetch(`${API_URL}/api/v1/investigation/upload/`, { method: "POST", headers: { "Authorization": `Bearer ${token}` }, body: uploadData });
        const data = await response.json();
        if (data.full_s3_url || data.cloud_storage_path) {
          setNewSuspect({ ...newSuspect, photo_url: stripHtmlTags(data.full_s3_url || `https://kmp-tracker-system-tu-16-06-26.s3.eu-central-1.amazonaws.com/${data.cloud_storage_path}`) });
          setNotification("✅ Mugshot uploaded securely!");
        } else throw new Error("Invalid response");
      } catch (error) {
        setNewSuspect({ ...newSuspect, photo_url: URL.createObjectURL(file) });
        setNotification("⚠️ API unreachable. Using temporary local preview.");
      }
    }
  };

  const handleEditLockupToggle = () => {
    if (isEditingLockup) {
      setIsEditingLockup(false);
      setEditLockupTarget(null);
      setStandalonePopInput({ total: '', male: '', male_juvenile: '', female: '', female_juvenile: '', d1: '', d2: '', d3: '' });
    } else {
      const todayStr = getTodayString();
      const existingEntry = lockupData.find(l => stripHtmlTags(l.station) === formData.station && l.date === todayStr);
        
      if (existingEntry) {
        setEditLockupTarget(existingEntry);
        setStandalonePopInput({
          total: existingEntry.suspects.toString(),
          male: (existingEntry.male_count || 0).toString(),
          male_juvenile: (existingEntry.male_juvenile_count || 0).toString(),
          female: (existingEntry.female_count || 0).toString(),
          female_juvenile: (existingEntry.female_juvenile_count || 0).toString(),
          d1: (existingEntry.detention_1day || 0).toString(),
          d2: (existingEntry.detention_2days || 0).toString(),
          d3: (existingEntry.detention_3days_over || 0).toString()
        });
        setIsEditingLockup(true);
      } else {
        alert(`No cell population logged for ${formData.station} today yet. Please log a new entry.`);
      }
    }
  };

  const handleStandalonePopSubmit = async () => {
    const totalVal = parseInt(standalonePopInput.total) || 0;
    const maleVal = parseInt(standalonePopInput.male) || 0;
    const maleJuvVal = parseInt(standalonePopInput.male_juvenile) || 0;
    const femaleVal = parseInt(standalonePopInput.female) || 0;
    const femaleJuvVal = parseInt(standalonePopInput.female_juvenile) || 0;
    const d1Val = parseInt(standalonePopInput.d1) || 0;
    const d2Val = parseInt(standalonePopInput.d2) || 0;
    const d3Val = parseInt(standalonePopInput.d3) || 0;

    if (totalVal === 0 && maleVal === 0 && femaleVal === 0) {
      return setNotification("Error: Please enter valid cell population numbers.");
    }
        
    setNotification(isEditingLockup ? "⏳ Updating Daily Cell Population..." : "⏳ Logging Daily Cell Population to Independent Matrix...");
        
    try {
      const activeSubmissionRegion = canViewGlobalActive
        ? getOfficialRegionForStation(formData.station, filterRegion !== 'ALL REGIONS' ? filterRegion : formData.region)
        : getOfficialRegionForStation(formData.station, formData.region);

      if (isEditingLockup && editLockupTarget) {
        const targetId = editLockupTarget.sn || editLockupTarget.id;
        if (!targetId) throw new Error("Record ID lost. Please select the record again.");

        const updatePayload = {
          ...editLockupTarget,
          suspects: totalVal,
          male_count: maleVal,
          male_juvenile_count: maleJuvVal,
          female_count: femaleVal,
          female_juvenile_count: femaleJuvVal,
          detention_1day: d1Val,
          detention_2days: d2Val,
          detention_3days_over: d3Val,
          region: activeSubmissionRegion, 
          station: stripHtmlTags(formData.station), 
          last_updated_by: `${stripHtmlTags(currentUser.name)} (${stripHtmlTags(currentUser.fnum)})`
        };

        const response = await authFetch(`/api/v1/lockup-matrix/${targetId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatePayload)
        });  
            
        if (!response.ok) throw new Error("Database rejected the lockup update.");
            
        setLockupData(lockupData.map(l => (l.id || l.sn) === targetId ? updatePayload : l));
        setNotification(`✅ Daily Cell Population updated & reassigned successfully for ${stripHtmlTags(formData.station)}!`);
        setIsEditingLockup(false);
        setEditLockupTarget(null);

      } else {
        const cleanStationSub = stripHtmlTags(formData.station).substring(0,3).toUpperCase();
        const popRef = `POP-${cleanStationSub}-${Date.now().toString().slice(-6)}`;
            
        const apiPayload = {
          sd_ref: popRef, 
          region: activeSubmissionRegion, 
          station: stripHtmlTags(formData.station),
          date: getTodayString(), 
          time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }).replace(':', '') + 'Hrs',
          suspects: totalVal,
          male_count: maleVal,
          male_juvenile_count: maleJuvVal,
          female_count: femaleVal,
          female_juvenile_count: femaleJuvVal,
          detention_1day: d1Val,
          detention_2days: d2Val,
          detention_3days_over: d3Val,
          last_updated_by: `${stripHtmlTags(currentUser.name)} (${stripHtmlTags(currentUser.fnum)})`
        };

        const response = await authFetch(`/api/v1/lockup-matrix`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(apiPayload)
        });  
        if (!response.ok) throw new Error("Database rejected the lockup entry. Did you already log one today?");
            
        const newLockup = await response.json();
        setLockupData([newLockup, ...lockupData]);
        setNotification(`✅ Daily Cell Population successfully logged to the Independent Matrix for ${stripHtmlTags(formData.station)}!`);
      }
          
      setStandalonePopInput({ total: '', male: '', male_juvenile: '', female: '', female_juvenile: '', d1: '', d2: '', d3: '' }); 
      setTimeout(() => setNotification(null), 5000);
    } catch (err) {
      setNotification(`❌ Error: ${stripHtmlTags(err.message)}`);
    }
  };

  const handleHqGrandTotalSubmit = async (e) => {
    e.preventDefault();
    if (!hqGrandTotalInput && hqGrandTotalInput !== 0) return alert("Please enter a valid Grand Total.");
        
    setNotification("⏳ Submitting HQ General Grand Total to Independent Matrix...");
    const hqRef = `HQ-GRAND-${Date.now().toString().slice(-6)}`;

    const apiPayload = {
      sd_ref: hqRef, 
      region: "KMP HEADQUARTERS", 
      station: "HEADQUARTERS GENERAL TOTAL",
      date: getTodayString(),
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }).replace(':', '') + 'Hrs',
      suspects: parseInt(hqGrandTotalInput) || 0,
      male_count: 0,
      male_juvenile_count: 0,
      female_count: 0,
      female_juvenile_count: 0,
      detention_1day: 0,
      detention_2days: 0,
      detention_3days_over: 0,
      last_updated_by: `${stripHtmlTags(currentUser.name)} (${stripHtmlTags(currentUser.fnum)})`
    };

    try {
      const response = await authFetch(`/api/v1/lockup-matrix`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(apiPayload)
      });
      if (!response.ok) throw new Error("Database rejected HQ total.");

      const newLockup = await response.json();
      setLockupData([newLockup, ...lockupData]);
      setNotification(`✅ HQ General Total (${hqGrandTotalInput}) successfully posted!`);
      setShowHqGrandModal(false);
      setHqGrandTotalInput('');
      setTimeout(() => setNotification(null), 5000);
    } catch (err) {
      setNotification(`❌ Error: ${stripHtmlTags(err.message)}`);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
        
    let formattedTime = stripHtmlTags(formData.time || '');
    if (formattedTime && !/hrs$/i.test(formattedTime.trim())) formattedTime = `${formattedTime.trim()}Hrs`;

    const plainNarrative = formData.narrative;
    const plainTextForDuplicate = extractPlainText(formData.narrative);

    if (operation === 'new') {
      const cleanRefType = stripHtmlTags(formData.ref_type);
      const cleanRefNumber = stripHtmlTags(formData.ref_number).toUpperCase();
      const final_reference = `${cleanRefType} ${cleanRefNumber}`.trim();
        
      const isDuplicate = serverReports.some(r => stripHtmlTags(r.station) === stripHtmlTags(formData.station) && ((stripHtmlTags(r.sdRef || r.sd_ref || '')).trim().toLowerCase() === final_reference.toLowerCase() || extractPlainText(r.narrative || '').trim().toLowerCase() === plainTextForDuplicate.toLowerCase()));
      if (isDuplicate) return setNotification(`Error: This specific ${cleanRefType} entry or identical narrative already exists in the system for ${stripHtmlTags(formData.station)}.`);
    }

    setNotification(operation === 'new' ? "⏳ Logging new crime incident to secure database..." : "⏳ Submitting case update and audit trail...");

    const activeFinalRegion = canViewGlobalActive 
      ? getOfficialRegionForStation(formData.station, filterRegion !== 'ALL REGIONS' ? filterRegion : formData.region)
      : getOfficialRegionForStation(formData.station, formData.region);

    const apiPayload = {
      sd_ref: `${stripHtmlTags(formData.ref_type)} ${stripHtmlTags(formData.ref_number)}`.trim(),
      region: activeFinalRegion,
      station: stripHtmlTags(formData.station),
      date: stripHtmlTags(formData.date),
      time: formattedTime,
      offence: stripHtmlTags(formData.offence === 'OTHER' ? formData.customOffence : formData.offence),
      narrative: plainNarrative,
      status: stripHtmlTags(formData.status),
      suspect_details: formData.suspectDetails,
      update_text: operation === 'update' ? stripHtmlTags(formData.updateText) : undefined,
      entered_by: `${stripHtmlTags(currentUser.name)} (${stripHtmlTags(currentUser.fnum)})`
    };

    try {
      let response;
      if (operation === 'new') {
        response = await authFetch('/api/v1/reports', {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(apiPayload)
        });
      } else {
        const targetId = formData.sn || formData.id;
        if (!targetId) throw new Error("Case ID missing. Please re-select the case.");
        response = await authFetch(`/api/v1/reports/${targetId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(apiPayload)
        });
      }

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || "Server rejected the crime report transaction.");
      }

      const savedReport = await response.json();

      if (operation === 'new') {
        setServerReports([savedReport, ...serverReports]);
        if (setReports) setReports(prev => [savedReport, ...prev]);
        setNotification(`✅ Crime Incident successfully logged under ${stripHtmlTags(formData.station)}!`);
      } else {
        setServerReports(serverReports.map(r => ((r.sn || r.id) === (savedReport.sn || savedReport.id)) ? savedReport : r));
        if (setReports) setReports(prev => prev.map(r => ((r.sn || r.id) === (savedReport.sn || savedReport.id)) ? savedReport : r));
        setNotification(`✅ Case updated successfully with audit trail!`);
      }

      resetFormToBlank();
      setOperation('new');
      setTimeout(() => setNotification(null), 5000);
    } catch (err) {
      setNotification(`❌ Error: ${stripHtmlTags(err.message)}`);
    }
  };

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-300">
      {/* Top Notification Banner */}
      {notification && (
        <div className={`p-3 rounded-lg border text-xs font-bold flex items-center justify-between shadow-md ${notification.includes('❌') || notification.includes('Error') ? 'bg-red-50 dark:bg-red-950/80 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900' : 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'}`}>
          <div className="flex items-center space-x-2">
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-current hover:opacity-70 font-black cursor-pointer">✕</button>
        </div>
      )}

      {/* Header & Role Badge Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-xl p-4 sm:p-5 text-white shadow-lg border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="bg-blue-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-widest shadow">KMP Command Dashboard</span>
            <span className="bg-slate-800 text-slate-300 text-[9px] font-bold uppercase px-2 py-0.5 rounded border border-slate-700">{stripHtmlTags(currentUser?.region || 'KMP')} / {stripHtmlTags(currentUser?.station || 'HQ')}</span>
          </div>
          <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400 shrink-0" />
            Crime Incident Registry & Lock-up Control
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">Centralised command management, real-time SD references, suspect bio-metrics, and station lock-up tracking.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          {isKmpSystemManager && (
            <button onClick={() => setShowHqGrandModal(true)} className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold px-3 py-2 rounded-lg shadow transition flex items-center gap-1.5 cursor-pointer">
              <Lock className="w-3.5 h-3.5" /> Post HQ Grand Total
            </button>
          )}
          <button onClick={() => setShowLockupMatrixModal(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-2 rounded-lg shadow transition flex items-center gap-1.5 cursor-pointer">
            <HardDrive className="w-3.5 h-3.5" /> View Lock-up Matrix
          </button>
        </div>
      </div>

      {/* Metrics Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        <MetricCard title="Local Lock-up" value={metrics.localLockup} colorClass="text-blue-600 dark:text-blue-400" />
        <MetricCard title="KMP Master Lock-up" value={metrics.kmpGeneralLockup} colorClass="text-amber-600 dark:text-amber-400" />
        <MetricCard title="Total Cases" value={metrics.newCases} colorClass="text-slate-800 dark:text-slate-100" />
        <MetricCard title="Active Inv." value={metrics.active} colorClass="text-amber-600 dark:text-amber-400" />
        <MetricCard title="To Court" value={metrics.sanctioned} colorClass="text-indigo-600 dark:text-indigo-400" />
        <MetricCard title="Closed/Conv." value={metrics.closed} colorClass="text-emerald-600 dark:text-emerald-400" />
        <MetricCard title="ADR Cases" value={metrics.adr} colorClass="text-purple-600 dark:text-purple-400" />
        <MetricCard title="Suspects Reg." value={metrics.totalSuspects} colorClass="text-blue-600 dark:text-blue-400" />
      </div>

      {/* Filter and Search Controls Bar */}
      <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {canViewGlobalActive && (
            <select value={filterRegion} onChange={(e) => { setFilterRegion(e.target.value); setFilterStation('ALL STATIONS'); }} className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500">
              <option value="ALL REGIONS">ALL REGIONS</option>
              {Object.keys(REGIONAL_HIERARCHY).map(reg => <option key={reg} value={reg}>{reg}</option>)}
            </select>
          )}

          {(canViewGlobalActive || isRegionalCommand) && (
            <select value={filterStation} onChange={(e) => setFilterStation(e.target.value)} className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500">
              <option value="ALL STATIONS">ALL STATIONS</option>
              {filterRegion !== 'ALL REGIONS' && REGIONAL_HIERARCHY[filterRegion] ? (
                REGIONAL_HIERARCHY[filterRegion].map(stn => <option key={stn} value={stn}>{stn}</option>)
              ) : (
                Object.values(REGIONAL_HIERARCHY).flat().filter((v, i, a) => a.indexOf(v) === i).map(stn => <option key={stn} value={stn}>{stn}</option>)
              )}
            </select>
          )}

          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500">
            <option value="ALL TIME">ALL TIME</option>
            <option value="TODAY">TODAY</option>
            <option value="LAST 7 DAYS">LAST 7 DAYS</option>
            <option value="LAST 14 DAYS">LAST 14 DAYS</option>
            <option value="LAST 30 DAYS">LAST 30 DAYS</option>
            <option value="LAST 90 DAYS">LAST 90 DAYS</option>
          </select>

          <button onClick={() => setShowAgriculturalOnly(!showAgriculturalOnly)} className={`text-xs font-bold px-3 py-2 rounded-lg border transition flex items-center gap-1.5 ${showAgriculturalOnly ? 'bg-emerald-600 text-white border-emerald-700 shadow' : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'}`}>
            <Sprout className="w-3.5 h-3.5" /> {showAgriculturalOnly ? 'Agri-Crime Filter: ON' : 'Filter Agri-Crimes'}
          </button>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input type="text" placeholder="Search SD Ref, Offence, Suspect..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs pl-9 pr-3 py-2 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 font-medium" />
        </div>
      </div>

      {/* Main Grid: Data Entry Form vs Cases Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Side: Entry & Update Form (Hidden if Read-Only Observer) */}
        {!isReadOnlyObserver && (
          <div className="lg:col-span-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
            <div className="bg-slate-900 dark:bg-slate-950 px-4 py-3 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-extrabold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                {operation === 'new' ? <PlusCircle className="w-4 h-4 text-blue-400" /> : <Edit className="w-4 h-4 text-amber-400" />}
                {operation === 'new' ? 'Log New Crime Incident' : 'Update Case File & Audit Trail'}
              </h3>
              <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                <button type="button" onClick={() => handleOperationToggle('new')} className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition ${operation === 'new' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>New Entry</button>
                <button type="button" onClick={() => handleOperationToggle('update')} className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition ${operation === 'update' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Update Case</button>
              </div>
            </div>

            <form onSubmit={handleFormSubmit} className="p-4 space-y-3.5 flex-1 overflow-y-auto max-h-[75vh]">
              {operation === 'update' && (
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Select Case to Update</label>
                  <select value={formData.sn || formData.id || ''} onChange={(e) => {
                    const found = availableUpdateCases.find(c => String(c.sn || c.id) === e.target.value);
                    if (found) populateUpdateCrimeForm(found);
                  }} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500">
                    <option value="">-- Choose Case by SD Ref / Offence --</option>
                    {availableUpdateCases.map(c => (
                      <option key={c.sn || c.id} value={c.sn || c.id}>
                        {stripHtmlTags(c.sdRef || c.sd_ref)} - {stripHtmlTags(c.station)} ({stripHtmlTags(c.offence)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Station & Region Details */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Region</label>
                  <select name="region" value={formData.region} onChange={handleInputChange} disabled={!canViewGlobalActive && !isRegionalCommand} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60">
                    {Object.keys(REGIONAL_HIERARCHY).map(reg => <option key={reg} value={reg}>{reg}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Station</label>
                  <select name="station" value={formData.station} onChange={handleInputChange} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500">
                    {(REGIONAL_HIERARCHY[formData.region] || [formData.station]).map(stn => <option key={stn} value={stn}>{stn}</option>)}
                  </select>
                </div>
              </div>

              {/* SD Reference Number */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Ref Type</label>
                  <select name="ref_type" value={formData.ref_type} onChange={handleInputChange} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 px-2 py-2 outline-none">
                    <option value="SD Ref:">SD Ref:</option>
                    <option value="CRB Ref:">CRB Ref:</option>
                    <option value="GEF Ref:">GEF Ref:</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Reference Number</label>
                  <input type="text" name="ref_number" placeholder="e.g. 12/04/10/2026" value={formData.ref_number} onChange={handleInputChange} required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 px-3 py-2 uppercase outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Date</label>
                  <input type="date" name="date" value={formData.date} onChange={handleInputChange} required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 px-3 py-2 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Time (Hrs)</label>
                  <input type="text" name="time" placeholder="1430Hrs" value={formData.time} onChange={handleInputChange} required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 px-3 py-2 outline-none" />
                </div>
              </div>

              {/* Offence Selection */}
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Offence / Incident Category</label>
                <select name="offence" value={formData.offence} onChange={handleInputChange} required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 px-3 py-2 outline-none mb-2">
                  <option value="">-- Select Offence --</option>
                  <option value="THEFT">THEFT</option>
                  <option value="ASSAULT">ASSAULT</option>
                  <option value="BREAKING AND ENTERING">BREAKING AND ENTERING</option>
                  <option value="ROBBERY">ROBBERY</option>
                  <option value="DEFAMATION / THREATS">DEFAMATION / THREATS</option>
                  <option value="FRAUD / OBTAINING BY FALSE PRETENCE">FRAUD / OBTAINING BY FALSE PRETENCE</option>
                  <option value="MALICIOUS DAMAGE TO PROPERTY">MALICIOUS DAMAGE TO PROPERTY</option>
                  <option value="DOMESTIC VIOLENCE">DOMESTIC VIOLENCE</option>
                  <option value="MURDER / HOMICIDE">MURDER / HOMICIDE</option>
                  <option value="NARCOTICS">NARCOTICS</option>
                  <option value="TRAFFIC ACCIDENT / HIT AND RUN">TRAFFIC ACCIDENT / HIT AND RUN</option>
                  <option value="OTHER">OTHER (Specify below)</option>
                </select>
                {formData.offence === 'OTHER' && (
                  <input type="text" name="customOffence" placeholder="Enter custom offence title..." value={formData.customOffence} onChange={handleInputChange} required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold uppercase text-slate-800 dark:text-slate-200 px-3 py-2 outline-none" />
                )}
              </div>

              {/* Status */}
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Investigation Status</label>
                <select name="status" value={formData.status} onChange={handleInputChange} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 px-3 py-2 outline-none">
                  <option value="ACTIVE INVESTIGATION">ACTIVE INVESTIGATION</option>
                  <option value="FORWARDED TO COURT">FORWARDED TO COURT</option>
                  <option value="CLOSED / CONVICTED">CLOSED / CONVICTED</option>
                  <option value="ADR">ADR (Alternative Dispute Resolution)</option>
                </select>
              </div>

              {/* Narrative Rich Text Editor */}
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Detailed Case Narrative / Brief Facts</label>
                <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700">
                  <ReactQuill theme="snow" value={formData.narrative} onChange={(val) => setFormData({ ...formData, narrative: autoCapitalize(val) })} placeholder="Type detailed facts, complainant statements, and action taken..." className="text-xs" />
                </div>
              </div>

              {/* Update Text Field (Only in Update Mode) */}
              {operation === 'update' && (
                <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-900">
                  <label className="block text-[10px] font-extrabold text-amber-800 dark:text-amber-400 uppercase tracking-wider mb-1">New Investigation Progress Update / Audit Trail Note</label>
                  <textarea rows="3" placeholder="Enter progress notes to append to audit history..." value={formData.updateText} onChange={(e) => setFormData({ ...formData, updateText: e.target.value })} className="w-full bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-lg text-xs p-2.5 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
              )}

              {/* Suspect Bio-Metrics & Details Section */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Suspects Registered ({formData.suspectDetails.length})</span>
                </label>

                {formData.suspectDetails.length > 0 && (
                  <div className="space-y-1.5 mb-3 max-h-36 overflow-y-auto">
                    {formData.suspectDetails.map(sus => (
                      <div key={sus.id} className="bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs">
                        <div className="flex items-center space-x-2">
                          {sus.photo_url && <img src={sus.photo_url} alt="Mugshot" className="w-7 h-7 rounded-full object-cover border border-slate-300" />}
                          <div>
                            <p className="font-extrabold uppercase text-slate-900 dark:text-white">{sus.name} ({sus.sex}, {sus.age || 'N/A'})</p>
                            <p className="text-[10px] text-slate-500">{sus.tribe || 'Tribe N/A'} • {sus.residence || 'Residence N/A'}</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => handleRemoveSuspect(sus.id)} className="text-red-600 hover:text-red-700 font-bold px-2 py-1 text-xs">✕</button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <h4 className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400">Add Suspect Bio-data</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Full Name *" value={newSuspect.name} onChange={(e) => setNewSuspect({ ...newSuspect, name: e.target.value })} className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs uppercase" />
                    <select value={newSuspect.sex} onChange={(e) => setNewSuspect({ ...newSuspect, sex: e.target.value })} className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-bold">
                      <option value="MALE">MALE</option>
                      <option value="FEMALE">FEMALE</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="number" placeholder="Age" value={newSuspect.age} onChange={(e) => setNewSuspect({ ...newSuspect, age: e.target.value })} className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs" />
                    <input type="text" placeholder="Tribe" value={newSuspect.tribe} onChange={(e) => setNewSuspect({ ...newSuspect, tribe: e.target.value })} className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs uppercase" />
                    <input type="text" placeholder="Nationality" value={newSuspect.nationality} onChange={(e) => setNewSuspect({ ...newSuspect, nationality: e.target.value })} className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs uppercase" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Village / Residence" value={newSuspect.residence} onChange={(e) => setNewSuspect({ ...newSuspect, residence: e.target.value })} className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs uppercase" />
                    <select value={newSuspect.mental_health_status} onChange={(e) => setNewSuspect({ ...newSuspect, mental_health_status: e.target.value })} className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-bold">
                      <option value="NORMAL">MENTAL: NORMAL</option>
                      <option value="UNSTABLE">MENTAL: UNSTABLE</option>
                      <option value="PSYCHIATRIC EVALUATION">PSYCHIATRIC EVAL.</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <label className="cursor-pointer bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 px-3 py-1.5 rounded text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 border border-slate-300 dark:border-slate-700">
                      <Camera className="w-3.5 h-3.5" /> Upload Mugshot
                      <input type="file" accept="image/*" onChange={handleSuspectPhotoUpload} className="hidden" />
                    </label>
                    {newSuspect.photo_url && <span className="text-[10px] text-emerald-600 font-bold">✓ Photo Attached</span>}
                    <button type="button" onClick={handleAddSuspect} className="ml-auto bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-[11px] font-bold shadow">
                      + Add Suspect
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button type="submit" className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider text-white shadow-lg transition cursor-pointer ${operation === 'new' ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20' : 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20'}`}>
                {operation === 'new' ? 'Save & Broadcast Crime Incident' : 'Commit Case Update & Audit Trail'}
              </button>
            </form>
          </div>
        )}

        {/* Right Side: Cases Registry Table (Expands to full width if read-only) */}
        <div className={isReadOnlyObserver ? "lg:col-span-12" : "lg:col-span-7"}>
          <ExpandableTableCard title={`Crime Incident Registry & Records (${finalFilteredReports.length})`}>
            <div className="overflow-x-auto max-h-[75vh]">
              {isFetchingReports ? (
                <div className="p-12 text-center flex flex-col items-center justify-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <p className="text-xs font-bold text-slate-500">Loading secure crime records from database...</p>
                </div>
              ) : finalFilteredReports.length === 0 ? (
                <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-xs font-bold">
                  No crime reports found matching the selected station and filters.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0 z-10 text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3">Ref / Date</th>
                      <th className="p-3">Station / Region</th>
                      <th className="p-3">Offence & Narrative</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Suspects</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-xs font-medium">
                    {finalFilteredReports.map((report) => (
                      <tr key={report.sn || report.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-3 font-bold">
                          <div className="text-blue-600 dark:text-blue-400 uppercase">{stripHtmlTags(report.sdRef || report.sd_ref)}</div>
                          <div className="text-[10px] text-slate-400">{report.date} {report.time}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-extrabold uppercase text-slate-800 dark:text-slate-200">{stripHtmlTags(report.station)}</div>
                          <div className="text-[10px] text-slate-500 uppercase">{stripHtmlTags(report.region)}</div>
                        </td>
                        <td className="p-3 max-w-xs">
                          <div className="font-black text-slate-900 dark:text-white uppercase mb-0.5">{stripHtmlTags(report.offence)}</div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2" dangerouslySetInnerHTML={{ __html: report.narrative }} />
                        </td>
                        <td className="p-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                            stripHtmlTags(report.status) === 'ACTIVE INVESTIGATION' ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300' :
                            stripHtmlTags(report.status) === 'FORWARDED TO COURT' ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-300' :
                            'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300'
                          }`}>
                            {stripHtmlTags(report.status)}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-center">
                          {(report.suspectDetails || report.suspect_details || []).length > 0 ? (
                            <span className="bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 px-2 py-1 rounded border border-blue-200 dark:border-blue-900">
                              {(report.suspectDetails || report.suspect_details || []).length} Reg.
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">None</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <button onClick={() => setSelectedCase(report)} className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-2.5 py-1 rounded text-[10px] font-bold transition">
                            View File ↗
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </ExpandableTableCard>
        </div>
      </div>

      {/* Case Details Modal */}
      {selectedCase && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-300 dark:border-slate-700 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center border-b border-slate-800">
              <div>
                <span className="text-[10px] font-black bg-blue-600 px-2 py-0.5 rounded uppercase tracking-widest">{stripHtmlTags(selectedCase.station)}</span>
                <h2 className="text-base font-black uppercase mt-1 text-white">{stripHtmlTags(selectedCase.sdRef || selectedCase.sd_ref)} - {stripHtmlTags(selectedCase.offence)}</h2>
              </div>
              <button onClick={() => setSelectedCase(null)} className="text-slate-400 hover:text-white text-sm font-black bg-slate-800 p-2 rounded-lg">✕</button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                <div><span className="text-slate-400 block text-[9px] uppercase font-bold">Date & Time</span><span className="font-extrabold">{selectedCase.date} {selectedCase.time}</span></div>
                <div><span className="text-slate-400 block text-[9px] uppercase font-bold">Region</span><span className="font-extrabold uppercase">{selectedCase.region}</span></div>
                <div><span className="text-slate-400 block text-[9px] uppercase font-bold">Status</span><span className="font-extrabold text-blue-600 dark:text-blue-400 uppercase">{selectedCase.status}</span></div>
              </div>

              <div>
                <h4 className="text-xs font-black uppercase text-slate-500 mb-1">Case Narrative & Brief Facts</h4>
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: selectedCase.narrative }} />
              </div>

              {/* Suspects in Case Modal */}
              <div>
                <h4 className="text-xs font-black uppercase text-slate-500 mb-2">Registered Suspects ({(selectedCase.suspectDetails || selectedCase.suspect_details || []).length})</h4>
                <div className="space-y-2">
                  {(selectedCase.suspectDetails || selectedCase.suspect_details || []).map((s, idx) => (
                    <div key={idx} className="bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-3">
                        {s.photo_url ? (
                          <img src={s.photo_url} alt="Mugshot" className="w-10 h-10 rounded-full object-cover border border-slate-300" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-500">M</div>
                        )}
                        <div>
                          <p className="font-black uppercase text-slate-900 dark:text-white">{s.name}</p>
                          <p className="text-[10px] text-slate-500">{s.sex} • {s.age ? `${s.age} yrs` : 'Age N/A'} • {s.tribe || 'Tribe N/A'} • {s.residence || 'Residence N/A'}</p>
                        </div>
                      </div>
                      <span className="bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900 px-2 py-1 rounded text-[10px] font-bold">
                        Mental: {s.mental_health_status || 'NORMAL'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Audit Trail & History */}
              {selectedCase.audit_trail && selectedCase.audit_trail.length > 0 && (
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-500 mb-2">Audit Trail & Investigation Updates</h4>
                  <div className="space-y-2">
                    {selectedCase.audit_trail.map((audit, idx) => (
                      <div key={idx} className="bg-amber-50/50 dark:bg-amber-950/20 p-2.5 rounded-lg border border-amber-200 dark:border-amber-900/50 text-xs">
                        <p className="font-extrabold text-amber-800 dark:text-amber-400 mb-0.5">{audit.note}</p>
                        <p className="text-[9px] text-slate-400">{audit.timestamp} by {audit.updated_by}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="bg-slate-100 dark:bg-slate-950 px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button onClick={() => setSelectedCase(null)} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition">Close File</button>
            </div>
          </div>
        </div>
      )}

      {/* Lock-up Matrix Modal */}
      {showLockupMatrixModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-300 dark:border-slate-700 max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center border-b border-slate-800">
              <div>
                <span className="text-[10px] font-black bg-blue-600 px-2 py-0.5 rounded uppercase tracking-widest">Independent Matrix</span>
                <h2 className="text-base font-black uppercase mt-1 text-white">Station Lock-up Population & Detention Ledger</h2>
              </div>
              <button onClick={() => setShowLockupMatrixModal(false)} className="text-slate-400 hover:text-white text-sm font-black bg-slate-800 p-2 rounded-lg">✕</button>
            </div>
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              {/* Daily Cell Population Input Form */}
              <div className="bg-blue-50 dark:bg-blue-950/40 p-4 rounded-xl border border-blue-200 dark:border-blue-900 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-black uppercase text-blue-800 dark:text-blue-300">
                    {isEditingLockup ? `Editing Cell Population for ${formData.station}` : `Log Today's Cell Population for ${formData.station}`}
                  </h4>
                  <button type="button" onClick={handleEditLockupToggle} className="text-[10px] font-bold bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded shadow">
                    {isEditingLockup ? 'Cancel Edit' : 'Edit Today\'s Entry'}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[9px] font-extrabold uppercase text-slate-500 mb-1">Total Suspects *</label>
                    <input type="number" placeholder="0" value={standalonePopInput.total} onChange={(e) => setStandalonePopInput({ ...standalonePopInput, total: e.target.value })} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-bold" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-extrabold uppercase text-slate-500 mb-1">Adult Males</label>
                    <input type="number" placeholder="0" value={standalonePopInput.male} onChange={(e) => setStandalonePopInput({ ...standalonePopInput, male: e.target.value })} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-bold" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-extrabold uppercase text-slate-500 mb-1">Male Juveniles</label>
                    <input type="number" placeholder="0" value={standalonePopInput.male_juvenile} onChange={(e) => setStandalonePopInput({ ...standalonePopInput, male_juvenile: e.target.value })} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-bold" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-extrabold uppercase text-slate-500 mb-1">Adult Females</label>
                    <input type="number" placeholder="0" value={standalonePopInput.female} onChange={(e) => setStandalonePopInput({ ...standalonePopInput, female: e.target.value })} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-bold" />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div>
                    <label className="block text-[9px] font-extrabold uppercase text-slate-500 mb-1">Female Juveniles</label>
                    <input type="number" placeholder="0" value={standalonePopInput.female_juvenile} onChange={(e) => setStandalonePopInput({ ...standalonePopInput, female_juvenile: e.target.value })} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-bold" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-extrabold uppercase text-slate-500 mb-1">1 Day Detention</label>
                    <input type="number" placeholder="0" value={standalonePopInput.d1} onChange={(e) => setStandalonePopInput({ ...standalonePopInput, d1: e.target.value })} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-bold" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-extrabold uppercase text-slate-500 mb-1">2 Days Detention</label>
                    <input type="number" placeholder="0" value={standalonePopInput.d2} onChange={(e) => setStandalonePopInput({ ...standalonePopInput, d2: e.target.value })} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-bold" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-extrabold uppercase text-slate-500 mb-1">3+ Days (Over 48hrs)</label>
                    <input type="number" placeholder="0" value={standalonePopInput.d3} onChange={(e) => setStandalonePopInput({ ...standalonePopInput, d3: e.target.value })} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-bold text-red-600" />
                  </div>
                </div>

                <button type="button" onClick={handleStandalonePopSubmit} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-xs font-black uppercase tracking-wider shadow">
                  {isEditingLockup ? 'Commit Cell Population Update' : 'Submit Cell Population to Independent Matrix'}
                </button>
              </div>

              {/* Lockup Matrix Ledger Component */}
              <LockupMatrixLedger lockupData={lockupData} />
            </div>
            <div className="bg-slate-100 dark:bg-slate-950 px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button onClick={() => setShowLockupMatrixModal(false)} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition">Close Matrix</button>
            </div>
          </div>
        </div>
      )}

      {/* HQ Grand Total Modal */}
      {showHqGrandModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-300 dark:border-slate-700 max-w-md w-full overflow-hidden animate-in zoom-in-95">
            <div className="bg-amber-600 text-white px-5 py-4 flex justify-between items-center">
              <h2 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                <Lock className="w-4 h-4" /> Post HQ General Grand Total
              </h2>
              <button onClick={() => setShowHqGrandModal(false)} className="text-white/80 hover:text-white text-sm font-black">✕</button>
            </div>
            <form onSubmit={handleHqGrandTotalSubmit} className="p-5 space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Enter the official KMP General Grand Total reported from paper returns or headquarters roll call. This will immediately override the master lock-up display across the command.
              </p>
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">Grand Total Suspects *</label>
                <input type="number" placeholder="e.g. 340" value={hqGrandTotalInput} onChange={(e) => setHqGrandTotalInput(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-sm font-black text-amber-600 dark:text-amber-400 outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowHqGrandModal(false)} className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-black uppercase shadow">Post Grand Total</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrimeIncidentRegistry;