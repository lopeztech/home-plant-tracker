import{t as e}from"./jsx-runtime-Ds6D5m35.js";var t=e(),n={title:`Design Tokens/Overview`,tags:[`autodocs`],parameters:{layout:`padded`,docs:{description:{component:"Living reference for every design token used across the app. See `DESIGN.md` for the full typography spec."}}}},r=[{token:`--tx-size-xs`,size:`0.75rem`,px:12,use:`Metadata, timestamps, captions`},{token:`--tx-size-sm`,size:`0.875rem`,px:14,use:`Body text, form labels, panel headers`},{token:`--tx-size-base`,size:`1rem`,px:16,use:`Large body, feature descriptions`},{token:`--tx-size-lg`,size:`1.25rem`,px:20,use:`Section headings, chart titles`},{token:`--tx-size-xl`,size:`1.5625rem`,px:25,use:`Sub-display figures`},{token:`--tx-size-2xl`,size:`1.9375rem`,px:31,use:`Display — empty-state headings`},{token:`--tx-size-3xl`,size:`2.4375rem`,px:39,use:`Hero / marketing surfaces`}],i={name:`Typography Scale`,render:()=>(0,t.jsxs)(`div`,{style:{fontFamily:`inherit`,maxWidth:720},children:[(0,t.jsx)(`h4`,{className:`tx-heading mb-3`,children:`Type Scale — Major Third (×1.25) · Base 16 px`}),(0,t.jsx)(`div`,{className:`d-flex flex-column gap-3`,children:r.map(({token:e,size:n,px:r,use:i})=>(0,t.jsxs)(`div`,{className:`d-flex align-items-baseline gap-4 border-bottom pb-3`,children:[(0,t.jsxs)(`div`,{style:{width:130,flexShrink:0},children:[(0,t.jsx)(`code`,{className:`tx-muted`,style:{fontSize:11},children:e}),(0,t.jsxs)(`div`,{className:`tx-muted mt-1`,children:[n,` / `,r,`px`]})]}),(0,t.jsx)(`span`,{style:{fontSize:n,fontWeight:400,lineHeight:1.4},children:`The quick brown fox`}),(0,t.jsx)(`span`,{className:`tx-muted ms-auto`,style:{fontSize:12,minWidth:220},children:i})]},e))}),(0,t.jsx)(`h4`,{className:`tx-heading mt-5 mb-3`,children:`Semantic Utility Classes`}),(0,t.jsx)(`div`,{className:`d-flex flex-column gap-2`,children:[{cls:`tx-display`,sample:`Display heading`},{cls:`tx-heading`,sample:`Section heading`},{cls:`tx-title`,sample:`Panel / modal title`},{cls:`tx-body`,sample:`Paragraph body copy`},{cls:`tx-muted`,sample:`Timestamp · metadata · caption`}].map(({cls:e,sample:n})=>(0,t.jsxs)(`div`,{className:`d-flex align-items-center gap-3`,children:[(0,t.jsxs)(`code`,{style:{width:110,fontSize:11,flexShrink:0},children:[`.`,e]}),(0,t.jsx)(`span`,{className:e,children:n})]},e))})]})},a=[`olive`,`earth`,`aurora`,`lunar`,`nebula`,`night`,`solar`,`storm`,`flare`],o={olive:{primary:`#5d623b`,accent:`#8b9459`,bg:`#f4f6ea`},earth:{primary:`#7a5c3c`,accent:`#b08060`,bg:`#f6f0ea`},aurora:{primary:`#2d6a6a`,accent:`#4a9999`,bg:`#eaf4f4`},lunar:{primary:`#3d3d5c`,accent:`#6a6a99`,bg:`#eeeef6`},nebula:{primary:`#5c3d6a`,accent:`#8a5e99`,bg:`#f2eef6`},night:{primary:`#2a2a3c`,accent:`#4a4a6a`,bg:`#14181e`},solar:{primary:`#6a4a1c`,accent:`#c87d2c`,bg:`#f6f0e4`},storm:{primary:`#2a4a5c`,accent:`#4a7a99`,bg:`#e8f0f6`},flare:{primary:`#6a2a2a`,accent:`#b04040`,bg:`#f6e8e8`}},s={name:`Colour Palettes`,render:()=>(0,t.jsxs)(`div`,{style:{maxWidth:840},children:[(0,t.jsx)(`h4`,{className:`tx-heading mb-3`,children:`9 Theme Palettes`}),(0,t.jsxs)(`p`,{className:`tx-muted mb-4`,children:[`Selected via `,(0,t.jsx)(`code`,{children:`LayoutContext.changeThemeStyle()`}),`. The active palette is loaded from `,(0,t.jsx)(`code`,{children:`public/css/{theme}.css`}),`. Olive is the default.`]}),(0,t.jsx)(`div`,{className:`row g-3`,children:a.map(e=>{let n=o[e];return(0,t.jsx)(`div`,{className:`col-6 col-md-4`,children:(0,t.jsxs)(`div`,{className:`border rounded overflow-hidden`,children:[(0,t.jsx)(`div`,{style:{background:n.bg,padding:`12px 12px 6px`},children:(0,t.jsxs)(`div`,{className:`d-flex gap-2 mb-2`,children:[(0,t.jsx)(`div`,{style:{width:32,height:32,borderRadius:4,background:n.primary},title:`Primary`}),(0,t.jsx)(`div`,{style:{width:32,height:32,borderRadius:4,background:n.accent},title:`Accent`}),(0,t.jsx)(`div`,{style:{width:32,height:32,borderRadius:4,background:n.bg,border:`1px solid #ccc`},title:`Background`})]})}),(0,t.jsxs)(`div`,{className:`px-2 py-1 bg-body-tertiary`,children:[(0,t.jsx)(`span`,{className:`fw-600 text-capitalize`,style:{fontSize:13},children:e}),e===`olive`&&(0,t.jsx)(`span`,{className:`badge bg-success ms-2`,style:{fontSize:10},children:`default`})]})]})},e)})})]})},c=[1,2,3,4,6,8,10,12,16,20,24,32,40,48],l={name:`Spacing Scale`,render:()=>(0,t.jsxs)(`div`,{style:{maxWidth:640},children:[(0,t.jsx)(`h4`,{className:`tx-heading mb-3`,children:`Spacing — Bootstrap 4px grid`}),(0,t.jsxs)(`p`,{className:`tx-muted mb-4`,children:[`All spacing uses Bootstrap's 4 px grid via utility classes (`,(0,t.jsx)(`code`,{children:`.gap-2`}),`,`,` `,(0,t.jsx)(`code`,{children:`.p-3`}),`, etc.) or explicit `,(0,t.jsx)(`code`,{children:`px`}),` values.`]}),(0,t.jsx)(`div`,{className:`d-flex flex-column gap-2`,children:c.map(e=>(0,t.jsxs)(`div`,{className:`d-flex align-items-center gap-3`,children:[(0,t.jsxs)(`code`,{style:{width:40,fontSize:11,flexShrink:0},children:[e*4,`px`]}),(0,t.jsx)(`div`,{style:{width:e*4,height:16,background:`var(--bs-primary, #5d623b)`,borderRadius:2,flexShrink:0}}),(0,t.jsxs)(`span`,{className:`tx-muted`,style:{fontSize:11},children:[e,`× · `,(0,t.jsxs)(`code`,{children:[`.gap-`,e>5?`[custom]`:e]})]})]},e))})]})},u={name:`Motion Tokens`,render:()=>(0,t.jsxs)(`div`,{style:{maxWidth:580},children:[(0,t.jsx)(`h4`,{className:`tx-heading mb-3`,children:`Animation Timing`}),(0,t.jsxs)(`p`,{className:`tx-muted mb-4`,children:[`Defined in `,(0,t.jsx)(`code`,{children:`src/motion/tokens.js`}),`. All framer-motion transitions use these values; do not hard-code durations elsewhere.`]}),(0,t.jsxs)(`table`,{className:`table table-sm`,children:[(0,t.jsx)(`thead`,{children:(0,t.jsxs)(`tr`,{children:[(0,t.jsx)(`th`,{children:`Token`}),(0,t.jsx)(`th`,{children:`Value (s)`}),(0,t.jsx)(`th`,{children:`Use`})]})}),(0,t.jsxs)(`tbody`,{children:[(0,t.jsxs)(`tr`,{children:[(0,t.jsx)(`td`,{children:(0,t.jsx)(`code`,{children:`DURATION.fast`})}),(0,t.jsx)(`td`,{children:`0.12`}),(0,t.jsx)(`td`,{children:`Exit / dismiss animations`})]}),(0,t.jsxs)(`tr`,{children:[(0,t.jsx)(`td`,{children:(0,t.jsx)(`code`,{children:`DURATION.normal`})}),(0,t.jsx)(`td`,{children:`0.20`}),(0,t.jsx)(`td`,{children:`Standard element enter/exit`})]}),(0,t.jsxs)(`tr`,{children:[(0,t.jsx)(`td`,{children:(0,t.jsx)(`code`,{children:`DURATION.slow`})}),(0,t.jsx)(`td`,{children:`0.32`}),(0,t.jsx)(`td`,{children:`Page transitions, sheet slides`})]}),(0,t.jsxs)(`tr`,{children:[(0,t.jsx)(`td`,{children:(0,t.jsx)(`code`,{children:`EASE.out`})}),(0,t.jsx)(`td`,{children:`[0,0,0.2,1]`}),(0,t.jsx)(`td`,{children:`Natural deceleration (most transitions)`})]}),(0,t.jsxs)(`tr`,{children:[(0,t.jsx)(`td`,{children:(0,t.jsx)(`code`,{children:`EASE.inOut`})}),(0,t.jsx)(`td`,{children:`[0.4,0,0.2,1]`}),(0,t.jsx)(`td`,{children:`Bidirectional element morphs`})]}),(0,t.jsxs)(`tr`,{children:[(0,t.jsx)(`td`,{children:(0,t.jsx)(`code`,{children:`STAGGER_DELAY`})}),(0,t.jsx)(`td`,{children:`0.04`}),(0,t.jsx)(`td`,{children:`Per-item offset in list stagger`})]})]})]})]})},d=[{name:`leaflet-map`,value:400,note:`Leaflet layer pane`},{name:`leaflet-marker`,value:600,note:`Leaflet marker pane`},{name:`sticky / fixed`,value:1020,note:`Bootstrap sticky top/fixed`},{name:`offcanvas`,value:1045,note:`Bootstrap offcanvas backdrop`},{name:`modal-backdrop`,value:1050,note:`Bootstrap modal backdrop`},{name:`modal`,value:1055,note:`Bootstrap modal`},{name:`popover`,value:1070,note:`Bootstrap popovers`},{name:`tooltip`,value:1080,note:`Bootstrap tooltips`},{name:`toast`,value:9999,note:`App toast notifications (top-end)`}],f={name:`Z-Index Layers`,render:()=>(0,t.jsxs)(`div`,{style:{maxWidth:560},children:[(0,t.jsx)(`h4`,{className:`tx-heading mb-3`,children:`Z-Index Stack`}),(0,t.jsxs)(`table`,{className:`table table-sm`,children:[(0,t.jsx)(`thead`,{children:(0,t.jsxs)(`tr`,{children:[(0,t.jsx)(`th`,{children:`Layer`}),(0,t.jsx)(`th`,{children:`z-index`}),(0,t.jsx)(`th`,{children:`Note`})]})}),(0,t.jsx)(`tbody`,{children:d.map(({name:e,value:n,note:r})=>(0,t.jsxs)(`tr`,{children:[(0,t.jsx)(`td`,{children:(0,t.jsx)(`code`,{children:e})}),(0,t.jsx)(`td`,{children:n}),(0,t.jsx)(`td`,{className:`tx-muted`,style:{fontSize:12},children:r})]},e))})]})]})};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  name: 'Typography Scale',
  render: () => <div style={{
    fontFamily: 'inherit',
    maxWidth: 720
  }}>
      <h4 className="tx-heading mb-3">Type Scale — Major Third (×1.25) · Base 16 px</h4>
      <div className="d-flex flex-column gap-3">
        {TYPE_SCALE.map(({
        token,
        size,
        px,
        use
      }) => <div key={token} className="d-flex align-items-baseline gap-4 border-bottom pb-3">
            <div style={{
          width: 130,
          flexShrink: 0
        }}>
              <code className="tx-muted" style={{
            fontSize: 11
          }}>{token}</code>
              <div className="tx-muted mt-1">{size} / {px}px</div>
            </div>
            <span style={{
          fontSize: size,
          fontWeight: 400,
          lineHeight: 1.4
        }}>
              The quick brown fox
            </span>
            <span className="tx-muted ms-auto" style={{
          fontSize: 12,
          minWidth: 220
        }}>{use}</span>
          </div>)}
      </div>

      <h4 className="tx-heading mt-5 mb-3">Semantic Utility Classes</h4>
      <div className="d-flex flex-column gap-2">
        {[{
        cls: 'tx-display',
        sample: 'Display heading'
      }, {
        cls: 'tx-heading',
        sample: 'Section heading'
      }, {
        cls: 'tx-title',
        sample: 'Panel / modal title'
      }, {
        cls: 'tx-body',
        sample: 'Paragraph body copy'
      }, {
        cls: 'tx-muted',
        sample: 'Timestamp · metadata · caption'
      }].map(({
        cls,
        sample
      }) => <div key={cls} className="d-flex align-items-center gap-3">
            <code style={{
          width: 110,
          fontSize: 11,
          flexShrink: 0
        }}>.{cls}</code>
            <span className={cls}>{sample}</span>
          </div>)}
      </div>
    </div>
}`,...i.parameters?.docs?.source}}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  name: 'Colour Palettes',
  render: () => <div style={{
    maxWidth: 840
  }}>
      <h4 className="tx-heading mb-3">9 Theme Palettes</h4>
      <p className="tx-muted mb-4">
        Selected via <code>LayoutContext.changeThemeStyle()</code>. The active palette
        is loaded from <code>public/css/&#123;theme&#125;.css</code>. Olive is the default.
      </p>
      <div className="row g-3">
        {THEMES.map(name => {
        const sw = THEME_SWATCHES[name];
        return <div key={name} className="col-6 col-md-4">
              <div className="border rounded overflow-hidden">
                <div style={{
              background: sw.bg,
              padding: '12px 12px 6px'
            }}>
                  <div className="d-flex gap-2 mb-2">
                    <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 4,
                  background: sw.primary
                }} title="Primary" />
                    <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 4,
                  background: sw.accent
                }} title="Accent" />
                    <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 4,
                  background: sw.bg,
                  border: '1px solid #ccc'
                }} title="Background" />
                  </div>
                </div>
                <div className="px-2 py-1 bg-body-tertiary">
                  <span className="fw-600 text-capitalize" style={{
                fontSize: 13
              }}>{name}</span>
                  {name === 'olive' && <span className="badge bg-success ms-2" style={{
                fontSize: 10
              }}>default</span>}
                </div>
              </div>
            </div>;
      })}
      </div>
    </div>
}`,...s.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  name: 'Spacing Scale',
  render: () => <div style={{
    maxWidth: 640
  }}>
      <h4 className="tx-heading mb-3">Spacing — Bootstrap 4px grid</h4>
      <p className="tx-muted mb-4">
        All spacing uses Bootstrap's 4 px grid via utility classes (<code>.gap-2</code>,{' '}
        <code>.p-3</code>, etc.) or explicit <code>px</code> values.
      </p>
      <div className="d-flex flex-column gap-2">
        {SPACING.map(u => <div key={u} className="d-flex align-items-center gap-3">
            <code style={{
          width: 40,
          fontSize: 11,
          flexShrink: 0
        }}>{u * 4}px</code>
            <div style={{
          width: u * 4,
          height: 16,
          background: 'var(--bs-primary, #5d623b)',
          borderRadius: 2,
          flexShrink: 0
        }} />
            <span className="tx-muted" style={{
          fontSize: 11
        }}>
              {u}× · <code>.gap-{u > 5 ? \`[custom]\` : u}</code>
            </span>
          </div>)}
      </div>
    </div>
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  name: 'Motion Tokens',
  render: () => <div style={{
    maxWidth: 580
  }}>
      <h4 className="tx-heading mb-3">Animation Timing</h4>
      <p className="tx-muted mb-4">
        Defined in <code>src/motion/tokens.js</code>. All framer-motion transitions use
        these values; do not hard-code durations elsewhere.
      </p>
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Token</th>
            <th>Value (s)</th>
            <th>Use</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><code>DURATION.fast</code></td><td>0.12</td><td>Exit / dismiss animations</td></tr>
          <tr><td><code>DURATION.normal</code></td><td>0.20</td><td>Standard element enter/exit</td></tr>
          <tr><td><code>DURATION.slow</code></td><td>0.32</td><td>Page transitions, sheet slides</td></tr>
          <tr><td><code>EASE.out</code></td><td>[0,0,0.2,1]</td><td>Natural deceleration (most transitions)</td></tr>
          <tr><td><code>EASE.inOut</code></td><td>[0.4,0,0.2,1]</td><td>Bidirectional element morphs</td></tr>
          <tr><td><code>STAGGER_DELAY</code></td><td>0.04</td><td>Per-item offset in list stagger</td></tr>
        </tbody>
      </table>
    </div>
}`,...u.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  name: 'Z-Index Layers',
  render: () => <div style={{
    maxWidth: 560
  }}>
      <h4 className="tx-heading mb-3">Z-Index Stack</h4>
      <table className="table table-sm">
        <thead>
          <tr><th>Layer</th><th>z-index</th><th>Note</th></tr>
        </thead>
        <tbody>
          {Z_LAYERS.map(({
          name,
          value,
          note
        }) => <tr key={name}>
              <td><code>{name}</code></td>
              <td>{value}</td>
              <td className="tx-muted" style={{
            fontSize: 12
          }}>{note}</td>
            </tr>)}
        </tbody>
      </table>
    </div>
}`,...f.parameters?.docs?.source}}};var p=[`TypographyScale`,`ColourPalettes`,`SpacingScale`,`MotionTokens`,`ZIndexLayers`];export{s as ColourPalettes,u as MotionTokens,l as SpacingScale,i as TypographyScale,f as ZIndexLayers,p as __namedExportsOrder,n as default};