// Reads a listing's text and finds real problems (salvage title, frame damage, engine noise, slipping transmission...).
// Same rules as the scanner extension, so cars with problems never reach the dashboard.
// Deep read of a listing's text: what is wrong with this car?
// Each rule is [label, regex]. A hit counts unless the words just before it deny it ("no leaks", "never had an accident", "not salvage").
const BAD_RULES: [string, RegExp][] = [
  ['Salvage / rebuilt / branded title', /\b(salvage|salvaged|rebuilt|reconstructed|junk\s+title|flood\s+(title|car|damage)|water\s+damage\w*|lemon(\s+law)?|buy\s*back|bonded\s+title|no\s+title|missing\s+title|title\s+(issue|problem|washed|pending|lost)|lien\s+(on|sale)|theft\s+recovery|recovered\s+theft|non[- ]?repairable|total\s+loss|totaled|totalled)\b/i],
  ['Frame / structural damage', /\b(frame\s+(damage|bent|crack\w*|rust|rot\w*|repair\w*)|bent\s+frame|cracked\s+frame|unibody\s+damage|structural\s+damage|dog\s*track\w*|not\s+aligned)\b/i],
  ['Accident / collision damage', /\b(accident\s+damage|collision\s+damage|body\s+damage|front[- ]end\s+(damage|hit)|rear[- ]end(ed)?\s+(damage|hit)|been\s+(in\s+an?\s+)?(accident|wreck)|was\s+(in\s+an?\s+)?(accident|wreck)|wrecked|crashed|hit\s+a\s+(deer|pole|tree)|hail\s+damage|fire\s+damage|airbags?\s+(deployed|light|missing)|deployed\s+airbags?)\b/i],
  ['Engine problem or noise', /\b(engine\s+(knock\w*|noise\w*|tick\w*|rattl\w*|issues?|problems?|light|trouble|misfire\w*|failure|smok\w*|leak\w*|seiz\w*|damage)|rod\s+knock|knocking|ticking|lifter\s+(tick|noise)|piston\s+slap|misfir\w+|burn\w*\s+(oil|coolant)|oil\s+(leak\w*|consumption|burner)|coolant\s+leak\w*|head\s+gasket|blown\s+(engine|motor|head|gasket)|bad\s+(engine|motor)|needs?\s+(an?\s+)?(engine|motor)|overheat\w*|runs?\s+rough|rough\s+idle|stalls?|stalling|white\s+smoke|blue\s+smoke|black\s+smoke|timing\s+chain\s+(noise|rattle|issue))\b/i],
  ['Transmission problem', /\b(trans(mission)?\s+(slip\w*|issues?|problems?|noise|whin\w*|leak\w*|failure|failing|going\s+bad|rebuild|hesitat\w*)|bad\s+trans(mission)?|slipping|slips|hard\s+shift\w*|rough\s+shift\w*|harsh\s+shift\w*|won'?t\s+shift|doesn'?t\s+shift|stuck\s+in\s+(gear|park|neutral|limp)|limp\s+mode|no\s+reverse|jerks?|jerking|shudder\w*|cvt\s+(issue|problem|noise|whine)|clutch\s+(slip\w*|issue|problem|gone|bad))\b/i],
  ['Does not run / drive properly', /\b(not\s+running|non[- ]?running|(does(n'?t| not)|won'?t|will\s+not|can'?t)\s+(run|start|move|drive|crank|turn\s+over)|no[- ]?start|needs?\s+(a\s+)?(tow|jump)|tow(ed)?\s+only)\b/i],
  ['Needs repair / sold for parts', /\b(needs?\s+(some\s+)?(work|repairs?|tlc|fix\w*|attention|mechanic)|mechanic'?s?\s+special|project\s+car|for\s+parts|parts\s+car|part\s+out|fixer|handyman\s+special|repair\s+needed|(needs|requires)\s+(a\s+)?(new\s+)?(engine|transmission|motor|head\s+gasket|axle|compressor))\b/i],
  ['Warning light on', /\b(check\s+engine(\s+light)?(\s+(is\s+)?on)?|cel\s+(is\s+)?on|(abs|airbag|srs|tpms|traction|esc|brake|oil|battery)\s+(warning\s+)?light(s)?(\s+(is\s+|are\s+)?on)?|warning\s+lights?|service\s+engine\s+soon|dash\s+lights?\s+on|codes?\s+p[0-3]\d{3})\b/i],
  ['Odometer / mileage problem', /\b(odometer\s+(broken|not\s+working|rolled\s*back|rollback|issue|replaced|stopped)|cluster\s+(replaced|swap\w*|broken)|mileage\s+(not\s+actual|unknown|exempt)|tmu|true\s+mileage\s+unknown|exceeds\s+mechanical)\b/i],
  ['Other serious fault', /\b(leak(s|ing)?\s+(oil|coolant|trans\w*|fluid|power\s+steering)|ac\s+(doesn'?t|not)\s+work\w*|(a\/?c|ac)\s+(is\s+)?(out|broken|blows\s+hot)|power\s+steering\s+(leak|issue|problem|noise)|suspension\s+(issue|problem|noise|damage)|bad\s+(axle|cv|bearing|compressor|alternator|starter|catalytic)|stolen|mold|mildew|rodent|rat\s+damage|burn\s+marks?)\b/i]
];
const DENY_BEFORE = /\b(no|not|never|without|zero|free\s+of|isn'?t|aren'?t|doesn'?t|don'?t|didn'?t|hasn'?t|haven'?t|wasn'?t|clean|non|nothing|none|0)\s+(\w+\s+){0,3}$/i;

// Returns the first real problem found in the ad text, or '' if the ad reads clean.
export function conditionProblem(text: string | null | undefined): string {
  const t = String(text || '').replace(/\s+/g, ' ');
  for (const [label, re] of BAD_RULES) {
    const g = new RegExp(re.source, 'ig');
    let m: RegExpExecArray | null;
    while ((m = g.exec(t))) {
      const before = t.slice(Math.max(0, m.index - 40), m.index);
      const sentence = before.slice(Math.max(before.lastIndexOf('.'), before.lastIndexOf(','), before.lastIndexOf('!'), before.lastIndexOf(';')) + 1);
      if (DENY_BEFORE.test(sentence)) continue;
      return `${label}: "${m[0].trim().slice(0, 40)}"`;
    }
  }
  return '';
}
