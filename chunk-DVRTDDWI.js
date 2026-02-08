import{a as G}from"./chunk-KODUIQMG.js";import{a as W,b as F,c as V,f as A,h as B,j as L,k as N,l as R,m as $,n as j,p as H}from"./chunk-GJ3ACHC3.js";import{Ea as I,Fa as D,H as l,Ha as E,M as P,N as M,Na as z,R as f,W as d,X as r,Y as s,Z as Q,aa as S,ba as p,ca as v,d as y,fa as O,ha as a,ia as C,ja as b,ka as q,la as k,ma as T,na as u,oa as g,pa as m,y as x,z as w}from"./chunk-45QSGMLT.js";function K(c,i){if(c&1&&(r(0,"option",27),a(1),s()),c&2){let t=i.$implicit;d("value",t.setID),l(),q(" ",t.setID," (",t.count," questions) ")}}function U(c,i){if(c&1&&(r(0,"option",27),a(1),s()),c&2){let t=i.$implicit;d("value",t),l(),C(t)}}function X(c,i){if(c&1&&(r(0,"option",27),a(1),s()),c&2){let t=i.$implicit;d("value",t),l(),C(t)}}function Z(c,i){if(c&1&&(r(0,"option",27),a(1),s()),c&2){let t=i.$implicit;d("value",t),l(),C(t)}}function ee(c,i){if(c&1){let t=S();r(0,"div",15)(1,"label")(2,"input",28),m("ngModelChange",function(o){x(t);let n=v();return g(n.showOnlyFlagged,o)||(n.showOnlyFlagged=o),w(o)}),p("change",function(){x(t);let o=v();return w(o.applyFilters())}),s(),a(3),s()()}if(c&2){let t=v();l(2),u("ngModel",t.showOnlyFlagged),l(),b(" Show only flagged questions (",t.flaggedQuestions.size,") ")}}function te(c,i){if(c&1&&(r(0,"option",27),a(1),s()),c&2){let t=i.$implicit;d("value",t.quizID+"|"+t.matchID),l(),T(" ",t.team1," vs ",t.team2," (",t.score1,"-",t.score2,") ")}}function ne(c,i){if(c&1&&(r(0,"span",40),a(1),s()),c&2){let t=v().$implicit;l(),C(t.qDescType)}}function ie(c,i){if(c&1&&(r(0,"span",41),a(1),s()),c&2){let t=v().$implicit;l(),k("",t.book," ",t.qChapter,":",t.qBegVerse)}}function oe(c,i){c&1&&(r(0,"span",42),a(1,"\u{1F6A9}"),s())}function se(c,i){if(c&1&&(r(0,"div",43)(1,"strong"),a(2,"A:"),s(),a(3),s()),c&2){let t=v().$implicit;l(3),b(" ",t.qAnswer," ")}}function re(c,i){if(c&1){let t=S();r(0,"div",29),p("click",function(){let o=x(t).$implicit,n=v();return w(n.toggleQuestion(o.questionID))}),r(1,"div",30)(2,"input",31),p("click",function(o){return x(t),w(o.stopPropagation())}),s()(),r(3,"div",32)(4,"div",33)(5,"span",34),a(6),s(),f(7,ne,2,1,"span",35)(8,ie,2,3,"span",36)(9,oe,2,0,"span",37),s(),r(10,"div",38),a(11),s(),f(12,se,4,1,"div",39),s()()}if(c&2){let t=i.$implicit,e=v();O("selected",e.isSelected(t.questionID))("flagged",e.isFlagged(t.questionID)),l(2),d("checked",e.isSelected(t.questionID)),l(4),b("ID: ",t.questionID),l(),d("ngIf",t.qDescType),l(),d("ngIf",t.qChapter),l(),d("ngIf",e.isFlagged(t.questionID)),l(2),C(t.qdescription),l(),d("ngIf",e.printOptions.includeAnswers)}}function ae(c,i){c&1&&(r(0,"div",44),a(1," No questions match your filters. "),s())}var Y=class c{constructor(i,t){this.dbService=i;this.router=t}questions=[];filteredQuestions=[];selectedQuestions=new Set;books=[];versions=[];questionTypes=[];selectedBook="";selectedVersion="";selectedType="";searchText="";quizSets=[];selectedQuizSet="";flaggedQuestions=new Set;showOnlyFlagged=!1;printOptions={includeAnswers:!0,includeVerseRefs:!0,includeQuestionIDs:!0,includeQuestionTypes:!0,questionsPerPage:5,fontSize:"medium"};matches=[];selectedMatch="";ngOnInit(){return y(this,null,function*(){yield this.loadQuestions(),yield this.loadQuizSets(),yield this.loadMatches(),this.loadFlaggedQuestions()})}loadQuestions(){return y(this,null,function*(){this.questions=yield this.dbService.getAllQuestions();let i=new Set,t=new Set,e=new Set;this.questions.forEach(o=>{o.book&&i.add(o.book),o.version&&t.add(o.version),o.qDescType&&e.add(o.qDescType)}),this.books=Array.from(i).sort(),this.versions=Array.from(t).sort(),this.questionTypes=Array.from(e).sort(),this.applyFilters()})}loadQuizSets(){return y(this,null,function*(){let i=yield this.dbService.getAllQuizSets(),t=[];for(let e of i){let o=yield this.dbService.getQuizSet(e);t.push({setID:e,count:o.length})}this.quizSets=t.sort((e,o)=>e.setID.localeCompare(o.setID))})}loadMatches(){return y(this,null,function*(){try{let o=(yield this.dbService.getDatabase()).transaction("matchSummary","readonly").objectStore("matchSummary").getAll();o.onsuccess=()=>{this.matches=o.result||[]}}catch(i){console.error("Failed to load matches:",i)}})}loadFlaggedQuestions(){let i=sessionStorage.getItem("flaggedQuestions");if(i)try{let t=JSON.parse(i);this.flaggedQuestions=new Set(t)}catch(t){console.error("Failed to load flagged questions:",t)}}applyFilters(){let i=[...this.questions];if(this.selectedBook&&(i=i.filter(t=>t.book===this.selectedBook)),this.selectedVersion&&(i=i.filter(t=>t.version===this.selectedVersion)),this.selectedType&&(i=i.filter(t=>t.qDescType===this.selectedType)),this.searchText){let t=this.searchText.toLowerCase();i=i.filter(e=>e.qdescription?.toLowerCase().includes(t)||e.qAnswer?.toLowerCase().includes(t))}this.showOnlyFlagged&&(i=i.filter(t=>this.flaggedQuestions.has(t.questionID))),this.filteredQuestions=i}loadQuizSetQuestions(){return y(this,null,function*(){if(!this.selectedQuizSet){this.applyFilters();return}let i=yield this.dbService.getQuizSet(this.selectedQuizSet),t=new Set(i.map(e=>e.questNum));this.selectedQuestions.clear(),this.filteredQuestions=this.questions.filter(e=>t.has(e.questionID)),this.filteredQuestions.forEach(e=>this.selectedQuestions.add(e.questionID))})}toggleQuestion(i){this.selectedQuestions.has(i)?this.selectedQuestions.delete(i):this.selectedQuestions.add(i)}selectAll(){this.filteredQuestions.forEach(i=>this.selectedQuestions.add(i.questionID))}selectNone(){this.selectedQuestions.clear()}isSelected(i){return this.selectedQuestions.has(i)}isFlagged(i){return this.flaggedQuestions.has(i)}getSelectedQuestions(){return this.filteredQuestions.filter(i=>this.selectedQuestions.has(i.questionID))}printQuestions(){let i=this.getSelectedQuestions();if(i.length===0){alert("Please select at least one question to print.");return}let t=window.open("","_blank");if(!t){alert("Please allow popups to print.");return}let o=`
<!DOCTYPE html>
<html>
<head>
  <title>Bible Quiz Questions</title>
  <style>
    body {
      font-family: Georgia, serif;
      font-size: ${this.printOptions.fontSize==="small"?"10pt":this.printOptions.fontSize==="large"?"14pt":"12pt"};
      line-height: 1.6;
      max-width: 8.5in;
      margin: 0 auto;
      padding: 0.5in;
    }
    h1 {
      text-align: center;
      font-size: 1.5em;
      margin-bottom: 0.5in;
    }
    .question {
      margin-bottom: 0.3in;
      page-break-inside: avoid;
    }
    .question-header {
      font-weight: bold;
      margin-bottom: 0.1in;
    }
    .question-meta {
      font-size: 0.85em;
      color: #666;
      margin-bottom: 0.05in;
    }
    .question-text {
      margin-bottom: 0.1in;
    }
    .answer {
      margin-left: 0.25in;
      border-left: 2px solid #333;
      padding-left: 0.15in;
    }
    .answer-label {
      font-weight: bold;
    }
    .verse-ref {
      font-style: italic;
      color: #555;
    }
    .page-break {
      page-break-after: always;
    }
    @media print {
      body { margin: 0; padding: 0.25in; }
    }
  </style>
</head>
<body>
  <h1>Bible Quiz Questions</h1>
`;i.forEach((n,_)=>{o+='<div class="question">',o+=`<div class="question-header">Question ${_+1}`,this.printOptions.includeQuestionIDs&&(o+=` <span style="font-weight: normal; color: #888;">(ID: ${n.questionID})</span>`),o+="</div>",(this.printOptions.includeQuestionTypes||this.printOptions.includeVerseRefs)&&(o+='<div class="question-meta">',this.printOptions.includeQuestionTypes&&n.qDescType&&(o+=`Type: ${n.qDescType} `),this.printOptions.includeVerseRefs&&n.qChapter&&(o+=`<span class="verse-ref">${n.book||""} ${n.qChapter}`,n.qBegVerse&&(o+=`:${n.qBegVerse}`,n.qEndVerse&&n.qEndVerse!==n.qBegVerse&&(o+=`-${n.qEndVerse}`)),o+="</span>"),o+="</div>"),o+=`<div class="question-text">${this.escapeHtml(n.qdescription||"")}</div>`,this.printOptions.includeAnswers&&(o+=`<div class="answer"><span class="answer-label">Answer:</span> ${this.escapeHtml(n.qAnswer||"")}</div>`),o+="</div>",this.printOptions.questionsPerPage>0&&(_+1)%this.printOptions.questionsPerPage===0&&_<i.length-1&&(o+='<div class="page-break"></div>')}),o+=`
  <div style="margin-top: 0.5in; text-align: center; font-size: 0.8em; color: #888;">
    Generated ${new Date().toLocaleDateString()} - ${i.length} questions
  </div>
</body>
</html>`,t.document.write(o),t.document.close(),t.focus(),setTimeout(()=>t.print(),500)}printMatch(){return y(this,null,function*(){if(!this.selectedMatch){alert("Please select a match to print.");return}let[i,t]=this.selectedMatch.split("|"),e=this.matches.find(h=>h.quizID===i&&h.matchID===t);if(!e){alert("Match not found.");return}let o=yield this.dbService.getMatchDetails(i,t),n=window.open("","_blank");if(!n){alert("Please allow popups to print.");return}let _=`
<!DOCTYPE html>
<html>
<head>
  <title>Match Report - ${e.team1} vs ${e.team2}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.4;
      max-width: 8.5in;
      margin: 0 auto;
      padding: 0.5in;
    }
    h1 { text-align: center; margin-bottom: 0.1in; }
    h2 { text-align: center; font-size: 1.2em; color: #555; margin-bottom: 0.3in; }
    .score-box {
      display: flex;
      justify-content: center;
      gap: 1in;
      margin-bottom: 0.3in;
      font-size: 1.3em;
    }
    .team-score {
      text-align: center;
      padding: 0.2in;
      border: 2px solid #333;
      border-radius: 8px;
      min-width: 2in;
    }
    .team-name { font-weight: bold; }
    .score { font-size: 1.5em; color: #1E40AF; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 0.3in;
    }
    th, td {
      border: 1px solid #ccc;
      padding: 0.1in;
      text-align: left;
    }
    th { background: #f0f0f0; }
    .correct { color: green; }
    .wrong { color: red; }
    @media print {
      body { margin: 0; padding: 0.25in; }
    }
  </style>
</head>
<body>
  <h1>Match Report</h1>
  <h2>${e.team1} vs ${e.team2}</h2>
  <div class="score-box">
    <div class="team-score">
      <div class="team-name">${e.team1}</div>
      <div class="score">${e.score1}</div>
    </div>
    <div class="team-score">
      <div class="team-name">${e.team2}</div>
      <div class="score">${e.score2}</div>
    </div>
  </div>
`;o.length>0&&(_+=`
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Type</th>
        <th>Action</th>
        <th>Player</th>
        <th>Points</th>
      </tr>
    </thead>
    <tbody>
`,o.filter(h=>!h.canceled).forEach((h,le)=>{let J=h.action==="Correct"?"correct":h.action==="Wrong"?"wrong":"";_+=`
      <tr>
        <td>${h.questNum}</td>
        <td>${h.questType==="B"?"Bonus":"Primary"}</td>
        <td class="${J}">${h.action}</td>
        <td>Player #${h.actionPlayer}</td>
        <td>${h.points}</td>
      </tr>
`}),_+=`
    </tbody>
  </table>
`),_+=`
  <div style="margin-top: 0.5in; text-align: center; font-size: 0.8em; color: #888;">
    Quiz ID: ${i} | Match ID: ${t} | Generated ${new Date().toLocaleDateString()}
  </div>
</body>
</html>`,n.document.write(_),n.document.close(),n.focus(),setTimeout(()=>n.print(),500)})}escapeHtml(i){let t=document.createElement("div");return t.textContent=i,t.innerHTML}goBack(){this.router.navigate(["/"])}static \u0275fac=function(t){return new(t||c)(P(G),P(z))};static \u0275cmp=M({type:c,selectors:[["app-print-questions"]],decls:102,vars:25,consts:[[1,"print-container"],[1,"print-header"],[1,"btn","btn-secondary",3,"click"],[1,"print-layout"],[1,"filter-panel"],[1,"filter-group"],[3,"ngModelChange","change","ngModel"],["value",""],[3,"value",4,"ngFor","ngForOf"],["type","text","placeholder","Search questions...",3,"ngModelChange","input","ngModel"],["class","filter-group checkbox-group",4,"ngIf"],[1,"selection-actions"],[1,"btn","btn-small",3,"click"],[1,"btn","btn-small","btn-secondary",3,"click"],[1,"selection-count"],[1,"filter-group","checkbox-group"],["type","checkbox",3,"ngModelChange","ngModel"],[3,"ngModelChange","ngModel"],["value","small"],["value","medium"],["value","large"],["type","number","min","1","max","20",3,"ngModelChange","ngModel"],[1,"btn","btn-primary","print-btn",3,"click","disabled"],[1,"preview-panel"],[1,"question-list"],["class","question-item",3,"selected","flagged","click",4,"ngFor","ngForOf"],["class","no-questions",4,"ngIf"],[3,"value"],["type","checkbox",3,"ngModelChange","change","ngModel"],[1,"question-item",3,"click"],[1,"question-checkbox"],["type","checkbox",3,"click","checked"],[1,"question-content"],[1,"question-meta-row"],[1,"q-id"],["class","q-type",4,"ngIf"],["class","q-ref",4,"ngIf"],["class","q-flag",4,"ngIf"],[1,"question-text"],["class","answer-text",4,"ngIf"],[1,"q-type"],[1,"q-ref"],[1,"q-flag"],[1,"answer-text"],[1,"no-questions"]],template:function(t,e){t&1&&(r(0,"div",0)(1,"header",1)(2,"h1"),a(3,"Print Questions & Matches"),s(),r(4,"button",2),p("click",function(){return e.goBack()}),a(5,"\u2190 Back to Menu"),s()(),r(6,"div",3)(7,"div",4)(8,"h2"),a(9,"Question Filters"),s(),r(10,"div",5)(11,"label"),a(12,"Quiz Set"),s(),r(13,"select",6),m("ngModelChange",function(n){return g(e.selectedQuizSet,n)||(e.selectedQuizSet=n),n}),p("change",function(){return e.loadQuizSetQuestions()}),r(14,"option",7),a(15,"-- All Questions --"),s(),f(16,K,2,3,"option",8),s()(),r(17,"div",5)(18,"label"),a(19,"Book"),s(),r(20,"select",6),m("ngModelChange",function(n){return g(e.selectedBook,n)||(e.selectedBook=n),n}),p("change",function(){return e.applyFilters()}),r(21,"option",7),a(22,"-- All Books --"),s(),f(23,U,2,2,"option",8),s()(),r(24,"div",5)(25,"label"),a(26,"Version"),s(),r(27,"select",6),m("ngModelChange",function(n){return g(e.selectedVersion,n)||(e.selectedVersion=n),n}),p("change",function(){return e.applyFilters()}),r(28,"option",7),a(29,"-- All Versions --"),s(),f(30,X,2,2,"option",8),s()(),r(31,"div",5)(32,"label"),a(33,"Question Type"),s(),r(34,"select",6),m("ngModelChange",function(n){return g(e.selectedType,n)||(e.selectedType=n),n}),p("change",function(){return e.applyFilters()}),r(35,"option",7),a(36,"-- All Types --"),s(),f(37,Z,2,2,"option",8),s()(),r(38,"div",5)(39,"label"),a(40,"Search"),s(),r(41,"input",9),m("ngModelChange",function(n){return g(e.searchText,n)||(e.searchText=n),n}),p("input",function(){return e.applyFilters()}),s()(),f(42,ee,4,2,"div",10),r(43,"div",11)(44,"button",12),p("click",function(){return e.selectAll()}),a(45,"Select All"),s(),r(46,"button",13),p("click",function(){return e.selectNone()}),a(47,"Select None"),s(),r(48,"span",14),a(49),s()(),r(50,"h2"),a(51,"Print Options"),s(),r(52,"div",15)(53,"label")(54,"input",16),m("ngModelChange",function(n){return g(e.printOptions.includeAnswers,n)||(e.printOptions.includeAnswers=n),n}),s(),a(55," Include answers "),s()(),r(56,"div",15)(57,"label")(58,"input",16),m("ngModelChange",function(n){return g(e.printOptions.includeVerseRefs,n)||(e.printOptions.includeVerseRefs=n),n}),s(),a(59," Include verse references "),s()(),r(60,"div",15)(61,"label")(62,"input",16),m("ngModelChange",function(n){return g(e.printOptions.includeQuestionIDs,n)||(e.printOptions.includeQuestionIDs=n),n}),s(),a(63," Include question IDs "),s()(),r(64,"div",15)(65,"label")(66,"input",16),m("ngModelChange",function(n){return g(e.printOptions.includeQuestionTypes,n)||(e.printOptions.includeQuestionTypes=n),n}),s(),a(67," Include question types "),s()(),r(68,"div",5)(69,"label"),a(70,"Font Size"),s(),r(71,"select",17),m("ngModelChange",function(n){return g(e.printOptions.fontSize,n)||(e.printOptions.fontSize=n),n}),r(72,"option",18),a(73,"Small (10pt)"),s(),r(74,"option",19),a(75,"Medium (12pt)"),s(),r(76,"option",20),a(77,"Large (14pt)"),s()()(),r(78,"div",5)(79,"label"),a(80,"Questions per page"),s(),r(81,"input",21),m("ngModelChange",function(n){return g(e.printOptions.questionsPerPage,n)||(e.printOptions.questionsPerPage=n),n}),s()(),r(82,"button",22),p("click",function(){return e.printQuestions()}),a(83),s(),Q(84,"hr"),r(85,"h2"),a(86,"Print Match Report"),s(),r(87,"div",5)(88,"label"),a(89,"Select Match"),s(),r(90,"select",17),m("ngModelChange",function(n){return g(e.selectedMatch,n)||(e.selectedMatch=n),n}),r(91,"option",7),a(92,"-- Select a Match --"),s(),f(93,te,2,5,"option",8),s()(),r(94,"button",22),p("click",function(){return e.printMatch()}),a(95," \u{1F5A8}\uFE0F Print Match Report "),s()(),r(96,"div",23)(97,"h2"),a(98),s(),r(99,"div",24),f(100,re,13,11,"div",25)(101,ae,2,0,"div",26),s()()()()),t&2&&(l(13),u("ngModel",e.selectedQuizSet),l(3),d("ngForOf",e.quizSets),l(4),u("ngModel",e.selectedBook),l(3),d("ngForOf",e.books),l(4),u("ngModel",e.selectedVersion),l(3),d("ngForOf",e.versions),l(4),u("ngModel",e.selectedType),l(3),d("ngForOf",e.questionTypes),l(4),u("ngModel",e.searchText),l(),d("ngIf",e.flaggedQuestions.size>0),l(7),b("",e.selectedQuestions.size," selected"),l(5),u("ngModel",e.printOptions.includeAnswers),l(4),u("ngModel",e.printOptions.includeVerseRefs),l(4),u("ngModel",e.printOptions.includeQuestionIDs),l(4),u("ngModel",e.printOptions.includeQuestionTypes),l(5),u("ngModel",e.printOptions.fontSize),l(10),u("ngModel",e.printOptions.questionsPerPage),l(),d("disabled",e.selectedQuestions.size===0),l(),b(" \u{1F5A8}\uFE0F Print ",e.selectedQuestions.size," Questions "),l(7),u("ngModel",e.selectedMatch),l(3),d("ngForOf",e.matches),l(),d("disabled",!e.selectedMatch),l(4),b("Questions (",e.filteredQuestions.length,")"),l(2),d("ngForOf",e.filteredQuestions),l(),d("ngIf",e.filteredQuestions.length===0))},dependencies:[E,I,D,H,N,R,F,B,W,L,V,j,$,A],styles:[".print-container[_ngcontent-%COMP%]{min-height:100vh;background:linear-gradient(135deg,var(--xl-gray-light) 0%,var(--xl-white) 100%);padding:var(--spacing-lg)}.print-header[_ngcontent-%COMP%]{display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--spacing-xl);padding:var(--spacing-md) var(--spacing-lg);background:var(--xl-white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg)}.print-header[_ngcontent-%COMP%]   h1[_ngcontent-%COMP%]{font-family:var(--font-heading);color:var(--xl-blue-dark);margin:0}.print-layout[_ngcontent-%COMP%]{display:grid;grid-template-columns:350px 1fr;gap:var(--spacing-xl)}.filter-panel[_ngcontent-%COMP%]{background:var(--xl-white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);padding:var(--spacing-lg);max-height:calc(100vh - 200px);overflow-y:auto}.filter-panel[_ngcontent-%COMP%]   h2[_ngcontent-%COMP%]{font-size:1.1rem;color:var(--xl-blue-dark);margin:0 0 var(--spacing-md) 0;padding-bottom:var(--spacing-sm);border-bottom:2px solid var(--xl-blue)}.filter-group[_ngcontent-%COMP%]{margin-bottom:var(--spacing-md)}.filter-group[_ngcontent-%COMP%]   label[_ngcontent-%COMP%]{display:block;font-weight:600;color:var(--xl-black);margin-bottom:var(--spacing-xs);font-size:.9rem}.filter-group[_ngcontent-%COMP%]   select[_ngcontent-%COMP%], .filter-group[_ngcontent-%COMP%]   input[type=text][_ngcontent-%COMP%], .filter-group[_ngcontent-%COMP%]   input[type=number][_ngcontent-%COMP%]{width:100%;padding:var(--spacing-sm);border:1px solid var(--xl-gray);border-radius:var(--radius-md);font-size:.9rem}.filter-group[_ngcontent-%COMP%]   select[_ngcontent-%COMP%]:focus, .filter-group[_ngcontent-%COMP%]   input[_ngcontent-%COMP%]:focus{outline:none;border-color:var(--xl-blue);box-shadow:0 0 0 3px #3b82f61a}.checkbox-group[_ngcontent-%COMP%]   label[_ngcontent-%COMP%]{display:flex;align-items:center;gap:var(--spacing-sm);cursor:pointer;font-weight:500}.checkbox-group[_ngcontent-%COMP%]   input[type=checkbox][_ngcontent-%COMP%]{width:18px;height:18px;cursor:pointer}.selection-actions[_ngcontent-%COMP%]{display:flex;align-items:center;gap:var(--spacing-sm);margin:var(--spacing-md) 0;padding:var(--spacing-sm) 0;border-top:1px solid var(--xl-gray-light);border-bottom:1px solid var(--xl-gray-light)}.selection-count[_ngcontent-%COMP%]{margin-left:auto;font-weight:600;color:var(--xl-blue-dark)}.btn-small[_ngcontent-%COMP%]{padding:var(--spacing-xs) var(--spacing-sm);font-size:.8rem}.print-btn[_ngcontent-%COMP%]{width:100%;margin-top:var(--spacing-md);padding:var(--spacing-md);font-size:1rem}.btn-primary[_ngcontent-%COMP%]{background:var(--xl-blue);color:var(--xl-white);border:none;cursor:pointer;transition:background .2s ease}.btn-primary[_ngcontent-%COMP%]:hover:not(:disabled){background:var(--xl-blue-dark)}.btn-primary[_ngcontent-%COMP%]:disabled{background:var(--xl-gray);cursor:not-allowed}hr[_ngcontent-%COMP%]{border:none;border-top:1px solid var(--xl-gray-light);margin:var(--spacing-lg) 0}.preview-panel[_ngcontent-%COMP%]{background:var(--xl-white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);padding:var(--spacing-lg);max-height:calc(100vh - 200px);overflow-y:auto}.preview-panel[_ngcontent-%COMP%]   h2[_ngcontent-%COMP%]{font-size:1.1rem;color:var(--xl-blue-dark);margin:0 0 var(--spacing-md) 0}.question-list[_ngcontent-%COMP%]{display:flex;flex-direction:column;gap:var(--spacing-sm)}.question-item[_ngcontent-%COMP%]{display:flex;gap:var(--spacing-md);padding:var(--spacing-md);border:1px solid var(--xl-gray-light);border-radius:var(--radius-md);cursor:pointer;transition:all .2s ease}.question-item[_ngcontent-%COMP%]:hover{border-color:var(--xl-blue);background:#3b82f605}.question-item.selected[_ngcontent-%COMP%]{border-color:var(--xl-blue);background:#3b82f614}.question-item.flagged[_ngcontent-%COMP%]{border-left:4px solid #f59e0b}.question-checkbox[_ngcontent-%COMP%]{display:flex;align-items:flex-start;padding-top:2px}.question-checkbox[_ngcontent-%COMP%]   input[_ngcontent-%COMP%]{width:18px;height:18px;cursor:pointer}.question-content[_ngcontent-%COMP%]{flex:1;min-width:0}.question-meta-row[_ngcontent-%COMP%]{display:flex;gap:var(--spacing-sm);margin-bottom:var(--spacing-xs);flex-wrap:wrap}.q-id[_ngcontent-%COMP%]{font-size:.75rem;color:var(--xl-gray-medium);background:var(--xl-gray-light);padding:2px 6px;border-radius:var(--radius-sm)}.q-type[_ngcontent-%COMP%]{font-size:.75rem;color:var(--xl-white);background:var(--xl-blue);padding:2px 6px;border-radius:var(--radius-sm);font-weight:600}.q-ref[_ngcontent-%COMP%]{font-size:.75rem;color:var(--xl-blue-dark);font-style:italic}.q-flag[_ngcontent-%COMP%]{font-size:.85rem}.question-text[_ngcontent-%COMP%]{font-size:.9rem;color:var(--xl-black);line-height:1.4}.answer-text[_ngcontent-%COMP%]{font-size:.85rem;color:var(--xl-gray-dark);margin-top:var(--spacing-xs);padding-top:var(--spacing-xs);border-top:1px dashed var(--xl-gray-light)}.no-questions[_ngcontent-%COMP%]{text-align:center;padding:var(--spacing-2xl);color:var(--xl-gray-medium);font-style:italic}@media (max-width: 900px){.print-layout[_ngcontent-%COMP%]{grid-template-columns:1fr}.filter-panel[_ngcontent-%COMP%], .preview-panel[_ngcontent-%COMP%]{max-height:none}}"]})};export{Y as PrintQuestionsComponent};
