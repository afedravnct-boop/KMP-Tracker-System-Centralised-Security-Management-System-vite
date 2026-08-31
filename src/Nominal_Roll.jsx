import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Users, PlusCircle, Edit, AlertTriangle, CheckCircle, Upload, 
  BarChart3, PieChart, ArrowRight, Eye, Archive, RefreshCw, Search, X 
} from 'lucide-react';
import { authFetch } from './api';
import BulkNominalRollUpload from './BulkNominalRollUpload';
import OfficerDossierModal from './OfficerDossierModal';

const REGIONAL_HIERARCHY = {
  "KMP NORTH": ["KAWEMPE", "KAKIRI", "KASANGATI", "MATUGGA", "NANSANA", "OLD KAMPALA", "WAKISO", "WANDEGEYA"],
  "KMP EAST": ["JINJA ROAD", "KIRA", "KIRA ROAD", "MUKONO", "NAGGALAMA", "SEETA"],
  "KMP SOUTH": ["NATEETE", "CPS KAMPALA", "PARLIAMENT", "ENTEBBE", "KABALAGALA", "KAJJANSI", "KASENYI", "KATWE", "KYENGERA", "NSANGI"],
  "KMP HEADQUARTERS": ["KMP HEADQUARTERS", "FLYING SQUAD", "CRIME INTELLIGENCE"],
  "POLICE HEADQUARTERS": ["NAGURU"]
};

const getRankWeight = (rank) => {
  if (!rank) return 99;
  const r = rank.toUpperCase().trim();
   
  if (r === 'IGP') return 1;
  if (r === 'DIGP') return 2;
  if (r === 'AIGP') return 3;
  if (r === 'SCP') return 4;
  if (r === 'CP') return 5;
  if (r === 'ACP') return 6;
  if (r === 'SSP') return 7;
  if (r === 'SP') return 8;
  if (r === 'SASP') return 9;
  if (r === 'ASP') return 10;
  if (r === 'IP') return 11;
  if (r === 'AIP') return 12;
  if (r === 'HCM') return 13;
  if (r === 'HC') return 14;
  if (r === 'S/SGT' || r === 'SSGT') return 15;
  if (r === 'SGT') return 16;
  if (r === 'CPL') return 17;
  if (r === 'L/CPL' || r === 'LCPL') return 18;
  if (r === 'PC') return 19;
  if (r === 'PPC') return 20;
  if (r === 'SPC') return 21;
   
  return 50;
};

const parseEducationLevel = (educ) => {
  if (!educ) return 'UNKNOWN';
  const e = educ.toUpperCase().trim();
  
  if (e.includes('DEGREE') || e.includes('BACHELOR') || e.includes('MASTER') || e.includes('PHD')) return 'DEGREE / POSTGRAD';
  if (e.includes('DIPLOMA')) return 'DIPLOMA';
  if (e.includes('CERT')) return 'CERTIFICATE';
  if (e.includes('UACE') || e.includes('S.6') || e.includes('SENIOR 6')) return 'UACE (A-LEVEL)';
  if (e.includes('UCE') || e.includes('S.4') || e.includes('SENIOR 4')) return 'UCE (O-LEVEL)';
  
  if (e.includes('S.3') || e.includes('SENIOR 3')) return 'SENIOR 3 (S.3)';
  if (e.includes('S.2') || e.includes('SENIOR 2')) return 'SENIOR 2 (S.2)';
  if (e.includes('S.1') || e.includes('SENIOR 1')) return 'SENIOR 1 (S.1)';
  if (e.includes('P.7') || e.includes('PRIMARY 7')) return 'PRIMARY 7 (P.7)';
  if (e.includes('P.6') || e.includes('PRIMARY 6')) return 'PRIMARY 6 (P.6)';
  if (e.includes('P.5') || e.includes('PRIMARY 5')) return 'PRIMARY 5 (P.5)';
  if (e.includes('P.4') || e.includes('PRIMARY 4')) return 'PRIMARY 4 (P.4)';
  if (e.includes('P.3') || e.includes('PRIMARY 3')) return 'PRIMARY 3 (P.3)';
  if (e.includes('P.2') || e.includes('PRIMARY 2')) return 'PRIMARY 2 (P.2)';
  if (e.includes('P.1') || e.includes('PRIMARY 1')) return 'PRIMARY 1 (P.1)';
  if (e.includes('UNEDUCATED') || e.includes('NONE') || e.includes('NIL')) return 'UNEDUCATED';

  return 'OTHER / UNRECORDED';
};

const MetricCard = ({ title, value, colorClass }) => (
  <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col items-center justify-center text-center">
    <h4 className="text-[10px] font-extrabold text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-1">{title}</h4>
    <div className={`text-xl font-black ${colorClass}`}>{value}</div>
  </div>
);

