// Afgrænsede diagnostiske forsøg til fysiologireviewet 2026-10-04.
// Kører den eksisterende motor uændret. Resultater er diagnostik, ikke klinisk
// validering. Manipulerede initialtilstande og direkte delmodelforsøg navngives.
const path = require('path');
const root = path.resolve(__dirname, '../..');
const {createEngine} = require(path.join(root,'js/physiology-engine.js'));
const {HovorkaModel,HOVORKA_STATE_IDX:S} = require(path.join(root,'js/hovorka.js'));
function engine(modules={}) {
  const e=createEngine({weight:70,isf:3,icr:10},{seed:20261004,noiseEnabled:false,
    modules:{dawn:0,dawnVariability:0,insulinVariability:0,sleepDisruption:0,cgmSensorFaults:false,...modules}});
  e.totalSimMinutes=840;e.timeInMinutes=840;e.initSteadyState();return e;
}
function advance(e,minutes,dt=1,after=()=>{}) {
  const n=Math.round(minutes/dt);
  for(let i=0;i<n;i++){e.step(dt);after(e,i);e.consumeEvents();}
}
const result={date:'2026-10-04',scope:'Unmodified implementation diagnostics; not treatment predictions'};
result.insulinFlux=[8,12,24,29,55,60,92].map(I=>{
  const h=new HovorkaModel(70,{insulinSensitivityScale:3/3.75});
  const a=h.steadyStateActions(I),q1=5.5*h.V_G,q2=a.x1*q1/(h.k_12+a.x2);
  const egp=Math.max(0,h.EGP_0*(1-a.x3));const rd=h.F_01/0.85*5.5/6.5+a.x2*q2;
  return {I,egp,rd,girMgKgMin:(rd-egp)*180.16/70,plottedVerticalGap:rd+egp,requiredInfusion:rd-egp};
});
// Delmodelforsøg: depot- og absorptionsbalance hen over 6-timers-oprydningen.
result.rapidExpiry=[];
for(const tauI of [55,88]) for(const dt of [1,0.5]) {
  const e=engine();e.totalSimMinutes=0;e.addRapidInsulin({units:10});
  e.activeFastInsulin[0].tauI=tauI;
  let absorbed=0,before=0,after=0;
  for(let i=1;i<=360/dt;i++) {
    e.totalSimMinutes=i*dt;
    if(i===360/dt) before=e.hovorka.state[S.S1]+e.hovorka.state[S.S2];
    e._prepInsulinRates();e._substepRapidInsulin(dt);
    absorbed+=e.hovorka.rapidU_I*dt;
    after=e.hovorka.state[S.S1]+e.hovorka.state[S.S2];
  }
  result.rapidExpiry.push({tauI,dt,initialEffectiveU:7.8,beforeExpiryU:before/1000,afterExpiryU:after/1000,absorbedU:absorbed/1000,unaccountedU:7.8-(absorbed+after)/1000});
}
// Glukosemassebalance over selve Hovorka-trinnet; perifert optag må ikke
// fortsætte med større masse end tilgængeligt i det perifere kompartment.
result.massBalance=[];
for(const insulinFree of [false,true]) for(const dt of [1,0.5,0.1]) {
  const e=engine({stressResponse:0,glucotoxicity:0,ketones:0});
  if(insulinFree){e.activeLongInsulin=[];for(const k of [S.S1b,S.S2b,S.Ib,S.I,S.x1,S.x2,S.x3])e.hovorka.state[k]=0;}
  const original=e.hovorka.step.bind(e.hovorka);let residual=0,maxResidual=0,q2ZeroSteps=0;
  e.hovorka.step=d=>{
    const h=e.hovorka,oldMass=h.state[S.Q1]+h.state[S.Q2];
    const disposal=h.state[S.x2]*h.state[S.Q2]+h.beta*h.state[S.E1];
    original(d);
    const expected=(h._lastUG+h._lastEGP-h._lastF01c-h._lastFR-disposal)*d;
    const r=h.state[S.Q1]+h.state[S.Q2]-oldMass-expected;
    residual+=r;maxResidual=Math.max(maxResidual,r);if(h.state[S.Q2]===0)q2ZeroSteps++;
  };
  e.startActivity({type:'cardio',intensity:'Høj',durationMin:60});advance(e,60,dt);
  result.massBalance.push({insulinFree,dt,residualMmol:residual,residualGrams:residual*0.18016,maxResidualMmol:maxResidual,q2ZeroSteps,endBG:e.trueBG});
}
// API accepterer spisetider op til 600 min. Test også normal spisetid.
result.foodDelivery=[];
for(const eating of [10,600]) for(const dt of [1,0.5]) {
  const e=engine();e.addFood({carbs:60,weight:60,eatTimeMin:eating});let appearance=0;
  advance(e,720,dt,()=>{appearance+=e.hovorka._lastUG*dt;});
  const retained=e.hovorka.state[S.D1]+e.hovorka.state[S.D2];
  result.foodDelivery.push({eating,dt,accountedCarbGrams:(appearance+retained)*0.18016,expectedGrams:60});
}
result.glucotoxicity=(()=>{
  const e=engine();e.trueBG=20;for(let m=0;m<1440;m++)e.updateGlucotoxicity(1);
  const f=e.glucotoxicResistanceFactor;return {load:e.glucotoxicLoad,resistanceFactor:f,ISFreduction:1-1/f,limitReduction:1-1/(1+e.GLUCOTOX_MAX_RESIST)};
})();
result.ffa=(()=>{const e=engine();return {resistanceCeiling:1+e.FFA_RESIST_MAX,maxISFreduction:1-1/(1+e.FFA_RESIST_MAX)};})();
// Kontroller at måltidsudfald faktisk kan afhænge af ICR, hvis docs hævder det.
result.icr=[5,10,20].map(icr=>{
  const e=engine();e.ICR=icr;e.addFood({carbs:40,weight:80});let peak=e.trueBG;
  advance(e,240,1,()=>{peak=Math.max(peak,e.trueBG);});return{icr,peak,end:e.trueBG};
});
// Klokkeslæt, sammensat måltid og motion: faktisk 1/.5/.1 min konvergens,
// ikke blot forskellige wrapper-stepstørrelser som alle opdeles i 1 min.
result.convergence=[1,0.5,0.1].map(dt=>{
  const e=engine();e.addFood({carbs:40,protein:20,fat:20,weight:200});e.addRapidInsulin({units:4});
  let min=e.trueBG,max=e.trueBG;
  advance(e,120,dt,()=>{min=Math.min(min,e.trueBG);max=Math.max(max,e.trueBG);});
  e.startActivity({type:'cardio',intensity:'Medium',durationMin:45});
  advance(e,240,dt,()=>{min=Math.min(min,e.trueBG);max=Math.max(max,e.trueBG);});
  return{dt,min,max,endBG:e.trueBG,ketones:e.ketoneLevel,muscle:e.muscleGlycogenGrams,liver:e.liverGlycogenGrams};
});
// Måltidets τG påvirker også kulhydrat, som allerede er i D2 (tarmen).
result.gutSecondMeal=(()=>{
  const e=engine();e.hovorka.state[S.D2]=100;e._substepFatProteinFFA(0);
  const before={tau:e.hovorka.tau_G,flux:100/e.hovorka.tau_G};
  e.addFood({carbs:0,protein:50,weight:50,eatTimeMin:1});e._processActiveIntake(1);e._substepFatProteinFFA(0);
  return {before,after:{tau:e.hovorka.tau_G,flux:100/e.hovorka.tau_G}};
})();
// Gemini pegede på et muligt restinput under geninitialisering. Sammenlign
// samme Hovorka-model med/uden en gemt rapidU_I; normal ny-opstart har værdien 0.
result.reinitializeResidualInput=[0,3,10].map(rapidInput=>{
  const h=new HovorkaModel(70,{insulinSensitivityScale:3/3.75});h.rapidU_I=rapidInput;
  try{h.initializeSteadyState(10,5.5);return{rapidInput,basalRate:h.steadyStateBasalRate,bg:h.glucoseConcentration};}
  catch(error){return{rapidInput,error:error.message};}
});
// Glykogenpuljen kan fyldes uden en tilsvarende målbar glukosetilførsel.
// Dette er en isoleret grænsekontrol, ikke en patientprognose.
result.muscleAllocation=(()=>{
  const e=engine();e.muscleGlycogenGrams=0;e.muscleGlycogenReserve=0;
  e.lastMuscleContractionEndTime=e.totalSimMinutes;e.setBG(6);
  for(const k of [S.I,S.x1,S.x2,S.x3,S.E1])e.hovorka.state[k]=0;
  e.updateMuscleGlycogen(1);
  return{poolIncreaseGrams:e.muscleGlycogenGrams,modeledPeripheralUptakeGrams:0,
    interpretation:'No explicit lactate/intracellular precursor budget; allocation is a capacity proxy'};
})();
// Kommentaren om 89 min ignorerer udvaskning; HAAF opbygges ikke ved BG 3,5.
result.hypoStressPlateau=(()=>{
  const e=engine();e.trueBG=3.5;e.acuteStressLevel=0;
  for(let i=0;i<600;i++)e.updateStressHormones(1);
  return{at600Minutes:e.acuteStressLevel,unclampedContinuousLimit:0.0045/(Math.LN2/60)};
})();
// Opfølgning på Gemini-rapporterne fra 3. oktober: et stort ydre kald må
// ikke blive til et stort Euler-trin. Begge motorer bruger samme seed/input.
result.batchedStep=(()=>{
  const a=engine(),b=engine();
  for(const e of [a,b]){e.addFood({carbs:40,protein:20,fat:20,weight:150});e.addRapidInsulin({units:4});}
  let maxDt=0,count=0;
  const original=a.hovorka.step.bind(a.hovorka);
  a.hovorka.step=dt=>{maxDt=Math.max(maxDt,dt);count++;return original(dt);};
  a.step(240);for(let t=0;t<240;t++)b.step(1);
  return{batchMinutes:240,hovorkaSteps:count,maxDt,
    maxStateDifference:Math.max(...Array.from(a.hovorka.state,(x,i)=>Math.abs(x-b.hovorka.state[i]))),
    oneCallBG:a.trueBG,repeatedCallsBG:b.trueBG};
})();
// Effektpanelet kalder størrelserne fluxes. Sammenhold deres fortegnede sum
// med den faktiske Q1-ændring: insulins allerede indregnede EGP-hæmning og
// optaget i Q2 må ikke lægges oven i Q1-transporten i en Q1-massebalance.
result.forceBalance=(()=>{
  const e=engine();const initialBG=e.trueBG;e.step(1);
  const h=e.hovorka,s=h.state,forces=e._computeBGForces();
  return{initialBG,afterBG:e.trueBG,
    displayedNetMmolMin:forces.filter(f=>f.kind==='flux').reduce((n,f)=>n+(f.direction==='up'?1:-1)*f.magnitude,0),
    observedQ1ChangeMmol:(e.trueBG-initialBG)*h.V_G,forces,
    netTransport:s[S.x1]*s[S.Q1]-h.k_12*s[S.Q2],peripheralDisposal:s[S.x2]*s[S.Q2],
    hepaticSuppression:h.EGP_0*Math.min(s[S.x3],h.stressMultiplier)};
})();
console.log(JSON.stringify(result,null,2));
