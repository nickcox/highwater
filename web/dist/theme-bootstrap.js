(()=>{const config={"ids":["dark","light"],"key":"highwater.theme.v1"};const parse=function parseThemePreference(raw, ids) {
	if (!raw || raw.length > 256) return "system";
	try {
		const value = JSON.parse(raw);
		return typeof value === "string" && (value === "system" || ids.includes(value)) ? value : "system";
	} catch {
		return "system";
	}
};let raw=null;let dark=true;try{raw=window.localStorage.getItem(config.key)}catch{}try{dark=window.matchMedia('(prefers-color-scheme: dark)').matches}catch{}const preference=parse(raw,config.ids);document.documentElement.dataset.theme=preference==='system'?(dark?'dark':'light'):preference})()