const ExpandableTableCard = ({ title, children, onToggle }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <div className={isExpanded ? "fixed inset-4 z-[9999] bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6 overflow-hidden flex flex-col" : "bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col h-[650px]"}>
      <div className="bg-slate-50 dark:bg-slate-900 px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center shrink-0">
        <h3 className="text-gray-800 dark:text-slate-100 font-bold text-sm uppercase tracking-wider">{title}</h3>
        <button onClick={() => { const next = !isExpanded; setIsExpanded(next); if (onToggle) onToggle(next); }} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
          {isExpanded ? 'Collapse ↙' : 'Expand ↗'}
        </button>
      </div>
      <div className="p-0 overflow-auto flex-1 custom-scrollbar">{children}</div>
    </div>
  );
};

const Nominal_Roll = ({ currentUser, canViewGlobal: propCanViewGlobal, Nominal_Rolls, setNominal_Rolls, Nominal_Roll_archives, setNominal_Roll_archives, setSidebarOpen }) => {
  const [operation, setOperation] = useState('new');
  const [notification, setNotification] = useState(null);
  const [selectedOfficer, setSelectedOfficer] = useState(null);
  const [updateSearch, setUpdateSearch] = useState(''); 

  const isCommandOrHR = ['ADMIN', 'SUPER_ADMIN', 'RPC', 'Deputy Commander'].includes(currentUser?.role) ||                         
                        (currentUser?.position || '').toUpperCase().includes('HR') ||
                        currentUser?.permissions?.system_admin === true;

  const canEditRecords = isCommandOrHR || currentUser?.permissions?.upload_hr === true;
   
  const canViewGlobal = propCanViewGlobal !== undefined 
    ? propCanViewGlobal 
    : (currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN' || currentUser?.role === 'RPC' || currentUser?.role === 'Deputy Commander' || isCommandOrHR || currentUser?.permissions?.view_global_roster === true || currentUser?.permissions?.global_observer === true);

  const [filterRegion, setFilterRegion] = useState(canViewGlobal ? 'ALL REGIONS' : currentUser?.region || '');
  const [filterStation, setFilterStation] = useState(canViewGlobal ? 'ALL STATIONS' : ((isCommandOrHR) ? 'ALL STATIONS' : currentUser?.station || ''));

  const isFilterInitialized = useRef(false);
  useEffect(() => {
    if (!isFilterInitialized.current && currentUser?.station) {
      if (canViewGlobal) {
        setFilterRegion('ALL REGIONS');
        setFilterStation('ALL STATIONS');
      } else {
        setFilterRegion(currentUser.region || '');
        setFilterStation(currentUser.station || '');
      }
      isFilterInitialized.current = true;
    }
  }, [canViewGlobal, currentUser?.station, currentUser?.region]);

  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedOfficers, setSelectedOfficers] = useState([]);
  const [bulkArchiveReason, setBulkArchiveReason] = useState('TRANSFERRED');
  const [bulkArchiveDetail, setBulkArchiveDetail] = useState('');
  const [bulkCorrRef, setBulkCorrRef] = useState('');
  const [isBulkArchiving, setIsBulkArchiving] = useState(false);

  const [isArchivedReturnee, setIsArchivedReturnee] = useState(false);
  const [archiveDetails, setArchiveDetails] = useState(null);
  const [customReason, setCustomReason] = useState('');
  const [previousFnum, setPreviousFnum] = useState('');

  const [viewMode, setViewMode] = useState('active'); 
  const [showAnalytics, setShowAnalytics] = useState(false); 
   
  const [metricCategory, setMetricCategory] = useState('RANK');  
  const [archiveReason, setArchiveReason] = useState('TRANSFERRED');
  const [archiveDetail, setArchiveDetail] = useState('');
  const [corrRef, setCorrRef] = useState('');
  const [isImportExpanded, setIsImportExpanded] = useState(true);
  
  const [formData, setFormData] = useState({
    sn: null, fnum: '', rank: '', name: '', sex: 'MALE', position: '',
    dob: '', doe: '', dopost: '', dopro: '', contact: '', educlevel: '',
    ipps: '', tin: '', nin: '', homedist: '', tribe: '', accno: '', bankbranch: '',
    station: currentUser?.station || REGIONAL_HIERARCHY[currentUser?.region]?.[0] || '', 
    district: '', region: currentUser?.region || '', section: '', dir: '', status: 'ACTIVE'
  });

  const populateUpdateForm = (data) => setFormData({ ...data, fnum: data.fnum || data.f_num || '' });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'region') {
      setFormData({ ...formData, region: value, station: REGIONAL_HIERARCHY[value]?.[0] || '' });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleOperationToggle = (mode) => {
    setOperation(mode);
    if (mode === 'new') {
      setFormData({
        sn: null, fnum: '', rank: '', name: '', sex: 'MALE', position: '',
        dob: '', doe: '', dopost: '', dopro: '', contact: '', educlevel: '',
        ipps: '', tin: '', nin: '', homedist: '', tribe: '', accno: '', bankbranch: '',
        station: currentUser?.station || REGIONAL_HIERARCHY[currentUser?.region]?.[0] || '', 
        district: '', region: currentUser?.region || '', section: '', dir: '', status: 'ACTIVE'
      });
      setUpdateSearch('');
      setIsArchivedReturnee(false);
      setArchiveDetails(null);
      setCustomReason('');
      setPreviousFnum('');
    }
  };

  const handleArchivePersonnel = async () => {
    if (!canEditRecords) return alert("Security Restriction: You do not have clearance to archive personnel.");
     
    let rawFnum = formData.fnum || formData.f_num || '';
    const cleanTargetFnum = rawFnum.toString().split('/ARCHIVE')[0].trim();
     
    if (!cleanTargetFnum) {
      return alert("Missing Force Number. Cannot archive this record.");
    }
     
    let finalArchiveReason = archiveDetail.trim() ? `${archiveReason}: ${archiveDetail.trim()}` : archiveReason;
    if (corrRef.trim()) {
      finalArchiveReason += ` [Ref: ${corrRef.trim()}]`;
    }

    if (!window.confirm(`Are you sure you want to move ${formData.name} (${cleanTargetFnum}) to archives?`)) {
      return;
    }

    try {
      setNotification("Moving record to archive...");
       
      const response = await authFetch(`/api/v1/nominal-roll/${encodeURIComponent(cleanTargetFnum)}/archive`, {
        method: "PUT", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ archive_reason: finalArchiveReason })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Database failed to locate the record.");
      }

      const archivedRecord = {
          sn: formData.sn, f_num: cleanTargetFnum, rank: formData.rank, name: formData.name, sex: formData.sex, position: formData.position,
          dob: formData.dob, doe: formData.doe, do_post: formData.dopost, do_pro: formData.dopro, contact: formData.contact, educ_level: formData.educlevel,         
          ipps: formData.ipps, tin: formData.tin, nin: formData.nin, home_dist: formData.homedist, tribe: formData.tribe, acc_no: formData.accno,         
          bank_branch: formData.bankbranch, station: formData.station, district: formData.district, region: formData.region, section: formData.section,
          dir: formData.dir, status: "ARCHIVED", last_updated_by: `${currentUser.name} (${currentUser.fnum})`, archive_reason: finalArchiveReason,
          archive_date: new Date().toISOString().split('T')[0]
      };
       
      setNominal_Roll_archives([archivedRecord, ...(Array.isArray(Nominal_Roll_archives) ? Nominal_Roll_archives : [])]);
      setNominal_Rolls((Array.isArray(Nominal_Rolls) ? Nominal_Rolls : []).filter(n => (n.fnum || n.f_num) !== cleanTargetFnum));
      setNotification(`Officer ${formData.name} archived successfully.`);
      setArchiveDetail('');
      setCorrRef('');
      handleOperationToggle('new');
    } catch (error) { 
      setNotification("Error: Could not move to archive."); 
      alert(`Error archiving record: ${error.message}`); 
    }
  };

  const handleBulkArchive = async () => {
    if (!canEditRecords) return alert("Security Restriction: You do not have clearance to archive personnel.");
    if (selectedOfficers.length === 0) return;

    let finalBulkReason = bulkArchiveDetail.trim() ? `${bulkArchiveReason}: ${bulkArchiveDetail.trim()}` : bulkArchiveReason;
    if (bulkCorrRef.trim()) {
      finalBulkReason += ` [Ref: ${bulkCorrRef.trim()}]`;
    }

    if (!window.confirm(`Are you sure you want to archive ${selectedOfficers.length} officers with reason: ${finalBulkReason}?`)) return;

    setIsBulkArchiving(true);
    setNotification(`Archiving ${selectedOfficers.length} officers. Please wait...`);
     
    try {
      const response = await authFetch(`/api/v1/nominal-roll/bulk-archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fnums: selectedOfficers,
          archive_reason: finalBulkReason
        })
      });
       
      const resData = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(resData.detail || "Bulk archive request failed.");

      const archivedFnumsSet = new Set(selectedOfficers);
      const newlyArchivedRows = (Array.isArray(Nominal_Rolls) ? Nominal_Rolls : []).filter(n => archivedFnumsSet.has(n.f_num || n.fnum)).map(n => ({
        ...n,
        status: "ARCHIVED",
        archive_reason: finalBulkReason,
        archive_date: new Date().toISOString().split('T')[0],
        last_updated_by: `${currentUser.name} (${currentUser.fnum})`
      }));

      setNominal_Roll_archives(prev => [...newlyArchivedRows, ...(Array.isArray(prev) ? prev : [])]);
      setNominal_Rolls(prev => (Array.isArray(prev) ? prev : []).filter(n => !archivedFnumsSet.has(n.f_num || n.fnum)));

      setNotification(`✅ Bulk Archive Complete: ${resData.success_count} succeeded, ${resData.fail_count} failed.`);
      setSelectedOfficers([]);
      setBulkArchiveDetail('');
      setBulkCorrRef('');
      setBulkSelectMode(false);
    } catch (err) {
      setNotification(`❌ Bulk Archive Error: ${err.message}`);
    } finally {
      setIsBulkArchiving(false);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const handleFormSubmit = async (e) => { 
    e.preventDefault();
    if (!canEditRecords) return alert("Security Restriction: You do not have clearance to modify the Nominal Roll.");

    const currentRolls = Array.isArray(Nominal_Rolls) ? Nominal_Rolls : [];
     
    if (formData.nin) {
        const cleanNin = formData.nin.toUpperCase().trim();
        if (!/^C[MF][A-Z0-9]{12}$/.test(cleanNin)) return setNotification("⚠️ Error: National ID must start with CM or CF, be exactly 14 characters.");
        formData.nin = cleanNin; 
    }

    if (operation === 'new') {
      const exactNextSN = currentRolls.length > 0 ? Math.max(...currentRolls.map(n => n.sn || 0)) + 1 : 1;
       
      const newEntryPayload = { 
        ...formData, 
        sn: exactNextSN, 
        last_updated_by: `${currentUser.name} (${currentUser.fnum})`,
        ...(isArchivedReturnee && { reintegration_reason: customReason, previous_fnum: previousFnum || formData.fnum })
      };
       
      try {
        const response = await authFetch(`/api/v1/nominal-roll`, {
          method: "POST", 
          headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify(newEntryPayload)
        });
         
        const responseData = await response.json().catch(() => ({}));

        if (!response.ok) {
            if (response.status === 409 && responseData.is_archived_returnee) {
                setIsArchivedReturnee(true);
                setArchiveDetails(responseData);
                setNotification("⚠️ Officer history found in archive. Please authorize re-entry below.");
                return;
            }
            throw new Error(responseData.detail || "Database rejected the entry.");
        }
         
        setNominal_Rolls([newEntryPayload, ...currentRolls]); 
        setNotification(`Officer ${formData.name} recorded successfully!`); 
        handleOperationToggle('new');
      } catch (err) { setNotification(`Error: ${err.message}`); }
       
    } else if (operation === 'update') {
      const updatedRecord = { ...formData, last_updated_by: `${currentUser.name} (${currentUser.fnum})` };
      try {
          const targetIdentifier = String(formData.fnum || formData.f_num || formData.sn).trim();
          const response = await authFetch(`/api/v1/nominal-roll/${encodeURIComponent(targetIdentifier)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedRecord) 
          });
          if (!response.ok) throw new Error("Failed to update record.");
          setNominal_Rolls(currentRolls.map(n => (n.sn === formData.sn || n.fnum === formData.fnum || n.f_num === formData.fnum) ? updatedRecord : n));
          setNotification(`Officer ${formData.name} successfully updated!`);
      } catch (err) { setNotification("Error: Could not update the record."); }
    }
  };

  const filteredRolls = useMemo(() => {
    return (Array.isArray(Nominal_Rolls) ? Nominal_Rolls : []).filter(n => {
      const statusStr = (n.status || '').trim().toUpperCase();
      if (statusStr === 'ARCHIVED' || n.is_archived === true) return false;

      const dbRegion = (n.region || '').trim().toUpperCase();
      const dbStation = (n.station || '').trim().toUpperCase();
      const selRegion = (filterRegion || '').trim().toUpperCase();
      const selStation = (filterStation || '').trim().toUpperCase();

      if (canViewGlobal && selRegion === 'ALL REGIONS') {
        // Global viewing active
      } else if (selRegion !== 'ALL REGIONS' && selRegion !== '' && dbRegion !== selRegion) {
        return false;
      }

      if (canViewGlobal && selRegion === 'ALL REGIONS' && selStation === 'ALL STATIONS') {
        return true;
      }

      if (selStation !== 'ALL STATIONS' && selStation !== '' && dbStation !== selStation) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      const weightA = getRankWeight(a.rank);
      const weightB = getRankWeight(b.rank);
      if (weightA !== weightB) {
        return weightA - weightB;
      }
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [Nominal_Rolls, filterRegion, filterStation, canViewGlobal]);

  const filteredNominal_Roll_archives = useMemo(() => {
    if (!Array.isArray(Nominal_Roll_archives)) return [];

    return Nominal_Roll_archives.filter(n => {
      const dbRegion = (n.region || '').trim().toUpperCase();
      const dbStation = (n.station || '').trim().toUpperCase();
      const selRegion = (filterRegion || '').trim().toUpperCase();
      const selStation = (filterStation || '').trim().toUpperCase();

      if (canViewGlobal && selRegion === 'ALL REGIONS') {
        // Global viewing active
      } else if (selRegion !== 'ALL REGIONS' && selRegion !== '' && dbRegion !== selRegion) {
        return false;
      }

      if (canViewGlobal && selRegion === 'ALL REGIONS' && selStation === 'ALL STATIONS') {
        return true;
      }

      if (selStation !== 'ALL STATIONS' && selStation !== '' && dbStation !== selStation) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      const weightA = getRankWeight(a.rank);
      const weightB = getRankWeight(b.rank);
      if (weightA !== weightB) {
        return weightA - weightB;
      }
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [Nominal_Roll_archives, filterRegion, filterStation, canViewGlobal]);

  const currentRollDataset = useMemo(() => {
    return viewMode === 'archive' ? filteredNominal_Roll_archives : filteredRolls;
  }, [viewMode, filteredRolls, filteredNominal_Roll_archives]);

  const availableUpdateRolls = useMemo(() => {
    return (Array.isArray(Nominal_Rolls) ? Nominal_Rolls : []).filter(n => {
      const fNumVal = n.fnum || n.f_num || '';
      if (!['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role) && !canViewGlobal && n.region !== currentUser.region) return false;
      if (updateSearch) {
        const query = updateSearch.toLowerCase();
        return (fNumVal && fNumVal.toLowerCase().includes(query)) || 
               (n.name && n.name.toLowerCase().includes(query)) || 
               (n.ipps && String(n.ipps).includes(query));
      }
      return true;
    });
  }, [Nominal_Rolls, currentUser, updateSearch, canViewGlobal]);

  const calculatedMetrics = useMemo(() => {
      if (!showAnalytics) return [];
      const grouped = {};
       
      currentRollDataset.forEach(n => {
          let key = 'Unknown';
          const sexStr = (n.sex || '').trim().toUpperCase();
          const ninStr = (n.nin || '').trim().toUpperCase();
          const isFemale = sexStr === 'F' || sexStr === 'FEMALE' || ninStr.startsWith('CF');
          const isMale = sexStr === 'M' || sexStr === 'MALE' || ninStr.startsWith('CM');
           
          const homeDistrict = n.homedist || n.home_dist || '';
          const bankBranch = n.bankbranch || n.bank_branch || '';
          const educLevel = n.educlevel || n.educ_level || '';
           
          if (metricCategory === 'RANK') key = n.rank ? n.rank.trim().toUpperCase() : 'UNRANKED';
          else if (metricCategory === 'UNIT') key = `${n.station || 'UNKNOWN'} ${n.section ? '- ' + n.section : ''}`.trim();
          else if (metricCategory === 'SEX') key = isFemale ? 'FEMALE' : (isMale ? 'MALE' : 'UNSPECIFIED');
          else if (metricCategory === 'BANK') key = bankBranch ? bankBranch.trim().toUpperCase() : 'BANK UNKNOWN';
          else if (metricCategory === 'DISTRICT') key = homeDistrict ? homeDistrict.trim().toUpperCase() : 'DISTRICT UNKNOWN';
          else if (metricCategory === 'TRIBE') key = n.tribe ? n.tribe.trim().toUpperCase() : 'TRIBE UNKNOWN';
          else if (metricCategory === 'EDUCATION') key = parseEducationLevel(educLevel);

          else if (metricCategory === 'AGE') {
              if (n.dob) {
                  const birthYear = new Date(n.dob).getFullYear();
                  if (!isNaN(birthYear)) {
                      const age = new Date().getFullYear() - birthYear;
                      key = age < 30 ? '18-29 Years' : age < 40 ? '30-39 Years' : age < 50 ? '40-49 Years' : '50+ Years';
                  } else {
                      key = 'Age Not Recorded';
                  }
              } else { 
                  key = 'Age Not Recorded'; 
              }
          }
           
          if (!grouped[key]) grouped[key] = { category: key, total: 0, male: 0, female: 0, unknown: 0 };
          grouped[key].total += 1;
          if (isFemale) grouped[key].female += 1;
          else if (isMale) grouped[key].male += 1;
          else grouped[key].unknown += 1;
      });

      const resultsArray = Object.values(grouped);

      if (metricCategory === 'RANK') {
          return resultsArray.sort((a, b) => getRankWeight(a.category) - getRankWeight(b.category));
      } else {
          return resultsArray.sort((a, b) => b.total - a.total);
      }
  }, [currentRollDataset, metricCategory, showAnalytics]);

  const metricsData = useMemo(() => {
    let maleCount = 0;
    let femaleCount = 0;
    const uniqueStations = {};

    currentRollDataset.forEach(n => {
      const sexStr = (n.sex || '').trim().toUpperCase();
      const ninStr = (n.nin || '').trim().toUpperCase();
       
      if (sexStr === 'F' || sexStr === 'FEMALE' || ninStr.startsWith('CF')) {
        femaleCount++;
      } else if (sexStr === 'M' || sexStr === 'MALE' || ninStr.startsWith('CM')) {
        maleCount++;
      }

      if (n.station) {
        uniqueStations[n.station] = true;
      }
    });

    return {
      total: currentRollDataset.length,
      male: maleCount,
      female: femaleCount,
      unassigned: currentRollDataset.length - (maleCount + femaleCount),
      stations: Object.keys(uniqueStations).length
    };
  }, [currentRollDataset]);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 relative z-10">
      <div className="text-center mb-8 flex flex-col items-center">
        <img src="/upf_badge.png" alt="UPF Logo" className="w-16 h-16 mb-3 object-contain contrast-200 brightness-75 drop-shadow-sm" onError={(e) => { e.target.style.display = 'none'; }} />
        <h1 className="text-3xl font-extrabold text-gray-700 dark:text-slate-100 tracking-tight">Master Nominal Roll</h1>
        <h3 className="text-lg text-indigo-500 dark:text-indigo-400 mt-2 font-medium">Man-Power Auditing & Deployment Registry</h3>
      </div>
        
      {notification && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-xs rounded-lg font-bold flex justify-between items-center shadow-sm">
          <span>{notification}</span>
          <button onClick={() => setNotification(null)} className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 font-bold">✕</button>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-4 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-4 border-b border-gray-200 dark:border-slate-700 pb-2">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400"/> 
            Personnel Metrics Dashboard ({viewMode === 'archive' ? 'Archived Records' : 'Active Roll'})
          </h3>
          <div className="flex space-x-2 mt-2 md:mt-0">
             <button onClick={() => { setViewMode('active'); setShowAnalytics(false); setBulkSelectMode(false); }} className={`px-4 py-1.5 text-xs font-bold rounded shadow-sm transition-colors cursor-pointer ${viewMode === 'active' && !showAnalytics ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'}`}>Active Roll</button>
             <button onClick={() => { setViewMode('archive'); setShowAnalytics(false); setBulkSelectMode(false); }} className={`px-4 py-1.5 text-xs font-bold rounded shadow-sm transition-colors cursor-pointer ${viewMode === 'archive' && !showAnalytics ? 'bg-red-700 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'}`}>Archived</button>
             <button onClick={() => setShowAnalytics(!showAnalytics)} className={`px-4 py-1.5 text-xs font-bold rounded shadow-sm transition-colors cursor-pointer ${showAnalytics ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'}`}>
                {showAnalytics ? 'Close Analytics' : 'Analytics'}
             </button>
          </div>
        </div>

        {!showAnalytics && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
             <MetricCard title={viewMode === 'archive' ? "Total Archived" : "Total Personnel"} value={metricsData.total} colorClass={viewMode === 'archive' ? "text-red-700 dark:text-red-400" : "text-blue-700 dark:text-blue-400"} />
             <MetricCard title="Male Officers" value={metricsData.male} colorClass="text-indigo-600 dark:text-indigo-400" />
             <MetricCard title="Female Officers" value={metricsData.female} colorClass="text-pink-600 dark:text-pink-400" />
             <MetricCard title="Unassigned Sex" value={metricsData.unassigned} colorClass="text-slate-400 dark:text-slate-400" />
             <MetricCard title="Stations" value={metricsData.stations} colorClass="text-emerald-600 dark:text-emerald-400" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form & Batch Operations */}
        <div className="lg:col-span-5 space-y-5">
          {canEditRecords && (
            <>
              {/* Batch Upload Section */}
              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-2 overflow-hidden">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-gray-800 dark:text-slate-100 text-sm flex items-center">
                    <Upload className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400 shrink-0" /> Batch Excel / Multi-File Import
                  </h4>
                  <button onClick={() => setIsImportExpanded(!isImportExpanded)} className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline">
                    {isImportExpanded ? 'Hide ▲' : 'Show ▼'}
                  </button>
                </div>
                 
                {isImportExpanded && (
                  <>
                    <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-mono text-slate-700 dark:text-slate-300 flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                      {['sn', 'f_num', 'rank', 'name', 'sex', 'position', 'dob', 'doe', 'do_post', 'do_pro', 'contact', 'educ_level', 'ipps', 'tin', 'nin', 'home_dist', 'tribe', 'acc_no', 'bank_branch', 'station', 'district', 'region', 'section', 'dir'].map(col => (
                        <span key={col} className="bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 shadow-sm font-bold">{col}</span>
                      ))}
                    </div>
                    <BulkNominalRollUpload setNominal_Rolls={setNominal_Rolls} currentUser={currentUser} />
                  </>
                )}
              </div>

              {/* Form Input Container */}
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                <div className="flex border-b border-gray-200 dark:border-slate-700">
                  <button onClick={() => handleOperationToggle('new')} className={`flex-1 py-2.5 text-xs font-bold transition-colors ${operation === 'new' ? 'bg-blue-600 text-white' : 'bg-gray-50 dark:bg-slate-900 text-gray-600 dark:text-slate-400 hover:bg-gray-100'}`}>+ New Entry</button>
                  <button onClick={() => handleOperationToggle('update')} className={`flex-1 py-2.5 text-xs font-bold transition-colors ${operation === 'update' ? 'bg-blue-600 text-white' : 'bg-gray-50 dark:bg-slate-900 text-gray-600 dark:text-slate-400 hover:bg-gray-100'}`}>✎ Update Record</button>
                </div>

                <div className="p-4">
                  {operation === 'update' && (
                    <div className="mb-4 space-y-2">
                      <label className="text-xs font-bold text-gray-600 dark:text-slate-400 uppercase">Search Officer to Update</label>
                      <input type="text" placeholder="Search by Force No, Name, or IPPS..." value={updateSearch} onChange={(e) => setUpdateSearch(e.target.value)} className="w-full text-xs p-2 rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
                      {updateSearch && (
                        <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-slate-700 rounded-lg divide-y divide-gray-100 dark:divide-slate-700">
                          {availableUpdateRolls.map(rec => (
                            <div key={rec.sn || rec.fnum || rec.f_num} onClick={() => populateUpdateForm(rec)} className="p-2 text-xs hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer flex justify-between items-center">
                              <span className="font-bold">{rec.rank} {rec.name}</span>
                              <span className="text-[10px] text-gray-400">{rec.fnum || rec.f_num}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <form onSubmit={handleFormSubmit} className="space-y-3">
                    {/* Section 1: Identifiers */}
                    <div className="space-y-2">
                      <h4 className="text-[11px] font-extrabold text-blue-600 uppercase tracking-wider">1. Basic Identifiers</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" name="fnum" placeholder="Force Number *" value={formData.fnum} onChange={handleInputChange} required className="text-xs p-2 rounded border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
                        <input type="text" name="rank" placeholder="Rank (e.g. PC, ASP)" value={formData.rank} onChange={handleInputChange} required className="text-xs p-2 rounded border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
                      </div>
                      <input type="text" name="name" placeholder="Full Official Name *" value={formData.name} onChange={handleInputChange} required className="w-full text-xs p-2 rounded border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
                      <div className="grid grid-cols-2 gap-2">
                        <select name="sex" value={formData.sex} onChange={handleInputChange} className="text-xs p-2 rounded border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
                          <option value="MALE">MALE</option>
                          <option value="FEMALE">FEMALE</option>
                        </select>
                        <input type="text" name="contact" placeholder="Phone Contact" value={formData.contact} onChange={handleInputChange} className="text-xs p-2 rounded border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
                      </div>
                    </div>

                    {/* Section 2: Service & Placement */}
                    <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-slate-700">
                      <h4 className="text-[11px] font-extrabold text-blue-600 uppercase tracking-wider">2. Service & Placement</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <select name="region" value={formData.region} onChange={handleInputChange} className="text-xs p-2 rounded border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
                          {Object.keys(REGIONAL_HIERARCHY).map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <select name="station" value={formData.station} onChange={handleInputChange} className="text-xs p-2 rounded border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
                          {(REGIONAL_HIERARCHY[formData.region] || []).map(st => <option key={st} value={st}>{st}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" name="position" placeholder="Position / Duty" value={formData.position} onChange={handleInputChange} className="text-xs p-2 rounded border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
                        <input type="text" name="section" placeholder="Section / Branch" value={formData.section} onChange={handleInputChange} className="text-xs p-2 rounded border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
                      </div>
                    </div>

                    {/* Section 3: Demographics & Legal */}
                    <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-slate-700">
                      <h4 className="text-[11px] font-extrabold text-blue-600 uppercase tracking-wider">3. Personal & Legal Details</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" name="nin" placeholder="NIN (CM.../CF...)" value={formData.nin} onChange={handleInputChange} className="text-xs p-2 rounded border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
                        <input type="text" name="educlevel" placeholder="Education Level" value={formData.educlevel} onChange={handleInputChange} className="text-xs p-2 rounded border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" name="homedist" placeholder="Home District" value={formData.homedist} onChange={handleInputChange} className="text-xs p-2 rounded border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
                        <input type="text" name="tribe" placeholder="Tribe" value={formData.tribe} onChange={handleInputChange} className="text-xs p-2 rounded border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
                      </div>
                    </div>

                    {/* Section 4: Payroll Details */}
                    <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-slate-700">
                      <h4 className="text-[11px] font-extrabold text-blue-600 uppercase tracking-wider">4. Financial Records</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" name="ipps" placeholder="IPPS No" value={formData.ipps} onChange={handleInputChange} className="text-xs p-2 rounded border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
                        <input type="text" name="tin" placeholder="TIN No" value={formData.tin} onChange={handleInputChange} className="text-xs p-2 rounded border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" name="accno" placeholder="Bank Acc No" value={formData.accno} onChange={handleInputChange} className="text-xs p-2 rounded border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
                        <input type="text" name="bankbranch" placeholder="Bank Branch" value={formData.bankbranch} onChange={handleInputChange} className="text-xs p-2 rounded border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
                      </div>
                    </div>

                    {isArchivedReturnee && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 rounded-lg space-y-2">
                        <span className="text-xs font-bold text-amber-800 dark:text-amber-200">Authorized Re-Integration Reason</span>
                        <input type="text" placeholder="Reason for re-entry into active service" value={customReason} onChange={(e) => setCustomReason(e.target.value)} required className="w-full text-xs p-2 rounded border border-amber-300" />
                      </div>
                    )}

                    <div className="pt-2 flex gap-2">
                      <button type="submit" className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer">
                        {operation === 'new' ? 'Save Personnel Entry' : 'Update Personnel Data'}
                      </button>
                      {operation === 'update' && (
                        <button type="button" onClick={handleArchivePersonnel} className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer">
                          Archive
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Column: Dynamic Nominal Roll Table & Analytics */}
        <div className="lg:col-span-7 space-y-4">
          {/* Table Controls / Filters Bar */}
          <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-wrap gap-2 justify-between items-center">
            <div className="flex gap-2">
              <select value={filterRegion} onChange={(e) => { setFilterRegion(e.target.value); setFilterStation('ALL STATIONS'); }} className="text-xs p-2 rounded border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
                {canViewGlobal && <option value="ALL REGIONS">ALL REGIONS</option>}
                {Object.keys(REGIONAL_HIERARCHY).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select value={filterStation} onChange={(e) => setFilterStation(e.target.value)} className="text-xs p-2 rounded border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
                <option value="ALL STATIONS">ALL STATIONS</option>
                {(REGIONAL_HIERARCHY[filterRegion] || []).map(st => <option key={st} value={st}>{st}</option>)}
              </select>
            </div>

            {viewMode === 'active' && canEditRecords && (
              <button onClick={() => setBulkSelectMode(!bulkSelectMode)} className={`px-3 py-1.5 text-xs font-bold rounded cursor-pointer ${bulkSelectMode ? 'bg-amber-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`}>
                {bulkSelectMode ? 'Cancel Selection' : 'Bulk Operations'}
              </button>
            )}
          </div>

          {/* Analytics View */}
          {showAnalytics ? (
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex justify-between items-center border-b border-gray-200 dark:border-slate-700 pb-2">
                <h3 className="font-bold text-sm text-gray-800 dark:text-slate-100">Demographic Breakdown</h3>
                <select value={metricCategory} onChange={(e) => setMetricCategory(e.target.value)} className="text-xs p-1.5 rounded border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
                  <option value="RANK">By Rank Structure</option>
                  <option value="UNIT">By Deployment Station</option>
                  <option value="SEX">By Gender</option>
                  <option value="EDUCATION">By Education Standard</option>
                  <option value="DISTRICT">By Home District</option>
                  <option value="TRIBE">By Ethnic Grouping</option>
                </select>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-slate-700 max-h-[500px] overflow-y-auto">
                {calculatedMetrics.map(item => (
                  <div key={item.category} className="py-2 flex justify-between items-center text-xs">
                    <span className="font-bold">{item.category}</span>
                    <span className="px-2 py-0.5 bg-blue-50 dark:bg-slate-700 text-blue-700 dark:text-blue-300 rounded-full font-extrabold">{item.total}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Nominal Roll Master Table */
            <ExpandableTableCard title={`${viewMode.toUpperCase()} PERSONNEL ROSTER (${currentRollDataset.length})`}>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-extrabold uppercase">
                    {bulkSelectMode && <th className="p-2 w-8">#</th>}
                    <th className="p-2">Rank / Name</th>
                    <th className="p-2">Force No</th>
                    <th className="p-2">Station</th>
                    <th className="p-2">Contact</th>
                    <th className="p-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {currentRollDataset.map((officer) => {
                    const fNum = officer.fnum || officer.f_num;
                    return (
                      <tr key={fNum || officer.sn} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        {bulkSelectMode && (
                          <td className="p-2">
                            <input type="checkbox" checked={selectedOfficers.includes(fNum)} onChange={(e) => {
                              if (e.target.checked) setSelectedOfficers([...selectedOfficers, fNum]);
                              else setSelectedOfficers(selectedOfficers.filter(id => id !== fNum));
                            }} />
                          </td>
                        )}
                        <td className="p-2">
                          <div className="font-bold text-slate-800 dark:text-slate-100">{officer.rank} {officer.name}</div>
                          <div className="text-[10px] text-slate-400">{officer.position || 'General Duty'}</div>
                        </td>
                        <td className="p-2 font-mono text-slate-600 dark:text-slate-300">{fNum}</td>
                        <td className="p-2 text-slate-600 dark:text-slate-300">{officer.station}</td>
                        <td className="p-2 text-slate-600 dark:text-slate-300">{officer.contact || 'N/A'}</td>
                        <td className="p-2 text-right space-x-1">
                          <button onClick={() => setSelectedOfficer(officer)} className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded" title="View Dossier">
                            <Eye className="w-4 h-4" />
                          </button>
                          {canEditRecords && viewMode === 'active' && (
                            <button onClick={() => { populateUpdateForm(officer); setOperation('update'); }} className="p-1 text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-700 rounded" title="Edit Record">
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {currentRollDataset.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-400">No personnel records found for the current filter criteria.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </ExpandableTableCard>
          )}
        </div>
      </div>

      {/* Dossier Detail Modal */}
      {selectedOfficer && (
        <OfficerDossierModal officer={selectedOfficer} onClose={() => setSelectedOfficer(null)} />
      )}
    </div>
  );
};

export default Nominal_Roll;