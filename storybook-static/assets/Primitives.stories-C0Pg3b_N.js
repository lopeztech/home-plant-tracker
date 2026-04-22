import{r as e,t}from"./chunk-DHx0Hwia.js";import{t as n}from"./react-xCQysqH5.js";import{t as r}from"./jsx-runtime-Ds6D5m35.js";import{a as i,i as a,o,r as s,t as c}from"./Button-B9loAoSP.js";import{n as l,t as u}from"./Alert-Dj4vUHtc.js";var d=e(o()),f=e(n()),p=r(),m=f.forwardRef(({bsPrefix:e,bg:t=`primary`,pill:n=!1,text:r,className:a,as:o=`span`,...s},c)=>{let l=i(e,`badge`);return(0,p.jsx)(o,{ref:c,...s,className:(0,d.default)(a,l,n&&`rounded-pill`,r&&`text-${r}`,t&&`bg-${t}`)})});m.displayName=`Badge`;function h(e,t){return f.Children.toArray(e).some(e=>f.isValidElement(e)&&e.type===t)}function g({as:e,bsPrefix:t,className:n,...r}){t=i(t,`col`);let o=s(),c=a(),l=[],u=[];return o.forEach(e=>{let n=r[e];delete r[e];let i,a,o;typeof n==`object`&&n?{span:i,offset:a,order:o}=n:i=n;let s=e===c?``:`-${e}`;i&&l.push(i===!0?`${t}${s}`:`${t}${s}-${i}`),o!=null&&u.push(`order${s}-${o}`),a!=null&&u.push(`offset${s}-${a}`)}),[{...r,className:(0,d.default)(n,...l,...u)},{as:e,bsPrefix:t,spans:l}]}var _=f.forwardRef((e,t)=>{let[{className:n,...r},{as:i=`div`,bsPrefix:a,spans:o}]=g(e);return(0,p.jsx)(i,{...r,ref:t,className:(0,d.default)(n,!o.length&&a)})});_.displayName=`Col`;var v=t(((e,t)=>{var n=!1,r=function(){};if(n){var i=function(e,t){var n=arguments.length;t=Array(n>1?n-1:0);for(var r=1;r<n;r++)t[r-1]=arguments[r];var i=0,a=`Warning: `+e.replace(/%s/g,function(){return t[i++]});typeof console<`u`&&console.error(a);try{throw Error(a)}catch{}};r=function(e,t,n){var r=arguments.length;n=Array(r>2?r-2:0);for(var a=2;a<r;a++)n[a-2]=arguments[a];if(t===void 0)throw Error("`warning(condition, format, ...args)` requires a warning message argument");e||i.apply(null,[t].concat(n))}}t.exports=r})),y=f.createContext(null);y.displayName=`InputGroupContext`;var b=e(l()),x={type:b.default.string,tooltip:b.default.bool,as:b.default.elementType},S=f.forwardRef(({as:e=`div`,className:t,type:n=`valid`,tooltip:r=!1,...i},a)=>(0,p.jsx)(e,{...i,ref:a,className:(0,d.default)(t,`${n}-${r?`tooltip`:`feedback`}`)}));S.displayName=`Feedback`,S.propTypes=x;var C=f.createContext({}),w=f.forwardRef(({id:e,bsPrefix:t,className:n,type:r=`checkbox`,isValid:a=!1,isInvalid:o=!1,as:s=`input`,...c},l)=>{let{controlId:u}=(0,f.useContext)(C);return t=i(t,`form-check-input`),(0,p.jsx)(s,{...c,ref:l,type:r,id:e||u,className:(0,d.default)(n,t,a&&`is-valid`,o&&`is-invalid`)})});w.displayName=`FormCheckInput`;var T=f.forwardRef(({bsPrefix:e,className:t,htmlFor:n,...r},a)=>{let{controlId:o}=(0,f.useContext)(C);return e=i(e,`form-check-label`),(0,p.jsx)(`label`,{...r,ref:a,htmlFor:n||o,className:(0,d.default)(t,e)})});T.displayName=`FormCheckLabel`;var E=f.forwardRef(({id:e,bsPrefix:t,bsSwitchPrefix:n,inline:r=!1,reverse:a=!1,disabled:o=!1,isValid:s=!1,isInvalid:c=!1,feedbackTooltip:l=!1,feedback:u,feedbackType:m,className:g,style:_,title:v=``,type:y=`checkbox`,label:b,children:x,as:E=`input`,...D},O)=>{t=i(t,`form-check`),n=i(n,`form-switch`);let{controlId:k}=(0,f.useContext)(C),A=(0,f.useMemo)(()=>({controlId:e||k}),[k,e]),j=!x&&b!=null&&b!==!1||h(x,T),M=(0,p.jsx)(w,{...D,type:y===`switch`?`checkbox`:y,ref:O,isValid:s,isInvalid:c,disabled:o,as:E});return(0,p.jsx)(C.Provider,{value:A,children:(0,p.jsx)(`div`,{style:_,className:(0,d.default)(g,j&&t,r&&`${t}-inline`,a&&`${t}-reverse`,y===`switch`&&n),children:x||(0,p.jsxs)(p.Fragment,{children:[M,j&&(0,p.jsx)(T,{title:v,children:b}),u&&(0,p.jsx)(S,{type:m,tooltip:l,children:u})]})})})});E.displayName=`FormCheck`;var D=Object.assign(E,{Input:w,Label:T});v();var O=f.forwardRef(({bsPrefix:e,type:t,size:n,htmlSize:r,id:a,className:o,isValid:s=!1,isInvalid:c=!1,plaintext:l,readOnly:u,as:m=`input`,...h},g)=>{let{controlId:_}=(0,f.useContext)(C);return e=i(e,`form-control`),(0,p.jsx)(m,{...h,type:t,size:r,ref:g,readOnly:u,id:a||_,className:(0,d.default)(o,l?`${e}-plaintext`:e,n&&`${e}-${n}`,t===`color`&&`${e}-color`,s&&`is-valid`,c&&`is-invalid`)})});O.displayName=`FormControl`;var k=Object.assign(O,{Feedback:S}),A=f.forwardRef(({className:e,bsPrefix:t,as:n=`div`,...r},a)=>(t=i(t,`form-floating`),(0,p.jsx)(n,{ref:a,className:(0,d.default)(e,t),...r})));A.displayName=`FormFloating`;var j=f.forwardRef(({controlId:e,as:t=`div`,...n},r)=>{let i=(0,f.useMemo)(()=>({controlId:e}),[e]);return(0,p.jsx)(C.Provider,{value:i,children:(0,p.jsx)(t,{...n,ref:r})})});j.displayName=`FormGroup`;var M=f.forwardRef(({as:e=`label`,bsPrefix:t,column:n=!1,visuallyHidden:r=!1,className:a,htmlFor:o,...s},c)=>{let{controlId:l}=(0,f.useContext)(C);t=i(t,`form-label`);let u=`col-form-label`;typeof n==`string`&&(u=`${u} ${u}-${n}`);let m=(0,d.default)(a,t,r&&`visually-hidden`,n&&u);return o||=l,n?(0,p.jsx)(_,{ref:c,as:`label`,className:m,htmlFor:o,...s}):(0,p.jsx)(e,{ref:c,className:m,htmlFor:o,...s})});M.displayName=`FormLabel`;var N=f.forwardRef(({bsPrefix:e,className:t,id:n,...r},a)=>{let{controlId:o}=(0,f.useContext)(C);return e=i(e,`form-range`),(0,p.jsx)(`input`,{...r,type:`range`,ref:a,className:(0,d.default)(t,e),id:n||o})});N.displayName=`FormRange`;var P=f.forwardRef(({bsPrefix:e,size:t,htmlSize:n,className:r,isValid:a=!1,isInvalid:o=!1,id:s,...c},l)=>{let{controlId:u}=(0,f.useContext)(C);return e=i(e,`form-select`),(0,p.jsx)(`select`,{...c,size:n,ref:l,className:(0,d.default)(r,e,t&&`${e}-${t}`,a&&`is-valid`,o&&`is-invalid`),id:s||u})});P.displayName=`FormSelect`;var F=f.forwardRef(({bsPrefix:e,className:t,as:n=`small`,muted:r,...a},o)=>(e=i(e,`form-text`),(0,p.jsx)(n,{...a,ref:o,className:(0,d.default)(t,e,r&&`text-muted`)})));F.displayName=`FormText`;var I=f.forwardRef((e,t)=>(0,p.jsx)(D,{...e,ref:t,type:`switch`}));I.displayName=`Switch`;var L=Object.assign(I,{Input:D.Input,Label:D.Label}),R=f.forwardRef(({bsPrefix:e,className:t,children:n,controlId:r,label:a,...o},s)=>(e=i(e,`form-floating`),(0,p.jsxs)(j,{ref:s,className:(0,d.default)(t,e),controlId:r,...o,children:[n,(0,p.jsx)(`label`,{htmlFor:r,children:a})]})));R.displayName=`FloatingLabel`;var z={_ref:b.default.any,validated:b.default.bool,as:b.default.elementType},B=f.forwardRef(({className:e,validated:t,as:n=`form`,...r},i)=>(0,p.jsx)(n,{...r,ref:i,className:(0,d.default)(e,t&&`was-validated`)}));B.displayName=`Form`,B.propTypes=z;var V=Object.assign(B,{Group:j,Control:k,Floating:A,Check:D,Switch:L,Label:M,Text:F,Range:N,Select:P,FloatingLabel:R}),H=f.forwardRef(({className:e,bsPrefix:t,as:n=`span`,...r},a)=>(t=i(t,`input-group-text`),(0,p.jsx)(n,{ref:a,className:(0,d.default)(e,t),...r})));H.displayName=`InputGroupText`;var U=e=>(0,p.jsx)(H,{children:(0,p.jsx)(w,{type:`checkbox`,...e})}),W=e=>(0,p.jsx)(H,{children:(0,p.jsx)(w,{type:`radio`,...e})}),G=f.forwardRef(({bsPrefix:e,size:t,hasValidation:n,className:r,as:a=`div`,...o},s)=>{e=i(e,`input-group`);let c=(0,f.useMemo)(()=>({}),[]);return(0,p.jsx)(y.Provider,{value:c,children:(0,p.jsx)(a,{ref:s,...o,className:(0,d.default)(r,e,t&&`${e}-${t}`,n&&`has-validation`)})})});G.displayName=`InputGroup`;var K=Object.assign(G,{Text:H,Radio:W,Checkbox:U}),q={title:`Primitives/Bootstrap Components`,tags:[`autodocs`],parameters:{layout:`padded`,docs:{description:{component:`Bootstrap 5.3 + React-Bootstrap primitives in this app's theme context. Use these as the source of truth for variant, size, and state combinations.`}}}},J={render:()=>(0,p.jsxs)(`div`,{children:[(0,p.jsx)(`h6`,{className:`tx-title mb-3`,children:`Button variants`}),(0,p.jsx)(`div`,{className:`d-flex flex-wrap gap-2 mb-4`,children:[`primary`,`secondary`,`success`,`danger`,`warning`,`info`,`light`,`dark`,`link`].map(e=>(0,p.jsx)(c,{variant:e,children:e},e))}),(0,p.jsx)(`h6`,{className:`tx-title mb-3`,children:`Outline variants`}),(0,p.jsx)(`div`,{className:`d-flex flex-wrap gap-2 mb-4`,children:[`primary`,`secondary`,`success`,`danger`,`warning`,`info`].map(e=>(0,p.jsx)(c,{variant:`outline-${e}`,children:e},e))}),(0,p.jsx)(`h6`,{className:`tx-title mb-3`,children:`Sizes`}),(0,p.jsxs)(`div`,{className:`d-flex align-items-center gap-3 mb-4`,children:[(0,p.jsx)(c,{variant:`primary`,size:`lg`,children:`Large`}),(0,p.jsx)(c,{variant:`primary`,children:`Default`}),(0,p.jsx)(c,{variant:`primary`,size:`sm`,children:`Small`}),(0,p.jsx)(c,{variant:`primary`,disabled:!0,children:`Disabled`})]}),(0,p.jsx)(`h6`,{className:`tx-title mb-3`,children:`Icon buttons`}),(0,p.jsx)(`div`,{className:`d-flex gap-2`,children:[{label:`Add plant`,icon:`plus`,variant:`primary`},{label:`Edit`,icon:`edit-2`,variant:`outline-secondary`},{label:`Delete`,icon:`trash-2`,variant:`outline-danger`},{label:`Water`,icon:`droplet`,variant:`outline-info`},{label:`Upload`,icon:`upload`,variant:`outline-secondary`}].map(({label:e,icon:t,variant:n})=>(0,p.jsxs)(c,{variant:n,size:`sm`,children:[(0,p.jsx)(`svg`,{className:`sa-icon me-1`,style:{width:14,height:14},"aria-hidden":`true`,children:(0,p.jsx)(`use`,{href:`/icons/sprite.svg#${t}`})}),e]},e))})]})},Y={render:()=>(0,p.jsxs)(`div`,{children:[(0,p.jsx)(`h6`,{className:`tx-title mb-3`,children:`Health status badges`}),(0,p.jsx)(`div`,{className:`d-flex gap-2 mb-4`,children:[{label:`Excellent`,bg:`success`},{label:`Good`,bg:`success`},{label:`Fair`,bg:`warning`},{label:`Poor`,bg:`danger`},{label:`Critical`,bg:`danger`}].map(({label:e,bg:t})=>(0,p.jsx)(m,{bg:t,children:e},e))}),(0,p.jsx)(`h6`,{className:`tx-title mb-3`,children:`Count / pill badges`}),(0,p.jsx)(`div`,{className:`d-flex gap-2 mb-4`,children:[`primary`,`secondary`,`success`,`danger`,`warning`,`info`].map(e=>(0,p.jsx)(m,{bg:e,pill:!0,children:Math.floor(Math.random()*20)+1},e))}),(0,p.jsx)(`h6`,{className:`tx-title mb-3`,children:`Status pills (custom)`}),(0,p.jsxs)(`div`,{className:`d-flex gap-2`,children:[(0,p.jsx)(`span`,{className:`status-pill bg-danger bg-opacity-10 text-danger`,children:`3 overdue`}),(0,p.jsx)(`span`,{className:`status-pill bg-warning bg-opacity-10 text-warning`,children:`2 today`}),(0,p.jsx)(`span`,{className:`status-pill bg-success bg-opacity-10 text-success`,children:`12 good`})]})]})},X={name:`Card / Panel Pattern`,render:()=>(0,p.jsx)(`div`,{style:{maxWidth:440},children:(0,p.jsxs)(`div`,{className:`panel panel-icon`,children:[(0,p.jsxs)(`div`,{className:`panel-hdr d-flex justify-content-between align-items-center`,children:[(0,p.jsx)(`span`,{children:`Panel Header`}),(0,p.jsx)(`div`,{className:`panel-toolbar`,children:(0,p.jsxs)(c,{variant:`primary`,size:`sm`,children:[(0,p.jsx)(`svg`,{className:`sa-icon me-1`,style:{width:14,height:14},children:(0,p.jsx)(`use`,{href:`/icons/sprite.svg#plus`})}),`Action`]})})]}),(0,p.jsx)(`div`,{className:`panel-container`,children:(0,p.jsx)(`div`,{className:`panel-content`,children:(0,p.jsxs)(`p`,{className:`tx-body mb-0`,children:[`This is the standard `,(0,p.jsx)(`code`,{children:`.panel`}),` pattern from Smart Admin. Use`,` `,(0,p.jsx)(`code`,{children:`.panel-hdr`}),` for the header row and`,` `,(0,p.jsx)(`code`,{children:`.panel-content`}),` for the body.`]})})})]})})},Z={name:`Form Controls`,render:()=>(0,p.jsx)(`div`,{style:{maxWidth:480},children:(0,p.jsxs)(V,{children:[(0,p.jsxs)(V.Group,{className:`mb-3`,children:[(0,p.jsx)(V.Label,{children:`Text input`}),(0,p.jsx)(V.Control,{type:`text`,placeholder:`Enter plant name…`})]}),(0,p.jsxs)(V.Group,{className:`mb-3`,children:[(0,p.jsx)(V.Label,{children:`Select`}),(0,p.jsxs)(V.Select,{children:[(0,p.jsx)(`option`,{children:`Ground`}),(0,p.jsx)(`option`,{children:`Garden bed`}),(0,p.jsx)(`option`,{children:`Pot`})]})]}),(0,p.jsxs)(V.Group,{className:`mb-3`,children:[(0,p.jsx)(V.Label,{children:`Textarea`}),(0,p.jsx)(V.Control,{as:`textarea`,rows:3,placeholder:`Care notes…`})]}),(0,p.jsxs)(V.Group,{className:`mb-3`,children:[(0,p.jsx)(V.Check,{type:`checkbox`,label:`Mark as outdoor plant`}),(0,p.jsx)(V.Check,{type:`radio`,name:`health`,label:`Excellent`}),(0,p.jsx)(V.Check,{type:`radio`,name:`health`,label:`Good`}),(0,p.jsx)(V.Check,{type:`radio`,name:`health`,label:`Fair`})]}),(0,p.jsxs)(V.Group,{className:`mb-3`,children:[(0,p.jsx)(V.Label,{children:`Search with icon`}),(0,p.jsxs)(K,{children:[(0,p.jsx)(K.Text,{children:(0,p.jsx)(`svg`,{className:`sa-icon`,style:{width:14,height:14},children:(0,p.jsx)(`use`,{href:`/icons/sprite.svg#search`})})}),(0,p.jsx)(V.Control,{placeholder:`Search plants…`})]})]}),(0,p.jsxs)(V.Group,{className:`mb-3`,children:[(0,p.jsx)(V.Label,{children:`Disabled`}),(0,p.jsx)(V.Control,{type:`text`,placeholder:`Disabled`,disabled:!0})]}),(0,p.jsxs)(V.Group,{className:`mb-3`,children:[(0,p.jsx)(V.Label,{children:`Invalid`}),(0,p.jsx)(V.Control,{type:`text`,isInvalid:!0}),(0,p.jsx)(V.Control.Feedback,{type:`invalid`,children:`This field is required.`})]})]})})},Q={render:()=>(0,p.jsx)(`div`,{style:{maxWidth:520},children:[`primary`,`success`,`warning`,`danger`,`info`].map(e=>(0,p.jsxs)(u,{variant:e,className:`d-flex align-items-center gap-2`,children:[(0,p.jsx)(`svg`,{className:`sa-icon`,style:{width:16,height:16},"aria-hidden":`true`,children:(0,p.jsx)(`use`,{href:`/icons/sprite.svg#${e===`success`?`check-circle`:e===`danger`?`alert-circle`:e===`warning`?`alert-triangle`:`info`}`})}),(0,p.jsxs)(`span`,{children:[e.charAt(0).toUpperCase()+e.slice(1),` alert — contextual feedback.`]})]},e))})};J.parameters={...J.parameters,docs:{...J.parameters?.docs,source:{originalSource:`{
  render: () => <div>
      <h6 className="tx-title mb-3">Button variants</h6>
      <div className="d-flex flex-wrap gap-2 mb-4">
        {['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark', 'link'].map(v => <Button key={v} variant={v}>{v}</Button>)}
      </div>

      <h6 className="tx-title mb-3">Outline variants</h6>
      <div className="d-flex flex-wrap gap-2 mb-4">
        {['primary', 'secondary', 'success', 'danger', 'warning', 'info'].map(v => <Button key={v} variant={\`outline-\${v}\`}>{v}</Button>)}
      </div>

      <h6 className="tx-title mb-3">Sizes</h6>
      <div className="d-flex align-items-center gap-3 mb-4">
        <Button variant="primary" size="lg">Large</Button>
        <Button variant="primary">Default</Button>
        <Button variant="primary" size="sm">Small</Button>
        <Button variant="primary" disabled>Disabled</Button>
      </div>

      <h6 className="tx-title mb-3">Icon buttons</h6>
      <div className="d-flex gap-2">
        {[{
        label: 'Add plant',
        icon: 'plus',
        variant: 'primary'
      }, {
        label: 'Edit',
        icon: 'edit-2',
        variant: 'outline-secondary'
      }, {
        label: 'Delete',
        icon: 'trash-2',
        variant: 'outline-danger'
      }, {
        label: 'Water',
        icon: 'droplet',
        variant: 'outline-info'
      }, {
        label: 'Upload',
        icon: 'upload',
        variant: 'outline-secondary'
      }].map(({
        label,
        icon,
        variant
      }) => <Button key={label} variant={variant} size="sm">
            <svg className="sa-icon me-1" style={{
          width: 14,
          height: 14
        }} aria-hidden="true">
              <use href={\`/icons/sprite.svg#\${icon}\`} />
            </svg>
            {label}
          </Button>)}
      </div>
    </div>
}`,...J.parameters?.docs?.source}}},Y.parameters={...Y.parameters,docs:{...Y.parameters?.docs,source:{originalSource:`{
  render: () => <div>
      <h6 className="tx-title mb-3">Health status badges</h6>
      <div className="d-flex gap-2 mb-4">
        {[{
        label: 'Excellent',
        bg: 'success'
      }, {
        label: 'Good',
        bg: 'success'
      }, {
        label: 'Fair',
        bg: 'warning'
      }, {
        label: 'Poor',
        bg: 'danger'
      }, {
        label: 'Critical',
        bg: 'danger'
      }].map(({
        label,
        bg
      }) => <Badge key={label} bg={bg}>{label}</Badge>)}
      </div>

      <h6 className="tx-title mb-3">Count / pill badges</h6>
      <div className="d-flex gap-2 mb-4">
        {['primary', 'secondary', 'success', 'danger', 'warning', 'info'].map(v => <Badge key={v} bg={v} pill>
            {Math.floor(Math.random() * 20) + 1}
          </Badge>)}
      </div>

      <h6 className="tx-title mb-3">Status pills (custom)</h6>
      <div className="d-flex gap-2">
        <span className="status-pill bg-danger bg-opacity-10 text-danger">3 overdue</span>
        <span className="status-pill bg-warning bg-opacity-10 text-warning">2 today</span>
        <span className="status-pill bg-success bg-opacity-10 text-success">12 good</span>
      </div>
    </div>
}`,...Y.parameters?.docs?.source}}},X.parameters={...X.parameters,docs:{...X.parameters?.docs,source:{originalSource:`{
  name: 'Card / Panel Pattern',
  render: () => <div style={{
    maxWidth: 440
  }}>
      <div className="panel panel-icon">
        <div className="panel-hdr d-flex justify-content-between align-items-center">
          <span>Panel Header</span>
          <div className="panel-toolbar">
            <Button variant="primary" size="sm">
              <svg className="sa-icon me-1" style={{
              width: 14,
              height: 14
            }}><use href="/icons/sprite.svg#plus" /></svg>
              Action
            </Button>
          </div>
        </div>
        <div className="panel-container">
          <div className="panel-content">
            <p className="tx-body mb-0">
              This is the standard <code>.panel</code> pattern from Smart Admin. Use{' '}
              <code>.panel-hdr</code> for the header row and{' '}
              <code>.panel-content</code> for the body.
            </p>
          </div>
        </div>
      </div>
    </div>
}`,...X.parameters?.docs?.source}}},Z.parameters={...Z.parameters,docs:{...Z.parameters?.docs,source:{originalSource:`{
  name: 'Form Controls',
  render: () => <div style={{
    maxWidth: 480
  }}>
      <Form>
        <Form.Group className="mb-3">
          <Form.Label>Text input</Form.Label>
          <Form.Control type="text" placeholder="Enter plant name…" />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Select</Form.Label>
          <Form.Select>
            <option>Ground</option>
            <option>Garden bed</option>
            <option>Pot</option>
          </Form.Select>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Textarea</Form.Label>
          <Form.Control as="textarea" rows={3} placeholder="Care notes…" />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Check type="checkbox" label="Mark as outdoor plant" />
          <Form.Check type="radio" name="health" label="Excellent" />
          <Form.Check type="radio" name="health" label="Good" />
          <Form.Check type="radio" name="health" label="Fair" />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Search with icon</Form.Label>
          <InputGroup>
            <InputGroup.Text>
              <svg className="sa-icon" style={{
              width: 14,
              height: 14
            }}><use href="/icons/sprite.svg#search" /></svg>
            </InputGroup.Text>
            <Form.Control placeholder="Search plants…" />
          </InputGroup>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Disabled</Form.Label>
          <Form.Control type="text" placeholder="Disabled" disabled />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Invalid</Form.Label>
          <Form.Control type="text" isInvalid />
          <Form.Control.Feedback type="invalid">
            This field is required.
          </Form.Control.Feedback>
        </Form.Group>
      </Form>
    </div>
}`,...Z.parameters?.docs?.source}}},Q.parameters={...Q.parameters,docs:{...Q.parameters?.docs,source:{originalSource:`{
  render: () => <div style={{
    maxWidth: 520
  }}>
      {['primary', 'success', 'warning', 'danger', 'info'].map(v => <Alert key={v} variant={v} className="d-flex align-items-center gap-2">
          <svg className="sa-icon" style={{
        width: 16,
        height: 16
      }} aria-hidden="true">
            <use href={\`/icons/sprite.svg#\${v === 'success' ? 'check-circle' : v === 'danger' ? 'alert-circle' : v === 'warning' ? 'alert-triangle' : 'info'}\`} />
          </svg>
          <span>{v.charAt(0).toUpperCase() + v.slice(1)} alert — contextual feedback.</span>
        </Alert>)}
    </div>
}`,...Q.parameters?.docs?.source}}};var $=[`Buttons`,`Badges`,`PanelPattern`,`FormControls`,`Alerts`];export{Q as Alerts,Y as Badges,J as Buttons,Z as FormControls,X as PanelPattern,$ as __namedExportsOrder,q as default};