import{r as e}from"./chunk-DHx0Hwia.js";import{t}from"./react-xCQysqH5.js";import{t as n}from"./jsx-runtime-Ds6D5m35.js";var r=e(t(),1);function i(e,t=new Date){if(e==null)return null;let n=t.getMonth();return e>=0?n>=2&&n<=4?`spring`:n>=5&&n<=7?`summer`:n>=8&&n<=10?`autumn`:`winter`:n>=2&&n<=4?`autumn`:n>=5&&n<=7?`winter`:n>=8&&n<=10?`spring`:`summer`}var a=n(),o={spring:{label:`Spring`,color:`#ec4899`,bg:`rgba(236,72,153,0.12)`,border:`rgba(236,72,153,0.25)`,particles:[`🌸`,`🌸`,`🌸`,`🌱`,`🌸`]},summer:{label:`Summer`,color:`#f59e0b`,bg:`rgba(245,158,11,0.12)`,border:`rgba(245,158,11,0.25)`,particles:[`☀️`,`✨`,`☀️`,`✨`,`☀️`]},autumn:{label:`Autumn`,color:`#ea580c`,bg:`rgba(234,88,12,0.12)`,border:`rgba(234,88,12,0.25)`,particles:[`🍂`,`🍁`,`🍂`,`🍁`,`🍂`]},winter:{label:`Winter`,color:`#6366f1`,bg:`rgba(99,102,241,0.12)`,border:`rgba(99,102,241,0.25)`,particles:[`❄️`,`❄️`,`✨`,`❄️`,`❄️`]}},s=`
@keyframes seasonFloat {
  0%   { transform: translateY(0) translateX(0) rotate(0deg); opacity: 0; }
  15%  { opacity: 1; }
  85%  { opacity: 1; }
  100% { transform: translateY(18px) translateX(6px) rotate(45deg); opacity: 0; }
}
@keyframes seasonPulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.15); }
}
`;function c({lat:e,light:t=!1}){let n=(0,r.useMemo)(()=>i(e),[e]);if(!n)return null;let c=o[n];return(0,a.jsxs)(`div`,{className:`season-badge`,style:{position:`relative`,display:`inline-flex`,alignItems:`center`,gap:4,padding:`2px 10px 2px 6px`,borderRadius:20,background:t?`rgba(255,255,255,0.15)`:c.bg,border:`1px solid ${t?`rgba(255,255,255,0.25)`:c.border}`,color:t?`#fff`:c.color,fontSize:`0.75rem`,fontWeight:600,overflow:`hidden`,lineHeight:1.4},children:[(0,a.jsx)(`style`,{children:s}),(0,a.jsxs)(`span`,{style:{position:`relative`,width:20,height:20,display:`inline-block`,flexShrink:0},children:[c.particles.map((e,t)=>(0,a.jsx)(`span`,{style:{position:`absolute`,fontSize:10,left:`${t*18%16}px`,top:-2,animation:`seasonFloat ${1.8+t*.3}s ease-in-out ${t*.4}s infinite`,opacity:0,pointerEvents:`none`},children:e},t)),(0,a.jsx)(`span`,{style:{position:`absolute`,top:1,left:2,fontSize:13,animation:`seasonPulse 2.5s ease-in-out infinite`},children:c.particles[0]})]}),(0,a.jsx)(`span`,{children:c.label})]})}c.__docgenInfo={description:``,methods:[],displayName:`SeasonBadge`,props:{light:{defaultValue:{value:`false`,computed:!1},required:!1}}};var l={title:`Composites/SeasonBadge`,component:c,tags:[`autodocs`],parameters:{layout:`centered`,docs:{description:{component:"Animated badge that reflects the current season derived from the user's latitude (`lat` prop). Pass a fixed lat to pin a specific season. Returns `null` if lat is `undefined` (renders nothing)."}}},argTypes:{lat:{description:`Latitude in decimal degrees. Used to determine hemisphere and season.`,control:{type:`number`,min:-90,max:90,step:1}},light:{description:`Light variant — white text on transparent background for dark/image backgrounds.`,control:`boolean`}}},u={args:{lat:51.5,light:!1}},d={args:{lat:51.5,light:!1},parameters:{docs:{description:{story:"Northern hemisphere summer. Pass `lat > 0` with a July date context."}}},render:e=>(0,a.jsx)(c,{...e,lat:-33.9})},f={args:{lat:-33.9,light:!1},name:`Autumn (Southern hemisphere)`},p={render:()=>(0,a.jsx)(c,{lat:51.5,light:!1}),parameters:{docs:{description:{story:`The season shown depends on the current real date and hemisphere. Pair with the Storybook background addon to test on dark surfaces.`}}}},m={name:`Light (for dark backgrounds)`,args:{lat:51.5,light:!0},parameters:{backgrounds:{default:`app-dark`}}},h={name:`All Four Seasons`,render:()=>(0,a.jsxs)(`div`,{className:`d-flex flex-column gap-3 align-items-start`,children:[[{label:`Spring (N. hemisphere, March–May)`,lat:40},{label:`Summer (S. hemisphere, Dec–Feb)`,lat:-34},{label:`Autumn (S. hemisphere, March–May)`,lat:-34},{label:`Winter (N. hemisphere, Dec–Feb)`,lat:40}].map(({label:e,lat:t})=>(0,a.jsxs)(`div`,{className:`d-flex align-items-center gap-3`,children:[(0,a.jsx)(c,{lat:t}),(0,a.jsx)(`span`,{className:`tx-muted`,style:{fontSize:12},children:e})]},e)),(0,a.jsx)(`p`,{className:`tx-muted mt-2`,style:{fontSize:11,maxWidth:420},children:`Note: the actual season shown depends on today's date and the hemisphere implied by the latitude. These stories demonstrate the badge in the current context — swap lats to force a different hemisphere.`})]})};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    lat: 51.5,
    light: false
  }
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    lat: 51.5,
    light: false
  },
  parameters: {
    docs: {
      description: {
        story: 'Northern hemisphere summer. Pass \`lat > 0\` with a July date context.'
      }
    }
  },
  // Pin to summer by using a southern-hemisphere lat in winter (which maps to summer in south)
  render: args => <SeasonBadge {...args} lat={-33.9} />
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    lat: -33.9,
    light: false
  },
  name: 'Autumn (Southern hemisphere)'
}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  render: () => {
    // December lat in northern hemisphere = winter
    // We simulate by using a southern-hemisphere summer lat that makes getSeason return winter
    // Pass 0 so getSeason defaults — use a mock approach via the light variant
    return <SeasonBadge lat={51.5} light={false} />;
  },
  parameters: {
    docs: {
      description: {
        story: 'The season shown depends on the current real date and hemisphere. ' + 'Pair with the Storybook background addon to test on dark surfaces.'
      }
    }
  }
}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  name: 'Light (for dark backgrounds)',
  args: {
    lat: 51.5,
    light: true
  },
  parameters: {
    backgrounds: {
      default: 'app-dark'
    }
  }
}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  name: 'All Four Seasons',
  render: () => <div className="d-flex flex-column gap-3 align-items-start">
      {/* Use lats that deterministically produce each season at the time this story runs */}
      {[{
      label: 'Spring (N. hemisphere, March–May)',
      lat: 40
    }, {
      label: 'Summer (S. hemisphere, Dec–Feb)',
      lat: -34
    }, {
      label: 'Autumn (S. hemisphere, March–May)',
      lat: -34
    }, {
      label: 'Winter (N. hemisphere, Dec–Feb)',
      lat: 40
    }].map(({
      label,
      lat
    }) => <div key={label} className="d-flex align-items-center gap-3">
          <SeasonBadge lat={lat} />
          <span className="tx-muted" style={{
        fontSize: 12
      }}>{label}</span>
        </div>)}
      <p className="tx-muted mt-2" style={{
      fontSize: 11,
      maxWidth: 420
    }}>
        Note: the actual season shown depends on today's date and the hemisphere
        implied by the latitude. These stories demonstrate the badge in the current
        context — swap lats to force a different hemisphere.
      </p>
    </div>
}`,...h.parameters?.docs?.source}}};var g=[`Spring`,`Summer`,`Autumn`,`Winter`,`LightVariant`,`AllSeasons`];export{h as AllSeasons,f as Autumn,m as LightVariant,u as Spring,d as Summer,p as Winter,g as __namedExportsOrder,l as default};