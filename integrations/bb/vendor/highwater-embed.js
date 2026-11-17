//#region node_modules/svelte/src/internal/shared/utils.js
var e = Array.isArray, t = Array.prototype.indexOf, n = Array.prototype.includes, r = Array.from, i = Object.defineProperty, a = Object.getOwnPropertyDescriptor, o = Object.getOwnPropertyDescriptors, s = Object.prototype, c = Array.prototype, l = Object.getPrototypeOf, u = Object.isExtensible, d = () => {};
function f(e) {
	for (var t = 0; t < e.length; t++) e[t]();
}
function p() {
	var e, t;
	return {
		promise: new Promise((n, r) => {
			e = n, t = r;
		}),
		resolve: e,
		reject: t
	};
}
function m(e, t) {
	if (Array.isArray(e)) return e;
	if (t === void 0 || !(Symbol.iterator in e)) return Array.from(e);
	let n = [];
	for (let r of e) if (n.push(r), n.length === t) break;
	return n;
}
var h = 1024, g = 2048, _ = 4096, v = 8192, y = 16384, b = 32768, x = 1 << 25, S = 65536, C = 1 << 19, w = 1 << 20, ee = 1 << 25, T = 65536, E = 1 << 21, te = 1 << 22, D = 1 << 23, O = Symbol("$state"), k = Symbol("component"), ne = Symbol("legacy props"), re = Symbol(""), ie = Symbol("attributes"), ae = Symbol("class"), oe = Symbol("style"), se = Symbol("text"), ce = Symbol("form reset"), le = new class extends Error {
	name = "StaleReactionError";
	message = "The reaction that called `getAbortSignal()` was re-run or destroyed";
}(), ue = !!globalThis.document?.contentType && /* @__PURE__ */ globalThis.document.contentType.includes("xml"), de = {}, fe = Symbol("uninitialized"), pe = "http://www.w3.org/1999/xhtml";
function me() {
	console.warn("https://svelte.dev/e/derived_inert");
}
function he(e) {
	console.warn("https://svelte.dev/e/hydration_mismatch");
}
function ge() {
	console.warn("https://svelte.dev/e/select_multiple_invalid_value");
}
function _e() {
	console.warn("https://svelte.dev/e/svelte_boundary_reset_noop");
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/hydration.js
var A = !1;
function ve(e) {
	A = e;
}
var j;
function ye(e) {
	if (e === null) throw he(), de;
	return j = e;
}
function be() {
	return ye(/* @__PURE__ */ dn(j));
}
function M(e) {
	if (A) {
		if (/* @__PURE__ */ dn(j) !== null) throw he(), de;
		j = e;
	}
}
function xe(e = 1) {
	if (A) {
		for (var t = e, n = j; t--;) n = /* @__PURE__ */ dn(n);
		j = n;
	}
}
function Se(e = !0) {
	for (var t = 0, n = j;;) {
		if (n.nodeType === 8) {
			var r = n.data;
			if (r === "]") {
				if (t === 0) return n;
				--t;
			} else (r === "[" || r === "[!" || r[0] === "[" && !isNaN(Number(r.slice(1)))) && (t += 1);
		}
		var i = /* @__PURE__ */ dn(n);
		e && n.remove(), n = i;
	}
}
function Ce(e) {
	if (!e || e.nodeType !== 8) throw he(), de;
	return e.data;
}
//#endregion
//#region node_modules/svelte/src/internal/client/reactivity/equality.js
function we(e) {
	return e === this.v;
}
function Te(e, t) {
	return e == e ? e !== t || typeof e == "object" && !!e || typeof e == "function" : t == t;
}
function Ee(e) {
	return !Te(e, this.v);
}
function De(e) {
	throw Error("https://svelte.dev/e/lifecycle_outside_component");
}
//#endregion
//#region node_modules/svelte/src/internal/client/errors.js
function Oe() {
	throw Error("https://svelte.dev/e/async_derived_orphan");
}
function ke(e, t, n) {
	throw Error("https://svelte.dev/e/each_key_duplicate");
}
function Ae(e) {
	throw Error("https://svelte.dev/e/effect_in_teardown");
}
function je() {
	throw Error("https://svelte.dev/e/effect_in_unowned_derived");
}
function Me(e) {
	throw Error("https://svelte.dev/e/effect_orphan");
}
function Ne() {
	throw Error("https://svelte.dev/e/effect_update_depth_exceeded");
}
function Pe(e) {
	throw Error("https://svelte.dev/e/props_invalid_value");
}
function Fe() {
	throw Error("https://svelte.dev/e/state_descriptors_fixed");
}
function N() {
	throw Error("https://svelte.dev/e/state_prototype_fixed");
}
function Ie() {
	throw Error("https://svelte.dev/e/state_unsafe_mutation");
}
function Le() {
	throw Error("https://svelte.dev/e/svelte_boundary_reset_onerror");
}
//#endregion
//#region node_modules/svelte/src/internal/client/context.js
var Re = null;
function ze(e) {
	Re = e;
}
function Be(e, t = !1, n) {
	Re = {
		p: Re,
		i: !1,
		c: null,
		e: null,
		s: e,
		x: null,
		r: Xn,
		l: null
	};
}
function Ve(e) {
	var t = Re, n = t.e;
	if (n !== null) {
		t.e = null;
		for (var r of n) wn(r);
	}
	return e !== void 0 && (t.x = e), t.i = !0, Re = t.p, He(e);
}
function He(e = {}) {
	return i(e, k, { value: !0 }), e;
}
function Ue() {
	return !0;
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/task.js
var We = [];
function Ge() {
	var e = We;
	We = [], f(e);
}
function Ke(e) {
	if (We.length === 0 && !jt) {
		var t = We;
		queueMicrotask(() => {
			t === We && Ge();
		});
	}
	We.push(e);
}
function qe() {
	for (; We.length > 0;) Ge();
}
//#endregion
//#region node_modules/svelte/src/internal/client/reactivity/status.js
var Je = ~(g | _ | h);
function Ye(e, t) {
	e.f = e.f & Je | t;
}
function Xe(e) {
	e.f & 512 || e.deps === null ? Ye(e, h) : Ye(e, _);
}
//#endregion
//#region node_modules/svelte/src/internal/client/reactivity/utils.js
function Ze(e) {
	if (e !== null) for (let t of e) t.f & 2 && t.f & 65536 && (t.f ^= T, Ze(t.deps));
}
function Qe(e, t, n) {
	e.f & 2048 ? t.add(e) : e.f & 4096 && n.add(e), Ze(e.deps), Ye(e, h);
}
//#endregion
//#region node_modules/svelte/src/store/utils.js
function $e(e, t, n) {
	if (e == null) return t(void 0), n && n(void 0), d;
	let r = yr(() => e.subscribe(t, n));
	return r.unsubscribe ? () => r.unsubscribe() : r;
}
//#endregion
//#region node_modules/svelte/src/store/shared/index.js
var et = [];
function tt(e, t = d) {
	let n = null, r = /* @__PURE__ */ new Set();
	function i(t) {
		if (Te(e, t) && (e = t, n)) {
			let t = !et.length;
			for (let t of r) t[1](), et.push(t, e);
			if (t) {
				for (let e = 0; e < et.length; e += 2) et[e][0](et[e + 1]);
				et.length = 0;
			}
		}
	}
	function a(t) {
		i(t(e));
	}
	function o(o, s = d) {
		let c = [o, s];
		return r.add(c), r.size === 1 && (n = t(i, a) || d), o(e), () => {
			r.delete(c), r.size === 0 && n && (n(), n = null);
		};
	}
	return {
		set: i,
		update: a,
		subscribe: o
	};
}
function nt(e) {
	return { subscribe: e.subscribe.bind(e) };
}
function rt(e) {
	let t;
	return $e(e, (e) => t = e)(), t;
}
//#endregion
//#region node_modules/svelte/src/internal/client/reactivity/store.js
var it = !1, at = Symbol("unmounted");
function ot(e, t, n) {
	let r = n[t] ??= {
		store: null,
		source: /* @__PURE__ */ Yt(void 0),
		unsubscribe: d
	};
	if (r.store !== e && !(at in n)) {
		if (r.unsubscribe(), r.store = e ?? null, e == null) r.source.v = void 0, r.unsubscribe = d;
		else {
			var i = !0;
			r.unsubscribe = $e(e, (e) => {
				i ? r.source.v = e : I(r.source, e);
			}), i = !1;
		}
	}
	return e && at in n ? rt(e) : H(r.source);
}
function st() {
	let e = {};
	function t() {
		Sn(() => {
			for (var t in e) e[t].unsubscribe();
			i(e, at, {
				enumerable: !1,
				value: !0
			});
		});
	}
	return [e, t];
}
function ct(e) {
	var t = it;
	try {
		return it = !1, [e(), it];
	} finally {
		it = t;
	}
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/elements/misc.js
var lt = !1;
function ut() {
	lt || (lt = !0, document.addEventListener("reset", (e) => {
		Promise.resolve().then(() => {
			if (!e.defaultPrevented) for (let t of e.target.elements) t[ce]?.();
		});
	}, { capture: !0 }));
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/elements/bindings/shared.js
function dt(e) {
	var t = qn, n = Xn;
	Yn(null), Zn(null);
	try {
		return e();
	} finally {
		Yn(t), Zn(n);
	}
}
function ft(e, t, n, r = n) {
	e.addEventListener(t, () => dt(n));
	let i = e[ce];
	e[ce] = i ? () => {
		i(), r(!0);
	} : () => r(!0), ut();
}
//#endregion
//#region node_modules/svelte/src/internal/client/reactivity/async.js
function pt(e, t, n, r) {
	let i = Ue() ? _t : bt;
	var a = e.filter((e) => !e.settled), o = t.map(i);
	if (n.length === 0 && a.length === 0) {
		r(o);
		return;
	}
	var s = Xn, c = mt(), l = a.length === 1 ? a[0].promise : a.length > 1 ? Promise.all(a.map((e) => e.promise)) : null;
	function u(e) {
		if (!(s.f & 16384)) {
			c();
			try {
				r([...o, ...e]);
			} catch (e) {
				_n(e, s);
			}
			ht();
		}
	}
	var d = gt();
	if (n.length === 0) {
		l.then(() => u([])).finally(d);
		return;
	}
	function f() {
		Promise.all(n.map((e) => /* @__PURE__ */ yt(e))).then(u).catch((e) => _n(e, s)).finally(d);
	}
	l ? l.then(() => {
		c(), f(), ht();
	}) : f();
}
function mt() {
	var e = Xn, t = qn, n = Re, r = Dt;
	return function(i = !0) {
		Zn(e), Yn(t), ze(n), i && !(e.f & 16384) && (r?.activate(), r?.apply());
	};
}
function ht(e = !0) {
	Zn(null), Yn(null), ze(null), e && Dt?.deactivate();
}
function gt() {
	var e = Xn, t = e.b, n = Dt, r = !!t?.is_rendered();
	return t?.update_pending_count(1, n), n.increment(r, e), () => {
		t?.update_pending_count(-1, n), n.decrement(r, e);
	};
}
/*#__NO_SIDE_EFFECTS__*/
function _t(e) {
	var t = 2 | g;
	return Xn !== null && (Xn.f |= C), {
		ctx: Re,
		deps: null,
		effects: null,
		equals: we,
		f: t,
		fn: e,
		reactions: null,
		rv: 0,
		v: fe,
		wv: 0,
		parent: Xn,
		ac: null
	};
}
var vt = Symbol("obsolete");
/*#__NO_SIDE_EFFECTS__*/
function yt(e, t, n) {
	let r = Xn;
	r === null && Oe();
	var i = void 0, a = Jt(fe), o = !qn, s = /* @__PURE__ */ new Set();
	return On(() => {
		var t = Xn, n = p();
		i = n.promise;
		try {
			Promise.resolve(e()).then(n.resolve, (e) => {
				e !== le && n.reject(e);
			}).finally(ht);
		} catch (e) {
			n.reject(e), ht();
		}
		var c = Dt;
		if (o) {
			if (t.f & 32768) var l = gt();
			if (r.b?.is_rendered()) c.async_deriveds.get(t)?.reject(vt);
			else for (let e of s.values()) e.reject(vt);
			s.add(n), c.async_deriveds.set(t, n);
		}
		let u = (e, t = void 0) => {
			l?.(), s.delete(n), t !== vt && (c.activate(), t ? (a.f |= D, Xt(a, t)) : (a.f & 8388608 && (a.f ^= D), Xt(a, e)), c.deactivate());
		};
		n.promise.then(u, (e) => u(null, e || "unknown"));
	}), Sn(() => {
		for (let e of s) e.reject(vt);
	}), new Promise((e) => {
		function t(n) {
			function r() {
				n === i ? e(a) : t(i);
			}
			n.then(r, r);
		}
		t(i);
	});
}
/*#__NO_SIDE_EFFECTS__*/
function P(e) {
	let t = /* @__PURE__ */ _t(e);
	return $n(t), t;
}
/*#__NO_SIDE_EFFECTS__*/
function bt(e) {
	let t = /* @__PURE__ */ _t(e);
	return t.equals = Ee, t;
}
function xt(e) {
	var t = e.effects;
	if (t !== null) {
		e.effects = null;
		for (var n = 0; n < t.length; n += 1) Fn(t[n]);
	}
}
function St(e) {
	var t, n = Xn, r = e.parent;
	if (!Gn && r !== null && e.v !== fe && r.f & 24576) return me(), e.v;
	Zn(r);
	try {
		e.f &= ~T, xt(e), t = dr(e);
	} finally {
		Zn(n);
	}
	return t;
}
function Ct(e) {
	var t = St(e);
	if (!e.equals(t) && (e.wv = cr(), (!Dt?.is_fork || e.deps === null) && (Dt === null ? e.v = t : (Dt.capture(e, t, !0), Ot?.capture(e, t, !0)), e.deps === null))) {
		Ye(e, h);
		return;
	}
	Gn || (kt === null ? Xe(e) : (xn() || Dt?.is_fork) && kt.set(e, t));
}
function wt(e) {
	if (e.effects !== null) for (let t of e.effects) (t.teardown || t.ac) && (t.teardown?.(), t.ac !== null && dt(() => {
		t.ac.abort(le), t.ac = null;
	}), t.fn !== null && (t.teardown = d), mr(t, 0), Nn(t));
}
function Tt(e) {
	if (e.effects !== null) for (let t of e.effects) t.teardown && t.fn !== null && hr(t);
}
//#endregion
//#region node_modules/svelte/src/internal/client/reactivity/batch.js
var Et = null, Dt = null, Ot = null, kt = null, At = null, jt = !1, Mt = !1, Nt = null, Pt = null, Ft = 0, It = 1, Lt = class e {
	id = It++;
	#e = !1;
	linked = !0;
	#t = null;
	#n = null;
	async_deriveds = /* @__PURE__ */ new Map();
	current = /* @__PURE__ */ new Map();
	previous = /* @__PURE__ */ new Map();
	#r = /* @__PURE__ */ new Set();
	#i = /* @__PURE__ */ new Set();
	#a = 0;
	#o = /* @__PURE__ */ new Map();
	#s = null;
	#c = [];
	#l = [];
	#u = /* @__PURE__ */ new Set();
	#d = /* @__PURE__ */ new Set();
	#f = /* @__PURE__ */ new Map();
	#p = /* @__PURE__ */ new Set();
	is_fork = !1;
	#m = !1;
	constructor() {
		Et === null ? Et = this : (Et.#n = this, this.#t = Et), Et = this;
	}
	#h() {
		if (this.is_fork) return !0;
		for (let n of this.#o.keys()) {
			for (var e = n, t = !1; e.parent !== null;) {
				if (this.#f.has(e)) {
					t = !0;
					break;
				}
				e = e.parent;
			}
			if (!t) return !0;
		}
		return !1;
	}
	skip_effect(e) {
		this.#f.has(e) || this.#f.set(e, {
			d: [],
			m: []
		}), this.#p.delete(e);
	}
	unskip_effect(e, t = (e) => this.schedule(e)) {
		var n = this.#f.get(e);
		if (n) {
			this.#f.delete(e);
			for (var r of n.d) Ye(r, g), t(r);
			for (r of n.m) Ye(r, _), t(r);
		}
		this.#p.add(e);
	}
	#g() {
		this.#e = !0, Ft++ > 1e3 && (this.#x(), zt());
		for (let e of this.#u) this.#d.delete(e), Ye(e, g), this.schedule(e);
		for (let e of this.#d) Ye(e, _), this.schedule(e);
		let t = this.#c;
		this.#c = [], this.apply();
		var n = Nt = [], r = [], i = Pt = [];
		for (let e of t) try {
			this.#_(e, n, r);
		} catch (t) {
			throw Wt(e), this.#h() || this.discard(), t;
		}
		if (Dt = null, i.length > 0) {
			var a = e.ensure();
			for (let e of i) a.schedule(e);
		}
		if (Nt = null, Pt = null, this.#h()) {
			this.#b(r), this.#b(n);
			for (let [e, t] of this.#f) Ut(e, t);
			i.length > 0 && Dt.#g();
			return;
		}
		let o = this.#v();
		if (o) {
			this.#b(r), this.#b(n), o.#y(this);
			return;
		}
		this.#u.clear(), this.#d.clear();
		for (let e of this.#r) e(this);
		this.#r.clear(), Ot = this, Vt(r), Vt(n), Ot = null, this.#s?.resolve();
		var s = Dt;
		if (this.#a === 0 && (this.#c.length === 0 || s !== null) && this.#x(), this.#c.length > 0) {
			if (s !== null) {
				let e = s;
				e.#c.push(...this.#c.filter((t) => !e.#c.includes(t)));
			} else s = this;
		}
		s !== null && (Kt.clear(), s.#g());
	}
	#_(e, t, n) {
		e.f ^= h;
		for (var r = e.first; r !== null;) {
			var i = r.f, a = !!(i & 96);
			if (!(a && i & 1024 || i & 8192 || this.#f.has(r)) && r.fn !== null) {
				a ? r.f ^= h : i & 4 ? t.push(r) : lr(r) && (i & 16 && this.#d.add(r), hr(r));
				var o = r.first;
				if (o !== null) {
					r = o;
					continue;
				}
			}
			for (; r !== null;) {
				var s = r.next;
				if (s !== null) {
					r = s;
					break;
				}
				r = r.parent;
			}
		}
	}
	#v() {
		for (var e = this.#t; e !== null;) {
			if (!e.is_fork) {
				for (let [t, [, n]] of this.current) if (e.current.has(t) && !n) return e;
			}
			e = e.#t;
		}
		return null;
	}
	#y(e) {
		for (let [t, n] of e.current) !this.previous.has(t) && e.previous.has(t) && this.previous.set(t, e.previous.get(t)), this.current.set(t, n);
		for (let [t, n] of e.async_deriveds) {
			let e = this.async_deriveds.get(t);
			e && n.promise.then(e.resolve).catch(e.reject);
		}
		e.async_deriveds.clear(), this.transfer_effects(e.#u, e.#d);
		let t = (e) => {
			var n = e.reactions;
			if (n !== null && !(e.f & 2 && !(e.f & 6144))) for (let e of n) {
				var r = e.f;
				if (r & 2) t(e);
				else {
					var i = e;
					r & 4194320 && !this.async_deriveds.has(i) && (this.#d.delete(i), Ye(i, g), this.schedule(i));
				}
			}
		};
		for (let e of this.current.keys()) t(e);
		this.oncommit(() => e.discard()), e.#x(), Dt = this, this.#g();
	}
	#b(e) {
		for (var t = 0; t < e.length; t += 1) Qe(e[t], this.#u, this.#d);
	}
	capture(e, t, n = !1) {
		e.v !== fe && !this.previous.has(e) && this.previous.set(e, e.v), e.f & 8388608 || (this.current.set(e, [t, n]), kt?.set(e, t)), this.is_fork || (e.v = t);
	}
	activate() {
		Dt = this;
	}
	deactivate() {
		Dt = null, kt = null;
	}
	flush() {
		try {
			Mt = !0, Dt = this, this.#g();
		} finally {
			Ft = 0, At = null, Nt = null, Pt = null, Mt = !1, Dt = null, kt = null, Kt.clear();
		}
	}
	discard() {
		for (let e of this.#i) e(this);
		this.#i.clear();
		for (let e of this.async_deriveds.values()) e.reject(vt);
		this.#x(), this.#s?.resolve();
	}
	register_created_effect(e) {
		this.#l.push(e);
	}
	increment(e, t) {
		if (this.#a += 1, e) {
			let e = this.#o.get(t) ?? 0;
			this.#o.set(t, e + 1);
		}
	}
	decrement(e, t) {
		if (--this.#a, e) {
			let e = this.#o.get(t) ?? 0;
			e === 1 ? this.#o.delete(t) : this.#o.set(t, e - 1);
		}
		this.#m || (this.#m = !0, Ke(() => {
			this.#m = !1, this.linked && this.flush();
		}));
	}
	transfer_effects(e, t) {
		for (let t of e) this.#u.add(t);
		for (let e of t) this.#d.add(e);
		e.clear(), t.clear();
	}
	oncommit(e) {
		this.#r.add(e);
	}
	ondiscard(e) {
		this.#i.add(e);
	}
	settled() {
		return (this.#s ??= p()).promise;
	}
	static ensure() {
		if (Dt === null) {
			let t = Dt = new e();
			!Mt && !jt && Ke(() => {
				t.#e || t.flush();
			});
		}
		return Dt;
	}
	apply() {
		kt = null;
	}
	schedule(e) {
		if (At = e, e.b?.is_pending && e.f & 16777228 && !(e.f & 32768)) {
			e.b.defer_effect(e);
			return;
		}
		for (var t = e; t.parent !== null;) {
			t = t.parent;
			var n = t.f;
			if (Nt !== null && t === Xn && (qn === null || !(qn.f & 2))) return;
			if (n & 96) {
				if (!(n & 1024)) return;
				t.f ^= h;
			}
		}
		this.#c.push(t);
	}
	#x() {
		if (this.linked) {
			var e = this.#t, t = this.#n;
			e === null || (e.#n = t), t === null ? Et = e : t.#t = e, this.linked = !1;
		}
	}
};
function Rt(e) {
	var t = jt;
	jt = !0;
	try {
		var n;
		for (e && (Dt !== null && !Dt.is_fork && Dt.flush(), n = e());;) {
			if (qe(), Dt === null) return n;
			Dt.flush();
		}
	} finally {
		jt = t;
	}
}
function zt() {
	try {
		Ne();
	} catch (e) {
		_n(e, At);
	}
}
var Bt = null;
function Vt(e) {
	var t = e.length;
	if (t !== 0) {
		for (var n = 0; n < t;) {
			var r = e[n++];
			if (!(r.f & 24576) && lr(r) && (Bt = /* @__PURE__ */ new Set(), hr(r), r.deps === null && r.first === null && r.nodes === null && r.teardown === null && r.ac === null && Ln(r), Bt?.size > 0)) {
				Kt.clear();
				for (let e of Bt) {
					if (e.f & 24576) continue;
					let t = [e], n = e.parent;
					for (; n !== null;) Bt.has(n) && (Bt.delete(n), t.push(n)), n = n.parent;
					for (let e = t.length - 1; e >= 0; e--) {
						let n = t[e];
						n.f & 24576 || hr(n);
					}
				}
				Bt.clear();
			}
		}
		Bt = null;
	}
}
function Ht(e) {
	Dt.schedule(e);
}
function Ut(e, t) {
	if (!(e.f & 32 && e.f & 1024)) {
		e.f & 2048 ? t.d.push(e) : e.f & 4096 && t.m.push(e), Ye(e, h);
		for (var n = e.first; n !== null;) Ut(n, t), n = n.next;
	}
}
function Wt(e) {
	Ye(e, h);
	for (var t = e.first; t !== null;) Wt(t), t = t.next;
}
//#endregion
//#region node_modules/svelte/src/internal/client/reactivity/sources.js
var Gt = /* @__PURE__ */ new Set(), Kt = /* @__PURE__ */ new Map(), qt = !1;
function Jt(e, t) {
	return {
		f: 0,
		v: e,
		reactions: null,
		equals: we,
		rv: 0,
		wv: 0
	};
}
/*#__NO_SIDE_EFFECTS__*/
function F(e, t) {
	let n = Jt(e, t);
	return $n(n), n;
}
/*#__NO_SIDE_EFFECTS__*/
function Yt(e, t = !1, n = !0) {
	let r = Jt(e);
	return t || (r.equals = Ee), r;
}
function I(e, t, n = !1) {
	return qn !== null && (!Jn || qn.f & 131072) && Ue() && qn.f & 4325394 && (Qn === null || !Qn.has(e)) && Ie(), Xt(e, n ? en(t) : t, Pt);
}
function Xt(e, t, n = null) {
	if (!e.equals(t)) {
		Gn ? Kt.set(e, t) : Kt.has(e) || Kt.set(e, e.v);
		var r = Lt.ensure();
		if (r.capture(e, t), e.f & 2) {
			let t = e;
			e.f & 2048 && St(t), kt === null && Xe(t);
		}
		e.wv = cr(), $t(e, g, n), Ue() && Xn !== null && Xn.f & 1024 && !(Xn.f & 96) && (nr === null ? rr([e]) : nr.push(e)), !r.is_fork && Gt.size > 0 && !qt && Zt();
	}
	return t;
}
function Zt() {
	qt = !1;
	for (let e of Gt) {
		e.f & 1024 && Ye(e, _);
		let t;
		try {
			t = lr(e);
		} catch {
			t = !0;
		}
		t && hr(e);
	}
	Gt.clear();
}
function Qt(e) {
	I(e, e.v + 1);
}
function $t(e, t, n) {
	var r = e.reactions;
	if (r !== null) for (var i = Ue(), a = r.length, o = 0; o < a; o++) {
		var s = r[o], c = s.f;
		if (i || s !== Xn) {
			var l = (c & g) === 0;
			if (l && Ye(s, t), c & 131072) Gt.add(s);
			else if (c & 2) {
				var u = s;
				kt?.delete(u), c & 65536 || (c & 512 && (Xn === null || !(Xn.f & 2097152)) && (s.f |= T), $t(u, _, n));
			} else if (l) {
				var d = s;
				c & 16 && Bt !== null && Bt.add(d), n === null ? Ht(d) : n.push(d);
			}
		}
	}
}
function en(t) {
	if (typeof t != "object" || !t || O in t || k in t) return t;
	let n = l(t);
	if (n !== s && n !== c) return t;
	var r = /* @__PURE__ */ new Map(), i = e(t), o = /* @__PURE__ */ F(0), u = null, d = or, f = (e) => {
		if (or === d) return e();
		var t = qn, n = or;
		Yn(null), sr(d);
		var r = e();
		return Yn(t), sr(n), r;
	};
	return i && r.set("length", /* @__PURE__ */ F(t.length, u)), new Proxy(t, {
		defineProperty(e, t, n) {
			(!("value" in n) || n.configurable === !1 || n.enumerable === !1 || n.writable === !1) && Fe();
			var i = r.get(t);
			return i === void 0 ? f(() => {
				var e = /* @__PURE__ */ F(n.value, u);
				return r.set(t, e), e;
			}) : I(i, n.value, !0), !0;
		},
		deleteProperty(e, t) {
			var n = r.get(t);
			if (n === void 0) {
				if (t in e) {
					let e = f(() => /* @__PURE__ */ F(fe, u));
					r.set(t, e), Qt(o);
				}
			} else I(n, fe), Qt(o);
			return !0;
		},
		get(e, n, i) {
			if (n === O) return t;
			var o = r.get(n), s = n in e;
			if (o === void 0 && (!s || a(e, n)?.writable) && (o = f(() => /* @__PURE__ */ F(en(s ? e[n] : fe), u)), r.set(n, o)), o !== void 0) {
				var c = H(o);
				return c === fe ? void 0 : c;
			}
			return Reflect.get(e, n, i);
		},
		getOwnPropertyDescriptor(e, t) {
			var n = Reflect.getOwnPropertyDescriptor(e, t);
			if (n && "value" in n) {
				var i = r.get(t);
				i && (n.value = H(i));
			} else if (n === void 0) {
				var a = r.get(t), o = a?.v;
				if (a !== void 0 && o !== fe) return {
					enumerable: !0,
					configurable: !0,
					value: o,
					writable: !0
				};
			}
			return n;
		},
		has(e, t) {
			if (t === O) return !0;
			var n = r.get(t), i = n !== void 0 && n.v !== fe || Reflect.has(e, t);
			return (n !== void 0 || Xn !== null && (!i || a(e, t)?.writable)) && (n === void 0 && (n = f(() => /* @__PURE__ */ F(i ? en(e[t]) : fe, u)), r.set(t, n)), H(n) === fe) ? !1 : i;
		},
		set(e, t, n, s) {
			var c = r.get(t), l = t in e;
			if (i && t === "length") for (var d = n; d < c.v; d += 1) {
				var p = r.get(d + "");
				p === void 0 ? d in e && (p = f(() => /* @__PURE__ */ F(fe, u)), r.set(d + "", p)) : I(p, fe);
			}
			if (c === void 0) (!l || a(e, t)?.writable) && (c = f(() => /* @__PURE__ */ F(void 0, u)), I(c, en(n)), r.set(t, c));
			else {
				l = c.v !== fe;
				var m = f(() => en(n));
				I(c, m);
			}
			var h = Reflect.getOwnPropertyDescriptor(e, t);
			if (h?.set && h.set.call(s, n), !l) {
				if (i && typeof t == "string") {
					var g = r.get("length"), _ = Number(t);
					Number.isInteger(_) && _ >= g.v && I(g, _ + 1);
				}
				Qt(o);
			}
			return !0;
		},
		ownKeys(e) {
			H(o);
			var t = Reflect.ownKeys(e).filter((e) => {
				var t = r.get(e);
				return t === void 0 || t.v !== fe;
			});
			for (var [n, i] of r) i.v !== fe && !(n in e) && t.push(n);
			return t;
		},
		setPrototypeOf() {
			N();
		}
	});
}
function tn(e) {
	try {
		if (typeof e == "object" && e && O in e) return e[O];
	} catch {}
	return e;
}
function nn(e, t) {
	return Object.is(tn(e), tn(t));
}
var rn, an, on, sn;
function cn() {
	if (rn === void 0) {
		rn = window, an = /Firefox/.test(navigator.userAgent);
		var e = Element.prototype, t = Node.prototype, n = Text.prototype;
		on = a(t, "firstChild").get, sn = a(t, "nextSibling").get, u(e) && (e[ae] = void 0, e[ie] = null, e[oe] = void 0, e.__e = void 0), u(n) && (n[se] = void 0);
	}
}
function ln(e = "") {
	return document.createTextNode(e);
}
/*@__NO_SIDE_EFFECTS__*/
function un(e) {
	return on.call(e);
}
/*@__NO_SIDE_EFFECTS__*/
function dn(e) {
	return sn.call(e);
}
function L(e, t) {
	if (!A) return /* @__PURE__ */ un(e);
	var n = /* @__PURE__ */ un(j);
	if (n === null) n = j.appendChild(ln());
	else if (t && n.nodeType !== 3) {
		var r = ln();
		return n?.before(r), ye(r), r;
	}
	return t && hn(n), ye(n), n;
}
function R(e, t = !1) {
	if (!A) {
		var n = /* @__PURE__ */ un(e);
		return n instanceof Comment && n.data === "" ? /* @__PURE__ */ dn(n) : n;
	}
	if (t) {
		if (j?.nodeType !== 3) {
			var r = ln();
			return j?.before(r), ye(r), r;
		}
		hn(j);
	}
	return j;
}
function z(e, t = !1) {
	if (!A) return /* @__PURE__ */ un(e);
	var n = L(e, t);
	return M(e), n;
}
function B(e, t = 1, n = !1) {
	let r = A ? j : e;
	for (var i; t--;) i = r, r = /* @__PURE__ */ dn(r);
	if (!A) return r;
	if (n) {
		if (r?.nodeType !== 3) {
			var a = ln();
			return r === null ? i?.after(a) : r.before(a), ye(a), a;
		}
		hn(r);
	}
	return ye(r), r;
}
function fn(e) {
	e.textContent = "";
}
function pn() {
	return !1;
}
function mn(e, t, n) {
	return t == null || t === "http://www.w3.org/1999/xhtml" ? n ? document.createElement(e, { is: n }) : document.createElement(e) : n ? document.createElementNS(t, e, { is: n }) : document.createElementNS(t, e);
}
function hn(e) {
	if (e.nodeValue.length < 65536) return;
	let t = e.nextSibling;
	for (; t !== null && t.nodeType === 3;) t.remove(), e.nodeValue += t.nodeValue, t = e.nextSibling;
}
function gn(e) {
	var t = Xn;
	if (t === null) return qn.f |= D, e;
	if (!(t.f & 32768) && !(t.f & 4)) throw e;
	_n(e, t);
}
function _n(e, t) {
	if (!(t !== null && t.f & 16384)) {
		for (; t !== null;) {
			if (t.f & 128 && !(t.f & 33570816)) {
				if (!(t.f & 32768)) throw e;
				try {
					t.b.error(e);
					return;
				} catch (t) {
					e = t;
				}
			}
			t = t.parent;
		}
		throw e;
	}
}
//#endregion
//#region node_modules/svelte/src/internal/client/reactivity/effects.js
function vn(e) {
	Xn === null && (qn === null && Me(e), je()), Gn && Ae(e);
}
function yn(e, t) {
	var n = t.last;
	n === null ? t.last = t.first = e : (n.next = e, e.prev = n, t.last = e);
}
function bn(e, t) {
	var n = Xn;
	n !== null && n.f & 8192 && (e |= v);
	var r = {
		ctx: Re,
		deps: null,
		nodes: null,
		f: e | g | 512,
		first: null,
		fn: t,
		last: null,
		next: null,
		parent: n,
		b: n && n.b,
		prev: null,
		teardown: null,
		wv: 0,
		ac: null
	};
	Dt?.register_created_effect(r);
	var i = r;
	if (e & 4) Nt === null ? Lt.ensure().schedule(r) : Nt.push(r);
	else if (t !== null) {
		try {
			hr(r);
		} catch (e) {
			throw Fn(r), e;
		}
		i.deps === null && i.teardown === null && i.nodes === null && i.first === i.last && !(i.f & 524288) && (i = i.first, e & 16 && e & 65536 && i !== null && (i.f |= S));
	}
	if (i !== null && (i.parent = n, n !== null && yn(i, n), qn !== null && qn.f & 2 && !(e & 64))) {
		var a = qn;
		(a.effects ??= []).push(i);
	}
	return r;
}
function xn() {
	return qn !== null && !Jn;
}
function Sn(e) {
	let t = bn(8, null);
	return Ye(t, h), t.teardown = e, t;
}
function Cn(e) {
	vn("$effect");
	var t = Xn.f;
	if (!qn && t & 32 && Re !== null && !Re.i) {
		var n = Re;
		(n.e ??= []).push(e);
	} else return wn(e);
}
function wn(e) {
	return bn(4 | w, e);
}
function Tn(e) {
	return vn("$effect.pre"), bn(8 | w, e);
}
function En(e) {
	Lt.ensure();
	let t = bn(64 | C, e);
	return (e = {}) => new Promise((n) => {
		e.outro ? Rn(t, () => {
			Fn(t), n(void 0);
		}) : (Fn(t), n(void 0));
	});
}
function Dn(e) {
	return bn(4, e);
}
function On(e) {
	return bn(te | C, e);
}
function kn(e, t = 0) {
	return bn(8 | t, e);
}
function V(e, t = [], n = [], r = []) {
	pt(r, t, n, (t) => {
		bn(8, () => {
			e(...t.map(H));
		});
	});
}
function An(e, t = 0) {
	return bn(16 | t, e);
}
function jn(e) {
	return bn(32 | C, e);
}
function Mn(e) {
	var t = e.teardown;
	if (t !== null) {
		let n = Gn, r = qn;
		Kn(!0), Yn(null);
		try {
			t.call(null);
		} catch (t) {
			_n(t, e.parent);
		} finally {
			Kn(n), Yn(r);
		}
	}
}
function Nn(e, t = !1) {
	var n = e.first;
	for (e.first = e.last = null; n !== null;) {
		let e = n.ac;
		e !== null && dt(() => {
			e.abort(le);
		});
		var r = n.next;
		n.f & 64 ? n.parent = null : Fn(n, t), n = r;
	}
}
function Pn(e) {
	for (var t = e.first; t !== null;) {
		var n = t.next;
		t.f & 32 || Fn(t), t = n;
	}
}
function Fn(e, t = !0) {
	var n = !1;
	(t || e.f & 262144) && e.nodes !== null && e.nodes.end !== null && (In(e.nodes.start, e.nodes.end), n = !0), e.f |= x, Nn(e, t && !n), mr(e, 0);
	var r = e.nodes && e.nodes.t;
	if (r !== null) for (let e of r) e.stop();
	Mn(e), e.f ^= x, e.f |= y;
	var i = e.parent;
	i !== null && i.first !== null && Ln(e), e.next = e.prev = e.teardown = e.ctx = e.deps = e.fn = e.nodes = e.ac = e.b = null;
}
function In(e, t) {
	for (; e !== null;) {
		var n = e === t ? null : /* @__PURE__ */ dn(e);
		e.remove(), e = n;
	}
}
function Ln(e) {
	var t = e.parent, n = e.prev, r = e.next;
	n !== null && (n.next = r), r !== null && (r.prev = n), t !== null && (t.first === e && (t.first = r), t.last === e && (t.last = n));
}
function Rn(e, t, n = !0) {
	var r = [];
	e.f |= 256, zn(e, r, !0);
	var i = () => {
		n && Fn(e), t && t();
	}, a = r.length;
	if (a > 0) {
		var o = () => --a || i();
		for (var s of r) s.out(o);
	} else i();
}
function zn(e, t, n) {
	if (!(e.f & 8192)) {
		e.f ^= v;
		var r = e.nodes && e.nodes.t;
		if (r !== null) for (let e of r) (e.is_global || n) && t.push(e);
		for (var i = e.first; i !== null;) {
			var a = i.next;
			if (!(i.f & 64)) {
				var o = !!(i.f & 65536) || !!(i.f & 32) && !!(e.f & 16);
				zn(i, t, o ? n : !1);
			}
			i = a;
		}
	}
}
function Bn(e) {
	e.f &= -257, Vn(e, !0);
}
function Vn(e, t) {
	if (!(e.f & 256) && e.f & 8192) {
		e.f ^= v, e.f & 1024 || (Ye(e, g), Lt.ensure().schedule(e));
		for (var n = e.first; n !== null;) {
			var r = n.next, i = !!(n.f & 65536) || !!(n.f & 32);
			Vn(n, i ? t : !1), n = r;
		}
		var a = e.nodes && e.nodes.t;
		if (a !== null) for (let e of a) (e.is_global || t) && e.in();
	}
}
function Hn(e, t) {
	if (e.nodes) for (var n = e.nodes.start, r = e.nodes.end; n !== null;) {
		var i = n === r ? null : /* @__PURE__ */ dn(n);
		t.append(n), n = i;
	}
}
//#endregion
//#region node_modules/svelte/src/internal/client/legacy.js
var Un = null, Wn = !1, Gn = !1;
function Kn(e) {
	Gn = e;
}
var qn = null, Jn = !1;
function Yn(e) {
	qn = e;
}
var Xn = null;
function Zn(e) {
	Xn = e;
}
var Qn = null;
function $n(e) {
	qn !== null && (Qn ??= /* @__PURE__ */ new Set()).add(e);
}
var er = null, tr = 0, nr = null;
function rr(e) {
	nr = e;
}
var ir = 1, ar = 0, or = ar;
function sr(e) {
	or = e;
}
function cr() {
	return ++ir;
}
function lr(e) {
	var t = e.f;
	if (t & 2048) return !0;
	if (t & 2 && (e.f &= ~T), t & 4096) {
		for (var n = e.deps, r = n.length, i = 0; i < r; i++) {
			var a = n[i];
			if (lr(a) && Ct(a), a.wv > e.wv) return !0;
		}
		t & 512 && kt === null && Ye(e, h);
	}
	return !1;
}
function ur(e, t, n = !0) {
	var r = e.reactions;
	if (r !== null && !(Qn !== null && Qn.has(e))) for (var i = 0; i < r.length; i++) {
		var a = r[i];
		a.f & 2 ? ur(a, t, !1) : t === a && (n ? Ye(a, g) : a.f & 1024 && Ye(a, _), Ht(a));
	}
}
function dr(e) {
	var t = er, n = tr, r = nr, i = qn, a = Qn, o = Re, s = Jn, c = or, l = e.f;
	er = null, tr = 0, nr = null, qn = l & 96 ? null : e, Qn = null, ze(e.ctx), Jn = !1, or = ++ar, e.ac !== null && (dt(() => {
		e.ac.abort(le);
	}), e.ac = null);
	try {
		e.f |= E;
		var u = e.fn, d = u();
		e.f |= b;
		var f = fr(e);
		if (Ue() && nr !== null && !Jn && f !== null && !(e.f & 6146)) for (var p = 0; p < nr.length; p++) ur(nr[p], e);
		if (i !== null && i !== e) {
			if (ar++, i.deps !== null) for (let e = 0; e < n; e += 1) i.deps[e].rv = ar;
			if (t !== null) for (let e of t) e.rv = ar;
			nr !== null && (r === null ? r = nr : r.push(...nr));
		}
		return e.f & 8388608 && (e.f ^= D), d;
	} catch (t) {
		return fr(e), gn(t);
	} finally {
		e.f ^= E, er = t, tr = n, nr = r, qn = i, Qn = a, ze(o), Jn = s, or = c;
	}
}
function fr(e) {
	var t = e.deps, n = Dt?.is_fork;
	if (er !== null) {
		var r;
		if (n || mr(e, tr), t !== null && tr > 0) for (t.length = tr + er.length, r = 0; r < er.length; r++) t[tr + r] = er[r];
		else e.deps = t = er;
		if (xn() && e.f & 512) for (r = tr; r < t.length; r++) (t[r].reactions ??= []).push(e);
	} else !n && t !== null && tr < t.length && (mr(e, tr), t.length = tr);
	return t;
}
function pr(e, r) {
	let i = r.reactions;
	if (i !== null) {
		var a = t.call(i, e);
		if (a !== -1) {
			var o = i.length - 1;
			o === 0 ? i = r.reactions = null : (i[a] = i[o], i.pop());
		}
	}
	if (i === null && r.f & 2 && (er === null || !n.call(er, r))) {
		var s = r;
		s.f & 512 && (s.f ^= 512, s.f &= ~T), s.v !== fe && Xe(s), s.ac !== null && dt(() => {
			s.ac.abort(le), s.ac = null, Ye(s, g);
		}), wt(s), mr(s, 0);
	}
}
function mr(e, t) {
	var n = e.deps;
	if (n !== null) for (var r = t; r < n.length; r++) pr(e, n[r]);
}
function hr(e) {
	var t = e.f;
	if (!(t & 16384)) {
		Ye(e, h);
		var n = Xn, r = Wn;
		Xn = e, Wn = !(t & 96);
		try {
			t & 16777232 ? Pn(e) : Nn(e), Mn(e);
			var i = dr(e);
			e.teardown = typeof i == "function" ? i : null, e.wv = ir;
		} finally {
			Wn = r, Xn = n;
		}
	}
}
async function gr() {
	await Promise.resolve(), Rt();
}
function H(e) {
	var t = !!(e.f & 2);
	if (Un?.add(e), qn !== null && !Jn && !(Xn !== null && Xn.f & 16384) && (Qn === null || !Qn.has(e))) {
		var r = qn.deps;
		if (qn.f & 2097152) e.rv < ar && (e.rv = ar, er === null && r !== null && r[tr] === e ? tr++ : er === null ? er = [e] : er.push(e));
		else {
			qn.deps ??= [], n.call(qn.deps, e) || qn.deps.push(e);
			var i = e.reactions;
			i === null ? e.reactions = [qn] : n.call(i, qn) || i.push(qn);
		}
	}
	if (Gn && Kt.has(e)) return Kt.get(e);
	if (t) {
		var a = e;
		if (Gn) {
			var o = a.v;
			return (!(a.f & 1024) && a.reactions !== null || vr(a)) && (o = St(a)), Kt.set(a, o), o;
		}
		var s = !(a.f & 512) && !Jn && qn !== null && (Wn || !!(qn.f & 512)), c = (a.f & b) === 0;
		lr(a) && (s && (a.f |= 512), Ct(a)), s && !c && (Tt(a), _r(a));
	}
	if (kt?.has(e)) return kt.get(e);
	if (e.f & 8388608) throw e.v;
	return e.v;
}
function _r(e) {
	if (e.f |= 512, e.deps !== null) for (let t of e.deps) (t.reactions ??= []).push(e), t.f & 2 && !(t.f & 512) && (Tt(t), _r(t));
}
function vr(e) {
	if (e.v === fe) return !0;
	if (e.deps === null) return !1;
	for (let t of e.deps) if (Kt.has(t) || t.f & 2 && vr(t)) return !0;
	return !1;
}
function yr(e) {
	var t = Jn;
	try {
		return Jn = !0, e();
	} finally {
		Jn = t;
	}
}
function br(e) {
	if (!(typeof e != "object" || !e || e instanceof EventTarget)) {
		if (O in e) xr(e);
		else if (!Array.isArray(e)) for (let t in e) {
			let n = e[t];
			typeof n == "object" && n && O in n && xr(n);
		}
	}
}
function xr(e, t = /* @__PURE__ */ new Set()) {
	if (typeof e == "object" && e && !(e instanceof EventTarget) && !t.has(e)) {
		t.add(e), e instanceof Date && e.getTime();
		for (let n in e) try {
			xr(e[n], t);
		} catch {}
		let n = l(e);
		if (n !== Object.prototype && n !== Array.prototype && n !== Map.prototype && n !== Set.prototype && n !== Date.prototype) {
			let t = o(n);
			for (let n in t) {
				let r = t[n].get;
				if (r) try {
					r.call(e);
				} catch {}
			}
		}
	}
}
[.../* @__PURE__ */ "allowfullscreen.async.autofocus.autoplay.checked.controls.default.disabled.formnovalidate.indeterminate.inert.ismap.loop.multiple.muted.nomodule.novalidate.open.playsinline.readonly.required.reversed.seamless.selected.webkitdirectory.defer.disablepictureinpicture.disableremoteplayback".split(".")];
var Sr = ["touchstart", "touchmove"];
function Cr(e) {
	return Sr.includes(e);
}
//#endregion
//#region node_modules/svelte/src/internal/client/dev/css.js
var wr = Symbol("events"), Tr = /* @__PURE__ */ new Set(), Er = /* @__PURE__ */ new Set();
function Dr(e, t, n, r = {}) {
	function i(e) {
		if (r.capture || Mr.call(t, e), !e.cancelBubble) return dt(() => n?.call(this, e));
	}
	return e.startsWith("pointer") || e.startsWith("touch") || e === "wheel" ? Ke(() => {
		t.addEventListener(e, i, r);
	}) : t.addEventListener(e, i, r), i;
}
function Or(e, t, n, r, i) {
	var a = {
		capture: r,
		passive: i
	}, o = Dr(e, t, n, a);
	(t === document.body || t === window || t === document || t instanceof HTMLMediaElement) && Sn(() => {
		t.removeEventListener(e, o, a);
	});
}
function U(e, t, n) {
	(t[wr] ??= {})[e] = n;
}
function kr(e) {
	for (var t = 0; t < e.length; t++) Tr.add(e[t]);
	for (var n of Er) n(e);
}
var Ar = null, jr = !1;
function Mr(e) {
	var t = this, n = t.ownerDocument, r = e.type, a = e.composedPath?.() || [], o = a[0] || e.target;
	Ar = e, jr || (jr = !0, setTimeout(() => {
		jr = !1, Ar = null;
	}));
	var s = 0, c = Ar === e && e[wr];
	if (c) {
		var l = a.indexOf(c);
		if (l !== -1 && (t === document || t === window)) {
			e[wr] = t;
			return;
		}
		var u = a.indexOf(t);
		if (u === -1) return;
		l <= u && (s = l);
	}
	if (o = a[s] || e.target, o !== t) {
		i(e, "currentTarget", {
			configurable: !0,
			get() {
				return o || n;
			}
		});
		var d = qn, f = Xn;
		Yn(null), Zn(null);
		try {
			for (var p, m = []; o !== null && o !== t;) {
				try {
					var h = o[wr]?.[r];
					h != null && (!o.disabled || e.target === o) && h.call(o, e);
				} catch (e) {
					p ? m.push(e) : p = e;
				}
				if (e.cancelBubble) break;
				s++, o = s < a.length ? a[s] : null;
			}
			if (p) {
				for (let e of m) queueMicrotask(() => {
					throw e;
				});
				throw p;
			}
		} finally {
			e[wr] = t, delete e.currentTarget, Yn(d), Zn(f);
		}
	}
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/reconciler.js
var Nr = globalThis?.window?.trustedTypes && /* @__PURE__ */ globalThis.window.trustedTypes.createPolicy("svelte-trusted-html", { createHTML: (e) => e });
function Pr(e) {
	return Nr?.createHTML(e) ?? e;
}
function Fr(e) {
	var t = mn("template");
	return t.innerHTML = Pr(e.replaceAll("<!>", "<!---->")), t.content;
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/template.js
function Ir(e, t) {
	var n = Xn;
	n.nodes === null && (n.nodes = {
		start: e,
		end: t,
		a: null,
		t: null
	});
}
/*#__NO_SIDE_EFFECTS__*/
function W(e, t) {
	var n = !!(t & 1), r = !!(t & 2), i, a = !e.startsWith("<!>");
	return () => {
		if (A) return Ir(j, null), j;
		i === void 0 && (i = Fr(a ? e : "<!>" + e), n || (i = /* @__PURE__ */ un(i)));
		var t = r || an ? document.importNode(i, !0) : i.cloneNode(!0);
		if (n) {
			var o = /* @__PURE__ */ un(t), s = t.lastChild;
			Ir(o, s);
		} else Ir(t, t);
		return t;
	};
}
/*#__NO_SIDE_EFFECTS__*/
function Lr(e, t, n = "svg") {
	var r = !e.startsWith("<!>"), i = !!(t & 1), a = `<${n}>${r ? e : "<!>" + e}</${n}>`, o;
	return () => {
		if (A) return Ir(j, null), j;
		if (!o) {
			var e = /* @__PURE__ */ un(Fr(a));
			if (i) for (o = document.createDocumentFragment(); /* @__PURE__ */ un(e);) o.appendChild(/* @__PURE__ */ un(e));
			else o = /* @__PURE__ */ un(e);
		}
		var t = o.cloneNode(!0);
		if (i) {
			var n = /* @__PURE__ */ un(t), r = t.lastChild;
			Ir(n, r);
		} else Ir(t, t);
		return t;
	};
}
/*#__NO_SIDE_EFFECTS__*/
function Rr(e, t) {
	return /* @__PURE__ */ Lr(e, t, "svg");
}
function zr(e = "") {
	if (!A) {
		var t = ln(e + "");
		return Ir(t, t), t;
	}
	var n = j;
	return n.nodeType === 3 ? hn(n) : (n.before(n = ln()), ye(n)), Ir(n, n), n;
}
function Br() {
	if (A) return Ir(j, null), j;
	var e = document.createDocumentFragment(), t = document.createComment(""), n = ln();
	return e.append(t, n), Ir(t, n), e;
}
function G(e, t) {
	if (A) {
		var n = Xn;
		(!(n.f & 32768) || n.nodes.end === null) && (n.nodes.end = j), be();
		return;
	}
	e !== null && e.before(t);
}
//#endregion
//#region node_modules/svelte/src/reactivity/create-subscriber.js
function Vr(e) {
	let t = 0, n = Jt(0), r;
	return () => {
		xn() && (H(n), kn(() => (t === 0 && (r = yr(() => e(() => Qt(n)))), t += 1, () => {
			Ke(() => {
				--t, t === 0 && (r?.(), r = void 0, Qt(n));
			});
		})));
	};
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/blocks/boundary.js
var Hr = S | C;
function Ur(e, t, n, r) {
	new Wr(e, t, n, r);
}
var Wr = class {
	parent;
	is_pending = !1;
	transform_error;
	#e;
	#t = A ? j : null;
	#n;
	#r;
	#i;
	#a = null;
	#o = null;
	#s = null;
	#c = null;
	#l = 0;
	#u = 0;
	#d = !1;
	#f = /* @__PURE__ */ new Set();
	#p = /* @__PURE__ */ new Set();
	#m = null;
	#h = Vr(() => (this.#m = Jt(this.#l), () => {
		this.#m = null;
	}));
	constructor(e, t, n, r) {
		this.#e = e, this.#n = t, this.#r = (e) => {
			var t = Xn;
			t.b = this, t.f |= 128, n(e);
		}, this.parent = Xn.b, this.transform_error = r ?? this.parent?.transform_error ?? ((e) => e), this.#i = An(() => {
			if (A) {
				let e = this.#t;
				be();
				let t = e.data === "[!";
				if (e.data.startsWith("[?")) {
					let t = JSON.parse(e.data.slice(2));
					this.#_(t);
				} else t ? this.#y() : this.#g();
			} else this.#b();
		}, Hr), A && (this.#e = j);
	}
	#g() {
		try {
			this.#a = jn(() => this.#r(this.#e));
		} catch (e) {
			this.error(e);
		}
	}
	#_(e) {
		let t = this.#n.failed, { reset: n, invoke_onerror: r } = this.#v(e);
		Ke(r), t && (this.#s = jn(() => {
			t(this.#e, () => e, () => n);
		}));
	}
	#v(e) {
		var t = !1, n = !1;
		let r = () => {
			if (t) {
				_e();
				return;
			}
			t = !0, n && Le(), this.#s !== null && Rn(this.#s, () => {
				this.#s = null;
			}), this.#S(() => {
				this.#b();
			});
		};
		return {
			reset: r,
			invoke_onerror: () => {
				try {
					n = !0, this.#n.onerror?.(e, r), n = !1;
				} catch (e) {
					_n(e, this.#i && this.#i.parent);
				}
			}
		};
	}
	#y() {
		let e = this.#n.pending;
		e && (this.is_pending = !0, this.#o = jn(() => e(this.#e)), Ke(() => {
			var e = this.#c = document.createDocumentFragment(), t = ln(), n = !1;
			if (e.append(t), this.#a = this.#S(() => {
				try {
					return jn(() => this.#r(t));
				} catch (e) {
					try {
						this.error(e), n = !0;
					} catch (e) {
						_n(e, this.#i.parent);
					}
					return null;
				}
			}), this.#a === null) {
				this.#c = null, n && this.#x(Dt);
				return;
			}
			this.#u === 0 && (this.#e.before(e), this.#c = null, Rn(this.#o, () => {
				this.#o = null;
			}), this.#x(Dt));
		}));
	}
	#b() {
		try {
			if (this.is_pending = this.has_pending_snippet(), this.#u = 0, this.#l = 0, this.#a = jn(() => {
				this.#r(this.#e);
			}), this.#u > 0) {
				var e = this.#c = document.createDocumentFragment();
				Hn(this.#a, e);
				let t = this.#n.pending;
				this.#o = jn(() => t(this.#e));
			} else this.#x(Dt);
		} catch (e) {
			this.error(e);
		}
	}
	#x(e) {
		this.is_pending = !1, e.transfer_effects(this.#f, this.#p);
	}
	defer_effect(e) {
		Qe(e, this.#f, this.#p);
	}
	is_rendered() {
		return !this.is_pending && (!this.parent || this.parent.is_rendered());
	}
	has_pending_snippet() {
		return !!this.#n.pending;
	}
	#S(e) {
		var t = Xn, n = qn, r = Re;
		Zn(this.#i), Yn(this.#i), ze(this.#i.ctx);
		try {
			return Lt.ensure(), e();
		} finally {
			Zn(t), Yn(n), ze(r);
		}
	}
	#C(e, t) {
		if (!this.has_pending_snippet()) {
			this.parent && this.parent.#C(e, t);
			return;
		}
		this.#u += e, this.#u === 0 && (this.#x(t), this.#o && Rn(this.#o, () => {
			this.#o = null;
		}), this.#c &&= (this.#e.before(this.#c), null));
	}
	update_pending_count(e, t) {
		this.#C(e, t), this.#l += e, !(!this.#m || this.#d) && (this.#d = !0, Ke(() => {
			this.#d = !1, this.#m && Xt(this.#m, this.#l);
		}));
	}
	get_effect_pending() {
		return this.#h(), H(this.#m);
	}
	error(e) {
		if (!this.#n.onerror && !this.#n.failed) throw e;
		Dt?.is_fork ? (this.#a && Dt.skip_effect(this.#a), this.#o && Dt.skip_effect(this.#o), this.#s && Dt.skip_effect(this.#s), Dt.oncommit(() => {
			this.#w(e);
		})) : this.#w(e);
	}
	#w(e) {
		this.#a &&= (Fn(this.#a), null), this.#o &&= (Fn(this.#o), null), this.#s &&= (Fn(this.#s), null), A && (ye(this.#t), xe(), ye(Se()));
		let t = this.#n.failed, n = (e) => {
			let { reset: n, invoke_onerror: r } = this.#v(e);
			r(), t && (this.#s = this.#S(() => {
				try {
					return jn(() => {
						var r = Xn;
						r.b = this, r.f |= 128, t(this.#e, () => e, () => n);
					});
				} catch (e) {
					return _n(e, this.#i.parent), null;
				}
			}));
		};
		Ke(() => {
			var t;
			try {
				t = this.transform_error(e);
			} catch (e) {
				_n(e, this.#i && this.#i.parent);
				return;
			}
			typeof t == "object" && t && typeof t.then == "function" ? t.then(n, (e) => _n(e, this.#i && this.#i.parent)) : n(t);
		});
	}
};
function K(e, t) {
	var n = t == null ? "" : typeof t == "object" ? `${t}` : t;
	n !== (e[se] ??= e.nodeValue) && (e[se] = n, e.nodeValue = `${n}`);
}
function Gr(e, t) {
	return qr(e, t);
}
var Kr = /* @__PURE__ */ new Map();
function qr(e, { target: t, anchor: n, props: i = {}, events: a, context: o, intro: s = !0, transformError: c }) {
	cn();
	var l = void 0, u = En(() => {
		var s = n ?? t.appendChild(ln());
		Ur(s, { pending: () => {} }, (t) => {
			Be({});
			var n = Re;
			if (o && (n.c = o), a && (i.$$events = a), A && Ir(t, null), l = e(t, i) || He(), A && (Xn.nodes.end = j, j === null || j.nodeType !== 8 || j.data !== "]")) throw he(), de;
			Ve();
		}, c);
		var u = /* @__PURE__ */ new Set(), d = (e) => {
			for (var n = 0; n < e.length; n++) {
				var r = e[n];
				if (!u.has(r)) {
					u.add(r);
					var i = Cr(r);
					for (let e of [t, document]) {
						var a = Kr.get(e);
						a === void 0 && (a = /* @__PURE__ */ new Map(), Kr.set(e, a));
						var o = a.get(r);
						o === void 0 ? (e.addEventListener(r, Mr, { passive: i }), a.set(r, 1)) : a.set(r, o + 1);
					}
				}
			}
		};
		return d(r(Tr)), Er.add(d), () => {
			for (var e of u) for (let n of [t, document]) {
				var r = Kr.get(n), i = r.get(e);
				--i == 0 ? (n.removeEventListener(e, Mr), r.delete(e), r.size === 0 && Kr.delete(n)) : r.set(e, i);
			}
			Er.delete(d), s !== n && s.parentNode?.removeChild(s);
		};
	});
	return Jr.set(l, u), l;
}
var Jr = /* @__PURE__ */ new WeakMap();
function Yr(e, t) {
	let n = Jr.get(e);
	return n ? (Jr.delete(e), n(t)) : Promise.resolve();
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/blocks/branches.js
var Xr = class {
	anchor;
	#e = /* @__PURE__ */ new Map();
	#t = /* @__PURE__ */ new Map();
	#n = /* @__PURE__ */ new Map();
	#r = /* @__PURE__ */ new Set();
	#i = !0;
	constructor(e, t = !0) {
		this.anchor = e, this.#i = t;
	}
	#a = (e) => {
		if (this.#e.has(e)) {
			var t = this.#e.get(e), n = this.#t.get(t);
			if (n) Bn(n), this.#r.delete(t);
			else {
				var r = this.#n.get(t);
				r && (Bn(r.effect), this.#t.set(t, r.effect), this.#n.delete(t), r.fragment.lastChild.remove(), this.anchor.before(r.fragment), n = r.effect);
			}
			for (let [t, n] of this.#e) {
				if (this.#e.delete(t), t === e) break;
				let r = this.#n.get(n);
				r && (Fn(r.effect), this.#n.delete(n));
			}
			for (let [e, r] of this.#t) {
				if (e === t || this.#r.has(e)) continue;
				let i = () => {
					if (Array.from(this.#e.values()).includes(e)) {
						var t = document.createDocumentFragment();
						Hn(r, t), t.append(ln()), this.#n.set(e, {
							effect: r,
							fragment: t
						});
					} else Fn(r);
					this.#r.delete(e), this.#t.delete(e);
				};
				this.#i || !n ? (this.#r.add(e), Rn(r, i, !1)) : i();
			}
		}
	};
	#o = (e) => {
		this.#e.delete(e);
		let t = Array.from(this.#e.values());
		for (let [e, n] of this.#n) t.includes(e) || (Fn(n.effect), this.#n.delete(e));
	};
	ensure(e, t) {
		var n = Dt, r = pn();
		if (t && !this.#t.has(e) && !this.#n.has(e)) {
			if (r) {
				var i = document.createDocumentFragment(), a = ln();
				i.append(a), this.#n.set(e, {
					effect: jn(() => t(a)),
					fragment: i
				});
			} else this.#t.set(e, jn(() => t(this.anchor)));
		}
		if (this.#e.set(n, e), r) {
			for (let [t, r] of this.#t) t === e ? n.unskip_effect(r) : n.skip_effect(r);
			for (let [t, r] of this.#n) t === e ? n.unskip_effect(r.effect) : n.skip_effect(r.effect);
			n.oncommit(this.#a), n.ondiscard(this.#o);
		} else A && (this.anchor = j), this.#a(n);
	}
};
//#endregion
//#region node_modules/svelte/src/internal/client/dom/blocks/if.js
function q(e, t, n = !1) {
	var r;
	A && (r = j, be());
	var i = new Xr(e), a = n ? S : 0;
	function o(e, t) {
		if (A) {
			var n = Ce(r);
			if (e !== parseInt(n.substring(1))) {
				var a = Se();
				ye(a), i.anchor = a, ve(!1), i.ensure(e, t), ve(!0);
				return;
			}
		}
		i.ensure(e, t);
	}
	An(() => {
		var e = !1;
		t((t, n = 0) => {
			e = !0, o(n, t);
		}), e || o(-1, null);
	}, a);
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/blocks/key.js
var Zr = Symbol("NaN");
function Qr(e, t, n) {
	A && be();
	var r = new Xr(e), i = !Ue();
	An(() => {
		var e = t();
		e !== e && (e = Zr), i && typeof e == "object" && e && (e = {}), r.ensure(e, n);
	});
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/blocks/each.js
function $r(e, t) {
	return t;
}
function ei(e, t, n) {
	for (var i = [], a = t.length, o, s = t.length, c = 0; c < a; c++) {
		let n = t[c];
		Rn(n, () => {
			if (o) {
				if (o.pending.delete(n), o.done.add(n), o.pending.size === 0) {
					var t = e.outrogroups;
					ti(e, r(o.done)), t.delete(o), t.size === 0 && (e.outrogroups = null);
				}
			} else --s;
		}, !1);
	}
	if (s === 0) {
		var l = i.length === 0 && n !== null && e.pending.size === 0;
		if (l) {
			var u = n, d = u.parentNode;
			fn(d), d.append(u), e.items.clear();
		}
		ti(e, t, !l);
	} else o = {
		pending: new Set(t),
		done: /* @__PURE__ */ new Set()
	}, (e.outrogroups ??= /* @__PURE__ */ new Set()).add(o);
}
function ti(e, t, n = !0) {
	var r;
	if (e.pending.size > 0) {
		r = /* @__PURE__ */ new Set();
		for (let t of e.pending.values()) for (let n of t) r.add(e.items.get(n).e);
	}
	for (var i = 0; i < t.length; i++) {
		var a = t[i];
		r?.has(a) ? (a.f |= ee, Hn(a, document.createDocumentFragment())) : Fn(t[i], n);
	}
}
var ni;
function J(t, n, i, a, o, s = null) {
	var c = t, l = /* @__PURE__ */ new Map();
	if (n & 4) {
		var u = t;
		c = A ? ye(/* @__PURE__ */ un(u)) : u.appendChild(ln());
	}
	A && be();
	var d = null, f = /* @__PURE__ */ bt(() => {
		var t = i();
		return e(t) ? t : t == null ? [] : r(t);
	}), p, m = /* @__PURE__ */ new Map(), h = !0;
	function g(e) {
		v.effect.f & 16384 || (v.pending.delete(e), v.fallback = d, ii(v, p, c, n, a), d !== null && (p.length === 0 ? d.f & 33554432 ? (d.f ^= ee, oi(d, null, c)) : Bn(d) : Rn(d, () => {
			d = null;
		})));
	}
	function _(e) {
		v.pending.delete(e);
	}
	var v = {
		effect: An(() => {
			p = H(f);
			var e = p.length;
			let t = !1;
			A && Ce(c) === "[!" != (e === 0) && (c = Se(), ye(c), ve(!1), t = !0);
			for (var r = /* @__PURE__ */ new Set(), u = Dt, v = pn(), y = 0; y < e; y += 1) {
				A && j.nodeType === 8 && j.data === "]" && (c = j, t = !0, ve(!1));
				var b = p[y], x = a(b, y), S = h ? null : l.get(x);
				S ? (S.v && Xt(S.v, b), S.i && Xt(S.i, y), v && u.unskip_effect(S.e)) : (S = ai(l, h ? c : ni ??= ln(), b, x, y, o, n, i), h || (S.e.f |= ee), l.set(x, S)), r.add(x);
			}
			if (e === 0 && s && !d && (h ? d = jn(() => s(c)) : (d = jn(() => s(ni ??= ln())), d.f |= ee)), e > r.size && ke("", "", ""), A && e > 0 && ye(Se()), !h) {
				if (m.set(u, r), v) {
					for (let [e, t] of l) r.has(e) || u.skip_effect(t.e);
					u.oncommit(g), u.ondiscard(_);
				} else g(u);
			}
			t && ve(!0), H(f);
		}),
		flags: n,
		items: l,
		pending: m,
		outrogroups: null,
		fallback: d
	};
	h = !1, A && (c = j);
}
function ri(e) {
	for (; e !== null && !(e.f & 32);) e = e.next;
	return e;
}
function ii(e, t, n, i, a) {
	var o = !!(i & 8), s = t.length, c = e.items, l = ri(e.effect.first), u, d = null, f, p = [], m = [], h, g, _, v;
	if (o) for (v = 0; v < s; v += 1) h = t[v], g = a(h, v), _ = c.get(g).e, _.f & 33554432 || (_.nodes?.a?.measure(), (f ??= /* @__PURE__ */ new Set()).add(_));
	for (v = 0; v < s; v += 1) {
		if (h = t[v], g = a(h, v), _ = c.get(g).e, e.outrogroups !== null) for (let t of e.outrogroups) t.pending.delete(_), t.done.delete(_);
		if (_.f & 8192 && (Bn(_), o && (_.nodes?.a?.unfix(), (f ??= /* @__PURE__ */ new Set()).delete(_))), _.f & 33554432) {
			if (_.f ^= ee, _ === l) oi(_, null, n);
			else {
				var y = d ? d.next : l;
				_ === e.effect.last && (e.effect.last = _.prev), _.prev && (_.prev.next = _.next), _.next && (_.next.prev = _.prev), si(e, d, _), si(e, _, y), oi(_, y, n), d = _, p = [], m = [], l = ri(d.next);
				continue;
			}
		}
		if (_ !== l) {
			if (u !== void 0 && u.has(_)) {
				if (p.length < m.length) {
					var b = m[0], x;
					d = b.prev;
					var S = p[0], C = p[p.length - 1];
					for (x = 0; x < p.length; x += 1) oi(p[x], b, n);
					for (x = 0; x < m.length; x += 1) u.delete(m[x]);
					si(e, S.prev, C.next), si(e, d, S), si(e, C, b), l = b, d = C, --v, p = [], m = [];
				} else u.delete(_), oi(_, l, n), si(e, _.prev, _.next), si(e, _, d === null ? e.effect.first : d.next), si(e, d, _), d = _;
				continue;
			}
			for (p = [], m = []; l !== null && l !== _;) (u ??= /* @__PURE__ */ new Set()).add(l), m.push(l), l = ri(l.next);
			if (l === null) continue;
		}
		_.f & 33554432 || p.push(_), d = _, l = ri(_.next);
	}
	if (e.outrogroups !== null) {
		for (let t of e.outrogroups) t.pending.size === 0 && (ti(e, r(t.done)), e.outrogroups?.delete(t));
		e.outrogroups.size === 0 && (e.outrogroups = null);
	}
	if (l !== null || u !== void 0) {
		var w = [];
		if (u !== void 0) for (_ of u) _.f & 8192 || w.push(_);
		for (; l !== null;) !(l.f & 8192) && l !== e.fallback && w.push(l), l = ri(l.next);
		var T = w.length;
		if (T > 0) {
			var E = i & 4 && s === 0 ? n : null;
			if (o) {
				for (v = 0; v < T; v += 1) w[v].nodes?.a?.measure();
				for (v = 0; v < T; v += 1) w[v].nodes?.a?.fix();
			}
			ei(e, w, E);
		}
	}
	o && Ke(() => {
		if (f !== void 0) for (_ of f) _.nodes?.a?.apply();
	});
}
function ai(e, t, n, r, i, a, o, s) {
	var c = o & 1 ? o & 16 ? Jt(n) : /* @__PURE__ */ Yt(n, !1, !1) : null, l = o & 2 ? Jt(i) : null;
	return {
		v: c,
		i: l,
		e: jn(() => (a(t, c ?? n, l ?? i, s), () => {
			e.delete(r);
		}))
	};
}
function oi(e, t, n) {
	if (e.nodes) for (var r = e.nodes.start, i = e.nodes.end, a = t && !(t.f & 33554432) ? t.nodes.start : n; r !== null;) {
		var o = /* @__PURE__ */ dn(r);
		if (a.before(r), r === i) return;
		r = o;
	}
}
function si(e, t, n) {
	t === null ? e.effect.first = n : t.next = n, n === null ? e.effect.last = t : n.prev = t;
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/blocks/snippet.js
function ci(e, t, ...n) {
	var r = new Xr(e);
	An(() => {
		let e = t() ?? null;
		r.ensure(e, e && ((t) => e(t, ...n)));
	}, S);
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/css.js
function li(e, t) {
	Dn(() => {
		e = Xn?.parent?.nodes?.start ?? e;
		var n = e.getRootNode(), r = n.host ? n : n.head ?? n.ownerDocument.head;
		if (!r.querySelector("#" + t.hash)) {
			let e = mn("style");
			e.id = t.hash, e.textContent = t.code, r.appendChild(e);
		}
	});
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/elements/actions.js
function ui(e, t, n) {
	Dn(() => {
		var r = yr(() => t(e, n?.()) || {});
		if (n && r?.update) {
			var i = !1, a = {};
			kn(() => {
				var e = n();
				br(e), i && Te(a, e) && (a = e, r.update(e));
			}), i = !0;
		}
		if (r?.destroy) return () => r.destroy();
	});
}
//#endregion
//#region node_modules/svelte/src/internal/shared/attributes.js
var di = [..." 	\n\r\f\xA0\v﻿"];
function fi(e, t, n) {
	var r = e == null ? "" : "" + e;
	if (t && (r = r ? r + " " + t : t), n) {
		for (var i of Object.keys(n)) if (n[i]) r = r ? r + " " + i : i;
		else if (r.length) for (var a = i.length, o = 0; (o = r.indexOf(i, o)) >= 0;) {
			var s = o + a;
			(o === 0 || di.includes(r[o - 1])) && (s === r.length || di.includes(r[s])) ? r = (o === 0 ? "" : r.substring(0, o)) + r.substring(s + 1) : o = s;
		}
	}
	return r === "" ? null : r;
}
function pi(e, t = !1) {
	var n = t ? " !important;" : ";", r = "";
	for (var i of Object.keys(e)) {
		var a = e[i];
		a != null && a !== "" && (r += " " + i + ": " + a + n);
	}
	return r;
}
function mi(e) {
	return e[0] !== "-" || e[1] !== "-" ? e.toLowerCase() : e;
}
function hi(e, t) {
	if (t) {
		var n = "", r, i;
		if (Array.isArray(t) ? (r = t[0], i = t[1]) : r = t, e) {
			e = String(e).replaceAll(/\/\*.*?\*\//g, "").trim();
			var a = !1, o = 0, s = !1, c = [];
			r && c.push(...Object.keys(r).map(mi)), i && c.push(...Object.keys(i).map(mi));
			var l = 0, u = -1;
			let t = e.length;
			for (var d = 0; d < t; d++) {
				var f = e[d];
				if (s ? f === "/" && e[d - 1] === "*" && (s = !1) : a ? a === f && (a = !1) : f === "/" && e[d + 1] === "*" ? s = !0 : f === "\"" || f === "'" ? a = f : f === "(" ? o++ : f === ")" && o--, !s && a === !1 && o === 0) {
					if (f === ":" && u === -1) u = d;
					else if (f === ";" || d === t - 1) {
						if (u !== -1) {
							var p = mi(e.substring(l, u).trim());
							if (!c.includes(p)) {
								f !== ";" && d++;
								var m = e.substring(l, d).trim();
								n += " " + m + ";";
							}
						}
						l = d + 1, u = -1;
					}
				}
			}
		}
		return r && (n += pi(r)), i && (n += pi(i, !0)), n = n.trim(), n === "" ? null : n;
	}
	return e == null ? null : String(e);
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/elements/class.js
function gi(e, t, n, r, i, a) {
	var o = e[ae];
	if (A || o !== n || o === void 0) {
		var s = fi(n, r, a);
		(!A || s !== e.getAttribute("class")) && (s == null ? e.removeAttribute("class") : t ? e.className = s : e.setAttribute("class", s)), e[ae] = n;
	} else if (a && i !== a) for (var c in a) {
		var l = !!a[c];
		(i == null || l !== !!i[c]) && e.classList.toggle(c, l);
	}
	return a;
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/elements/style.js
function _i(e, t = {}, n, r) {
	for (var i in n) {
		var a = n[i];
		t[i] !== a && (n[i] == null ? e.style.removeProperty(i) : e.style.setProperty(i, a, r));
	}
}
function vi(e, t, n, r) {
	var i = e[oe];
	if (A || i !== t) {
		var a = hi(t, r);
		(!A || a !== e.getAttribute("style")) && (a == null ? e.removeAttribute("style") : e.style.cssText = a), e[oe] = t;
	} else r && (Array.isArray(r) ? (_i(e, n?.[0], r[0]), _i(e, n?.[1], r[1], "important")) : _i(e, n, r));
	return r;
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/elements/bindings/select.js
function yi(e, t) {
	t ? e.hasAttribute("selected") || e.setAttribute("selected", "") : e.removeAttribute("selected");
}
function bi(t, n) {
	var r = t.__defaultValue, i = t.multiple, a = i ? r ?? [] : null;
	if (!i || e(a)) {
		var o = t.selectedIndex, s = n && i ? new Set(t.selectedOptions) : null;
		for (var c of t.options) {
			var l = wi(c);
			yi(c, i ? a.includes(l) : nn(l, r));
		}
		if (n) {
			if (s !== null) for (c of t.options) {
				var u = s.has(c);
				c.selected !== u && (c.selected = u);
			}
			else t.selectedIndex !== o && (t.selectedIndex = o);
		}
	}
}
function xi(t, n, r = !1) {
	if (t.multiple) {
		if (n == null) return;
		if (!e(n)) return ge();
		for (var i of t.options) i.selected = n.includes(wi(i));
		return;
	}
	for (i of t.options) if (nn(wi(i), n)) {
		i.selected = !0;
		return;
	}
	(!r || n !== void 0) && (t.selectedIndex = -1);
}
function Si(e) {
	var t = new MutationObserver((t) => {
		t.every(Ti) || ("__defaultValue" in e && bi(e, !1), "__value" in e && xi(e, e.__value));
	});
	t.observe(e, {
		childList: !0,
		subtree: !0,
		attributes: !0,
		attributeFilter: ["value"]
	}), Sn(() => {
		t.disconnect();
	});
}
function Ci(e, t, n = t) {
	var r = /* @__PURE__ */ new WeakSet(), i = !0;
	ft(e, "change", (t) => {
		var i = t ? "[selected]" : ":checked", a;
		if (e.multiple) a = [].map.call(e.querySelectorAll(i), wi);
		else {
			var o = e.querySelector(i) ?? e.querySelector("option:not([disabled])");
			a = o && wi(o);
		}
		n(a), e.__value = a, Dt !== null && r.add(Dt);
	}), Dn(() => {
		var a = t();
		if (e === document.activeElement) {
			var o = Dt;
			if (r.has(o)) return;
		}
		if (xi(e, a, i), i && a === void 0) {
			var s = e.querySelector(":checked");
			s !== null && (a = wi(s), n(a));
		}
		e.__value = a, i = !1;
	});
}
function wi(e) {
	return "__value" in e ? e.__value : e.value;
}
function Ti(e) {
	if (e.target.closest("selectedcontent") !== null) return !0;
	if (e.type === "childList") {
		var t = [...e.addedNodes, ...e.removedNodes];
		return t.length > 0 && t.every((e) => e.nodeName === "SELECTEDCONTENT");
	}
	return !1;
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/elements/attributes.js
var Ei = Symbol("is custom element"), Di = Symbol("is html"), Oi = ue ? "link" : "LINK";
function ki(e) {
	if (A) {
		var t = !1, n = () => {
			if (!t) {
				if (t = !0, e.hasAttribute("value")) {
					var n = e.value;
					Y(e, "value", null), e.value = n;
				}
				if (e.hasAttribute("checked")) {
					var r = e.checked;
					Y(e, "checked", null), e.checked = r;
				}
			}
		};
		e[ce] = n, Ke(n), ut();
	}
}
function Y(e, t, n, r) {
	var i = Ai(e);
	A && (i[t] = e.getAttribute(t), t === "src" || t === "srcset" || t === "href" && e.nodeName === Oi) || i[t] !== (i[t] = n) && (t === "loading" && (e[re] = n), n == null ? e.removeAttribute(t) : typeof n != "string" && Mi(e).has(t) ? e[t] = n : e.setAttribute(t, n));
}
function Ai(e) {
	return e[ie] ??= {
		[Ei]: e.nodeName.includes("-"),
		[Di]: e.namespaceURI === pe
	};
}
var ji = /* @__PURE__ */ new Map();
function Mi(e) {
	var t = e.getAttribute("is") || e.nodeName, n = ji.get(t);
	if (n) return n;
	ji.set(t, n = /* @__PURE__ */ new Set());
	for (var r, i = e, a = Element.prototype; a !== i;) {
		for (var s in r = o(i), r) r[s].set && s !== "innerHTML" && s !== "textContent" && s !== "innerText" && n.add(s);
		i = l(i);
	}
	return n;
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/elements/bindings/input.js
function Ni(e, t, n = t) {
	var r = /* @__PURE__ */ new WeakSet();
	ft(e, "input", async (i) => {
		var a = i ? e.defaultValue : e.value;
		if (a = Pi(e) ? Fi(a) : a, n(a), Dt !== null && r.add(Dt), await gr(), a !== (a = t())) {
			var o = e.selectionStart, s = e.selectionEnd, c = e.value.length;
			if (e.value = a ?? "", s !== null) {
				var l = e.value.length;
				o === s && s === c && l > c ? (e.selectionStart = l, e.selectionEnd = l) : (e.selectionStart = o, e.selectionEnd = Math.min(s, l));
			}
		}
	}), (A && e.defaultValue !== e.value || yr(t) == null && e.value) && (n(Pi(e) ? Fi(e.value) : e.value), Dt !== null && r.add(Dt)), kn(() => {
		var n = t();
		if (e === document.activeElement) {
			var i = Dt;
			if (r.has(i)) return;
		}
		Pi(e) && n === Fi(e.value) || (e.type !== "date" || n || e.value) && n !== e.value && (e.value = n ?? "");
	});
}
function Pi(e) {
	var t = e.type;
	return t === "number" || t === "range";
}
function Fi(e) {
	return e === "" ? null : +e;
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/elements/bindings/this.js
function Ii(e, t) {
	return e === t || e?.[O] === t;
}
function Li(e = He(), t, n, r) {
	var i = Re.r, a = Xn;
	return Dn(() => {
		var o, s;
		return kn(() => {
			o = s, s = r?.() || [], yr(() => {
				Ii(n(...s), e) || (t(e, ...s), o && Ii(n(...o), e) && t(null, ...o));
			});
		}), () => {
			let r = a;
			for (; r !== i && r.parent !== null && r.parent.f & 33554432;) r = r.parent;
			let o = () => {
				s && Ii(n(...s), e) && t(null, ...s);
			}, c = r.teardown;
			r.teardown = () => {
				o(), c?.();
			};
		};
	}), e;
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/elements/bindings/universal.js
function Ri(e, t, n, r, i) {
	var a = () => {
		r(n[e]);
	};
	n.addEventListener(t, a), i ? kn(() => {
		n[e] = i();
	}) : a(), (n === document.body || n === window || n === document) && Sn(() => {
		n.removeEventListener(t, a);
	});
}
//#endregion
//#region node_modules/svelte/src/internal/client/reactivity/props.js
function X(e, t, n, r) {
	var i = !0, o = !!(n & 8), s = !!(n & 16), c = r, l = !0, u = void 0, d = () => s && i ? (u ??= /* @__PURE__ */ _t(r), H(u)) : (l && (l = !1, c = s ? yr(r) : r), c);
	let f;
	if (o) {
		var p = O in e || ne in e;
		f = a(e, t)?.set ?? (p && t in e ? (n) => e[t] = n : void 0);
	}
	var m, h = !1;
	o ? [m, h] = ct(() => e[t]) : m = e[t], m === void 0 && r !== void 0 && (m = d(), f && (i && Pe(t), f(m)));
	var g = i ? () => {
		var n = e[t];
		return n === void 0 ? d() : (l = !0, n);
	} : () => {
		var n = e[t];
		return n !== void 0 && (c = void 0), n === void 0 ? c : n;
	};
	if (i && !(n & 4)) return g;
	if (f) {
		var _ = e.$$legacy;
		return (function(e, t) {
			return arguments.length > 0 ? ((!i || !t || _ || h) && f(t ? g() : e), e) : g();
		});
	}
	var v = !1, y = (n & 1 ? _t : bt)(() => (v = !1, g()));
	o && H(y);
	var b = Xn;
	return (function(e, t) {
		if (arguments.length > 0) {
			let n = t ? H(y) : i && o ? en(e) : e;
			return I(y, n), v = !0, c !== void 0 && (c = n), e;
		}
		return Gn && v || b.f & 16384 ? y.v : H(y);
	});
}
function zi(e) {
	Re === null && De("onMount"), Cn(() => {
		let t = yr(e);
		if (typeof t == "function") return t;
	});
}
function Bi(e) {
	Re === null && De("onDestroy"), zi(() => () => yr(e));
}
//#endregion
//#region node_modules/svelte/src/internal/disclose-version.js
typeof window < "u" && ((window.__svelte ??= {}).v ??= /* @__PURE__ */ new Set()).add("5");
//#endregion
//#region src/lib/dom-root.ts
function Vi(e) {
	let t = e?.getRootNode();
	return t instanceof Document || t instanceof ShadowRoot ? t : e?.ownerDocument ?? document;
}
//#endregion
//#region src/lib/state/inspector-sections.ts
function Hi() {
	return {
		preview: !1,
		expandedPreview: !1,
		basis: !1,
		diagnostics: !1,
		identifiers: !1,
		changes: !1,
		usage: !1,
		estimator: !1
	};
}
function Ui(e, t) {
	e.open = t.state[t.key];
	let n = () => {
		t.state[t.key] = e.open;
	};
	return e.addEventListener("toggle", n), {
		update(n) {
			(n.state !== t.state || n.key !== t.key) && (t = n, e.open = t.state[t.key]);
		},
		destroy() {
			t.state[t.key] = e.open, e.removeEventListener("toggle", n);
		}
	};
}
//#endregion
//#region src/lib/state/presentation-preferences.ts
var Wi = "highwater.presentation.v1";
function Gi() {
	return {
		version: 1,
		river: {
			verticalScale: "session",
			display: "items"
		},
		economics: {
			expanded: !1,
			lastMode: "cache",
			cacheView: "tokens"
		}
	};
}
var Ki = () => typeof window > "u" ? null : window.localStorage, qi = (e) => typeof e == "object" && !!e && !Array.isArray(e);
function Ji(e, t = Gi()) {
	let n = {
		version: 1,
		river: { ...t.river },
		economics: { ...t.economics }
	};
	if (!e || e.length > 4096) return n;
	try {
		let t = JSON.parse(e);
		if (!qi(t) || t.version !== 1) return n;
		qi(t.river) && ((t.river.verticalScale === "session" || t.river.verticalScale === "visible") && (n.river.verticalScale = t.river.verticalScale), (t.river.display === "items" || t.river.display === "itemTypes") && (n.river.display = t.river.display)), qi(t.economics) && (typeof t.economics.expanded == "boolean" && (n.economics.expanded = t.economics.expanded), (t.economics.lastMode === "cache" || t.economics.lastMode === "cost") && (n.economics.lastMode = t.economics.lastMode), (t.economics.cacheView === "tokens" || t.economics.cacheView === "share") && (n.economics.cacheView = t.economics.cacheView));
	} catch {}
	return n;
}
function Yi(e = Ki, t = Wi, n = Gi()) {
	try {
		return Ji(e()?.getItem(t) ?? null, n);
	} catch {
		return Ji(null, n);
	}
}
function Xi(e, t = Ki, n = Wi) {
	try {
		t()?.setItem(n, JSON.stringify(Ji(JSON.stringify(e))));
	} catch {}
}
//#endregion
//#region src/lib/state/interaction.ts
var Zi = {
	hoveredCallIndex: null,
	pinnedCallIndex: null,
	hoveredItemId: null,
	selectedItemId: null
};
function Qi() {
	return { ...Zi };
}
function $i(e) {
	return e.selectedItemId === null ? e.pinnedCallIndex === null ? e : {
		...e,
		pinnedCallIndex: null
	} : {
		...e,
		selectedItemId: null
	};
}
function ea(e, t, n) {
	if (e === null) return null;
	let r = t.callByIndex.get(e);
	if (!r || t.analysis.modelCalls.filter((e) => e.sourceRecordId === r.sourceRecordId).length !== 1) return null;
	let i = n.analysis.modelCalls.filter((e) => e.sourceRecordId === r.sourceRecordId);
	return i.length === 1 ? i[0].index : null;
}
function ta(e, t, n) {
	return {
		...e,
		pinnedCallIndex: ea(e.pinnedCallIndex, t, n),
		hoveredCallIndex: ea(e.hoveredCallIndex, t, n),
		hoveredItemId: e.hoveredItemId !== null && n.itemById.has(e.hoveredItemId) ? e.hoveredItemId : null,
		selectedItemId: e.selectedItemId !== null && n.itemById.has(e.selectedItemId) ? e.selectedItemId : null
	};
}
//#endregion
//#region src/lib/context-river/viewport.ts
function na(e, t, n, r) {
	if (!n.ready || e.length === 0) return null;
	if (t === null && n.isFitAll) return r === 1 ? e[0] : null;
	let i = t ?? n.centerCallIndex, a = i == null ? -1 : e.indexOf(i);
	return a < 0 ? null : e[a + r] ?? null;
}
function ra(e, t, n, r) {
	let i = n * .15, a = e - t;
	return ia(a < i ? e - i : a > n - i ? e - n + i : t, r, n);
}
function ia(e, t, n) {
	let r = Number.isFinite(t) ? Math.max(0, t) : 0, i = Number.isFinite(n) ? Math.max(0, n) : 0;
	return Math.min(Math.max(0, Number.isFinite(e) ? e : 0), Math.max(0, r - i));
}
function aa(e, t, n, r = 0) {
	if (e.length === 0 || !Number.isFinite(n) || n <= 0) return {
		firstVisibleCallIndex: null,
		lastVisibleCallIndex: null
	};
	let i = t - r, a = i + n, o = e.filter((e) => Number.isFinite(e.x) && e.x >= i && e.x <= a).sort((e, t) => e.x - t.x);
	return {
		firstVisibleCallIndex: o[0]?.callIndex ?? null,
		lastVisibleCallIndex: o[o.length - 1]?.callIndex ?? null
	};
}
function oa(e, t) {
	return ia(e, e, t);
}
function sa(e, t, n, r = 0) {
	if (e.length === 0) return null;
	let i = t - r, a = e.filter((e) => Number.isFinite(e.x)).sort((e, t) => e.x - t.x);
	if (a.length === 0) return null;
	let o = a.find((e) => e.x >= i) ?? a[a.length - 1];
	return o ? {
		callIndex: o.callIndex,
		sourceRecordId: o.sourceRecordId ?? null,
		offsetFromViewportLeft: r + o.x - t
	} : null;
}
function ca(e, t, n, r, i = 0) {
	let a = (e.sourceRecordId ? t.find((t) => t.sourceRecordId === e.sourceRecordId) : void 0) ?? t.find((t) => t.callIndex === e.callIndex);
	if (!a || !Number.isFinite(n)) return null;
	let o = e.nextSourceRecordId ? t.find((t) => t.sourceRecordId === e.nextSourceRecordId) : e.nextCallIndex === void 0 ? void 0 : t.find((t) => t.callIndex === e.nextCallIndex), s = Number.isFinite(e.fractionToNext) ? Math.min(1, Math.max(0, e.fractionToNext)) : 0;
	return ia(i + (o && Number.isFinite(o.x) ? a.x + (o.x - a.x) * s : a.x) - e.offsetFromViewportLeft, r, n);
}
function la(e, t) {
	if (t.length === 0 || e.trim() === "") return null;
	let n = Number(e);
	if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
	let r = [...t].filter(Number.isFinite).sort((e, t) => e - t);
	if (r.length === 0) return null;
	let i = Math.min(Math.max(n, r[0]), r[r.length - 1]);
	return r.reduce((e, t) => Math.abs(t - i) < Math.abs(e - i) ? t : e);
}
//#endregion
//#region src/lib/state/view-link.ts
function ua(e, t) {
	if (!e.ready || e.isFitAll || t.length === 0) return null;
	if (e.firstVisibleCallIndex !== null && e.lastVisibleCallIndex !== null) return [e.firstVisibleCallIndex, e.lastVisibleCallIndex];
	let n = t.indexOf(e.centerCallIndex ?? -1);
	return n < 0 ? null : [t[Math.max(0, n - 1)], t[Math.min(t.length - 1, n + 1)]];
}
//#endregion
//#region src/lib/token-estimate.ts
var da = {
	"ctok-claude-v3": "Claude 3 to Opus 4.6",
	"ctok-claude-v4.7": "Claude Opus 4.7",
	"ctok-claude-v4.8": "Claude Opus 4.8 and later"
};
function fa(e) {
	let t = e ? da[e.tokenizerFamily] : void 0;
	return !e || !t ? null : e.rule === "assumed-latest-claude-ctok" ? `Reconstructed tokenizer (ctok) for the newest measured generation, ${t}; this model has not been measured` : `Reconstructed tokenizer (ctok) for ${t}`;
}
var pa = {
	modelTokenizer: "Model tokenizer",
	apiSerializationEstimate: "Estimated API serialization",
	characterHeuristic: "Character heuristic",
	reportedUsage: "From reported usage"
};
function ma(e, t = "Unavailable estimate method") {
	return e && pa[e] || t;
}
//#endregion
//#region src/lib/components/InfoPopover.svelte
var ha = /* @__PURE__ */ W("<span class=\"info svelte-jsd3h9\" role=\"presentation\"><button type=\"button\" class=\"info-trigger svelte-jsd3h9\">i</button> <div role=\"note\"><!></div></span>"), ga = {
	hash: "svelte-jsd3h9",
	code: ".info.svelte-jsd3h9 {display:inline-flex;vertical-align:middle;}.info-trigger.svelte-jsd3h9 {display:inline-grid;place-items:center;width:16px;height:16px;margin-left:5px;padding:0;border:1px solid var(--control-border);border-radius:50%;color:var(--secondary);background:transparent;font:italic 600 10px/1 Georgia,\n      serif;cursor:pointer;}.info-trigger.svelte-jsd3h9:hover,\n  .info-trigger[aria-expanded='true'].svelte-jsd3h9 {color:var(--text);background:var(--surface-raised);}.info-popover.svelte-jsd3h9 {position:fixed;z-index:20;left:0;top:0;box-sizing:border-box;width:min(320px, calc(100vw - 24px));padding:10px 12px;border:1px solid var(--control-border);border-radius:var(--radius);background:var(--surface);color:var(--text);box-shadow:0 10px 28px var(--shadow-strong);font-size:var(--text-sm);font-weight:normal;text-align:left;white-space:normal;}.info-popover[hidden].svelte-jsd3h9 {display:none;}.info-popover.placing.svelte-jsd3h9 {visibility:hidden;}"
};
function _a(e, t) {
	Be(t, !0), li(e, ga);
	let n = /* @__PURE__ */ F(null), r = /* @__PURE__ */ F(null), i = /* @__PURE__ */ F(""), a = /* @__PURE__ */ F(!1), o = /* @__PURE__ */ F(!1);
	function s() {
		if (!H(a) || !H(n) || !H(r)) return;
		let e = H(r).offsetWidth, t = H(r).offsetHeight, s = H(n).getBoundingClientRect(), c = Math.max(12, Math.min(s.left - 8, window.innerWidth - e - 12)), l = s.bottom + 6, u = l + t <= window.innerHeight - 12 ? l : Math.max(12, s.top - t - 6);
		I(i, `left:${Math.round(c)}px;top:${Math.round(u)}px`), I(o, !0);
	}
	async function c() {
		I(o, !1), I(a, !0), await gr(), s();
	}
	function l(e) {
		H(a) && (I(a, !1), I(o, !1), e && H(n)?.focus());
	}
	function u(e) {
		e.key === "Escape" && H(a) && (e.preventDefault(), e.stopPropagation(), l(!0));
	}
	function f(e) {
		let t = e.target;
		t instanceof Node && (H(n)?.contains(t) || H(r)?.contains(t) || l(!1));
	}
	var p = ha();
	Or("resize", rn, s), Or("scroll", rn, s), Or("pointerdown", rn, f);
	var m = L(p);
	Li(m, (e) => I(n, e), () => H(n));
	var h = B(m, 2);
	let g;
	ci(L(h), () => t.children ?? d), M(h), Li(h, (e) => I(r, e), () => H(r)), M(p), V(() => {
		Y(m, "aria-label", t.label), Y(m, "aria-expanded", H(a)), Y(m, "aria-controls", t.id), Y(h, "id", t.id), g = gi(h, 1, "info-popover svelte-jsd3h9", null, g, { placing: !H(o) }), Y(h, "hidden", !H(a)), vi(h, H(i));
	}), U("keydown", p, u), U("click", m, () => H(a) ? l(!0) : c()), G(e, p), Ve();
}
kr(["keydown", "click"]);
var va = {
	dark: {
		id: "dark",
		label: "Dark",
		colorScheme: "dark",
		tokens: {
			page: "#11171c",
			surface: "#161e24",
			plot: "#131b21",
			text: "#e5edf0",
			secondary: "#a5b4be",
			separator: "#2b3942",
			"control-border": "#607581",
			accent: "#9cd8c5",
			action: "#253f39",
			warning: "#ffd28d",
			error: "#ffc0ae",
			"text-strong": "#f4f8f9",
			muted: "#8b9aa4",
			"surface-raised": "#1d272e",
			"selected-surface": "#22333a",
			"chart-guide": "#1e2a31",
			"warning-surface": "#2a2415",
			"warning-border": "#7d6840",
			"error-surface": "#2a1c1f",
			"error-border": "#7d493f",
			compaction: "#ffb14e",
			"compaction-text": "#ffca87",
			"active-text": "#ffffff",
			selection: "#ffffff",
			"selection-soft": "#ffffff8c",
			"selection-focus": "#ffffffbf",
			"swatch-border": "#ffffff73",
			"presence-overlay": "#ffffff2e",
			shadow: "#00000059",
			"shadow-strong": "#00000080",
			"input-gap": "#aab4c7",
			"input-gap-base": "#8793aa",
			"unknown-fill": "#46516a",
			"unknown-mark": "#8793aa",
			"cache-read": "#428fdc",
			"cache-write": "#9167c7",
			"cache-write-mark": "#e0c9ff",
			"cache-fresh": "#277d68",
			"cache-fresh-mark": "#b5f6df",
			"cache-nonread": "#626e87",
			"cache-nonread-mark": "#aab5c9",
			cost: "#7ddbb7",
			"api-cost": "#b9a8ff",
			"event-warning": "#ffbd64",
			"event-success": "#80dcba",
			"event-target": "#aad3ef",
			"event-compaction-fill": "#4b3821",
			"event-compaction-text": "#ffffff",
			"event-warning-text": "#11171c",
			"event-success-text": "#11171c",
			"lifespan-version": "#728fc5"
		},
		itemTypes: {
			system: "#aab4c0",
			toolDefinition: "#e2957b",
			userMessage: "#7eafe3",
			assistantMessage: "#64c4af",
			toolResult: "#dab66c",
			compactionSummary: "#bba0e3",
			customMessage: "#da8faf",
			branchSummary: "#b8c879",
			thinking: "#9ad3e6",
			unrecordedContext: "#b5a58f",
			other: "#d9d4c9"
		},
		items: [
			"#8cacc9",
			"#83b8ac",
			"#c59b89",
			"#c5b080",
			"#b29fbd",
			"#bbb17d",
			"#80afbd",
			"#a1acbc",
			"#bf9bad",
			"#96b799"
		]
	},
	light: {
		id: "light",
		label: "Light",
		colorScheme: "light",
		tokens: {
			page: "#f1f5f6",
			surface: "#ffffff",
			plot: "#f8fafb",
			text: "#24343e",
			secondary: "#4b606d",
			separator: "#cbd5db",
			"control-border": "#788c97",
			accent: "#226953",
			action: "#d7eee5",
			warning: "#795000",
			error: "#a13727",
			"text-strong": "#132630",
			muted: "#576b77",
			"surface-raised": "#eaf0f3",
			"selected-surface": "#e1eee9",
			"chart-guide": "#e3eaee",
			"warning-surface": "#fff5df",
			"warning-border": "#9c7428",
			"error-surface": "#fff0ec",
			"error-border": "#af6252",
			compaction: "#9a5700",
			"compaction-text": "#855000",
			"active-text": "#153e30",
			selection: "#142c3c",
			"selection-soft": "#142c3cbf",
			"selection-focus": "#142c3c",
			"swatch-border": "#142c3c73",
			"presence-overlay": "#142c3c2e",
			shadow: "#183b4b26",
			"shadow-strong": "#183b4b38",
			"input-gap": "#586a82",
			"input-gap-base": "#61728a",
			"unknown-fill": "#d9dfeb",
			"unknown-mark": "#63738e",
			"cache-read": "#246db0",
			"cache-write": "#7850a9",
			"cache-write-mark": "#eadbff",
			"cache-fresh": "#236b58",
			"cache-fresh-mark": "#b5f6df",
			"cache-nonread": "#59657e",
			"cache-nonread-mark": "#d4ddeb",
			cost: "#216e50",
			"api-cost": "#7050ad",
			"event-warning": "#a35f00",
			"event-success": "#216e50",
			"event-target": "#316d9a",
			"event-compaction-fill": "#fff0d6",
			"event-compaction-text": "#704200",
			"event-warning-text": "#ffffff",
			"event-success-text": "#ffffff",
			"lifespan-version": "#436aa5"
		},
		itemTypes: {
			system: "#6c7f93",
			toolDefinition: "#cb643c",
			userMessage: "#3282d0",
			assistantMessage: "#11967d",
			toolResult: "#a57a05",
			compactionSummary: "#a865cc",
			customMessage: "#c45d97",
			branchSummary: "#82880a",
			thinking: "#168fa7",
			unrecordedContext: "#a27951",
			other: "#89816d"
		},
		items: [
			"#3783cf",
			"#159579",
			"#c5662e",
			"#a57a05",
			"#a865cc",
			"#82880a",
			"#168fa7",
			"#677ec0",
			"#c45d97",
			"#469331"
		]
	}
}, ya = Object.values(va).map((e) => e.id), ba = "highwater.theme.v1";
function xa(e, t) {
	if (!e || e.length > 256) return "system";
	try {
		let n = JSON.parse(e);
		return typeof n == "string" && (n === "system" || t.includes(n)) ? n : "system";
	} catch {
		return "system";
	}
}
function Sa(e, t) {
	return va[e === "system" ? t ? "dark" : "light" : e];
}
//#endregion
//#region src/lib/context-river/colors.ts
function Ca(e, t) {
	return t.itemTypes[e] ?? t.itemTypes.other;
}
function wa(e, t, n) {
	return n.items[e.itemColorSlotById.get(t) ?? 0] ?? n.items[0];
}
function Ta(e) {
	return ka("#11171c", e) >= ka("#ffffff", e) ? "#11171c" : "#ffffff";
}
function Ea(e) {
	let t = 2166136261;
	for (let n of e) t = Math.imul(t ^ (n.codePointAt(0) ?? 0), 16777619);
	return (t >>> 0) % 10;
}
function Da(e, t, n, r) {
	let i = new Map(t.map((e, t) => [e, t])), a = t.length, o = /* @__PURE__ */ new Set();
	for (let e of n.values()) for (let t = 1; t < e.length; t += 1) {
		let n = i.get(e[t - 1]), r = i.get(e[t]);
		n !== void 0 && r !== void 0 && o.add(Math.min(n, r) * a + Math.max(n, r));
	}
	let s = /* @__PURE__ */ new Map();
	for (let e of o) {
		let [n, r] = [t[Math.floor(e / a)], t[e % a]];
		for (let [e, t] of [[n, r], [r, n]]) {
			let n = s.get(e);
			n ? n.push(t) : s.set(e, [t]);
		}
	}
	let c = /* @__PURE__ */ new Map(), l = [...e].sort((e, t) => e.firstModelCall - t.firstModelCall || (i.get(e.id) ?? 0) - (i.get(t.id) ?? 0));
	for (let { id: e } of l) {
		let t = c.get(r.get(e) ?? "");
		if (t !== void 0) {
			c.set(e, t);
			continue;
		}
		let n = /* @__PURE__ */ new Map();
		for (let t of s.get(e) ?? []) {
			let e = c.get(t);
			e !== void 0 && n.set(e, (n.get(e) ?? 0) + 1);
		}
		let i = Ea(e), a = i;
		for (let e = 0, t = Infinity; e < 10 && t > 0; e += 1) {
			let r = (i + e) % 10, o = n.get(r) ?? 0;
			o < t && ([a, t] = [r, o]);
		}
		c.set(e, a);
	}
	return c;
}
function Oa(e) {
	let t = [
		1,
		3,
		5
	].map((t) => {
		let n = Number.parseInt(e.slice(t, t + 2), 16) / 255;
		return n <= .03928 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4;
	});
	return .2126 * t[0] + .7152 * t[1] + .0722 * t[2];
}
function ka(e, t) {
	let n = Math.max(Oa(e), Oa(t)), r = Math.min(Oa(e), Oa(t));
	return (n + .05) / (r + .05);
}
//#endregion
//#region src/lib/theme/controller.ts
function Aa() {
	let e = tt("system"), t = tt(va.dark), n = "system", r = null, i = null;
	function a() {
		let a = Sa(n, r?.matches ?? !0);
		e.set(n), t.set(a), i && (i.dataset.theme = a.id);
	}
	function o(e) {
		n = xa(JSON.stringify(e), ya), a();
		try {
			window.localStorage.setItem(ba, JSON.stringify(n));
		} catch {}
	}
	function s(e) {
		t.set(va[e]);
	}
	function c() {
		i = document.documentElement;
		let o = i.getAttribute("data-theme"), s = null;
		try {
			s = window.localStorage.getItem(ba);
		} catch {}
		n = xa(s, ya);
		try {
			r = window.matchMedia("(prefers-color-scheme: dark)");
		} catch {
			r = null;
		}
		let c = () => {
			n === "system" && a();
		};
		return r?.addEventListener("change", c), a(), () => {
			r?.removeEventListener("change", c), o === null ? i?.removeAttribute("data-theme") : i?.setAttribute("data-theme", o), i = null, r = null, n = "system", e.set(n), t.set(va.dark);
		};
	}
	return {
		preference: nt(e),
		palette: nt(t),
		setPreference: o,
		setPalette: s,
		start: c
	};
}
var ja = Aa(), Ma = ja.palette, Na = new Intl.NumberFormat(void 0, {
	notation: "compact",
	maximumFractionDigits: 1
}), Pa = new Intl.NumberFormat(), Fa = new Intl.NumberFormat(void 0, {
	style: "currency",
	currency: "USD",
	minimumSignificantDigits: 2,
	maximumSignificantDigits: 7
}), Ia = new Intl.NumberFormat(void 0, {
	style: "currency",
	currency: "USD",
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});
function Z(e) {
	return e == null ? "Unknown" : Na.format(e);
}
function Q(e) {
	return Pa.format(e);
}
var La = new Intl.NumberFormat(void 0, {
	style: "currency",
	currency: "USD",
	currencyDisplay: "narrowSymbol",
	maximumSignificantDigits: 2
});
function Ra(e) {
	return La.format(e);
}
function za(e) {
	return e == null ? "Unknown" : Fa.format(e);
}
function Ba(e) {
	return e == null ? "Unknown" : e >= .01 ? Ia.format(e) : za(e);
}
function Va(e) {
	return e == null ? "Unknown" : `${(e * 100).toFixed(+(e < .1))}%`;
}
function Ha(e) {
	return `${(e * 100).toFixed(1)}%`;
}
function Ua(e, t) {
	let n = t === "calculatedTokens" ? "calculated tokens" : t === "estimatedTokens" ? "estimated tokens" : t === "serializedBytes" ? "serialized bytes" : t === "unavailable" ? "unknown weight" : t;
	return `${Na.format(e)} ${n}`;
}
function Wa(e) {
	return e === "calculatedTokens" ? "calculated tokens" : e === "estimatedTokens" ? "estimated tokens" : e === "unavailable" ? "token geometry unavailable" : e;
}
function Ga(e, t) {
	return e === null ? "Unknown" : t === "serializedBytes" || t === "bytes" ? `${Na.format(e)} byte-calls` : `${Na.format(e)} token-turns`;
}
function Ka(e, t) {
	return `${Pa.format(e)} / ${Pa.format(t)}`;
}
//#endregion
//#region src/lib/components/CopyButton.svelte
var qa = /* @__PURE__ */ W("<span class=\"copy-control svelte-1kw4msz\"><button type=\"button\" class=\"svelte-1kw4msz\">Copy</button> <span class=\"copy-status svelte-1kw4msz\" role=\"status\"> </span></span>"), Ja = {
	hash: "svelte-1kw4msz",
	code: ".copy-control.svelte-1kw4msz {display:inline-flex;flex-wrap:wrap;align-items:center;gap:5px 8px;min-width:0;}button.svelte-1kw4msz {background:var(--surface);border:1px solid var(--separator);border-radius:var(--control-radius);color:var(--text);cursor:pointer;padding:3px 7px;font:inherit;font-size:var(--text-xs);}.copy-status.svelte-1kw4msz {color:var(--secondary);font-size:var(--text-xs);}"
};
function Ya(e, t) {
	Be(t, !0), li(e, Ja);
	let n = /* @__PURE__ */ F("");
	async function r() {
		try {
			let e = typeof navigator > "u" ? void 0 : navigator.clipboard;
			if (!e?.writeText) {
				I(n, `Clipboard is unavailable. Select the ${t.label} text and copy it manually.`);
				return;
			}
			await e.writeText(t.value), I(n, `${t.label.charAt(0).toUpperCase()}${t.label.slice(1)} copied.`);
		} catch {
			I(n, `Could not copy ${t.label}. Select the text and copy it manually.`);
		}
	}
	var i = qa(), a = L(i), o = z(B(a, 2), !0);
	M(i), V(() => {
		Y(a, "aria-label", `Copy ${t.label}`), K(o, H(n));
	}), U("click", a, r), G(e, i), Ve();
}
kr(["click"]);
//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/count.js
function Xa(e) {
	var t = 0, n = e.children, r = n && n.length;
	if (!r) t = 1;
	else for (; --r >= 0;) t += n[r].value;
	e.value = t;
}
function Za() {
	return this.eachAfter(Xa);
}
//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/each.js
function Qa(e, t) {
	let n = -1;
	for (let r of this) e.call(t, r, ++n, this);
	return this;
}
//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/eachBefore.js
function $a(e, t) {
	for (var n = this, r = [n], i, a, o = -1; n = r.pop();) if (e.call(t, n, ++o, this), i = n.children) for (a = i.length - 1; a >= 0; --a) r.push(i[a]);
	return this;
}
//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/eachAfter.js
function eo(e, t) {
	for (var n = this, r = [n], i = [], a, o, s, c = -1; n = r.pop();) if (i.push(n), a = n.children) for (o = 0, s = a.length; o < s; ++o) r.push(a[o]);
	for (; n = i.pop();) e.call(t, n, ++c, this);
	return this;
}
//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/find.js
function to(e, t) {
	let n = -1;
	for (let r of this) if (e.call(t, r, ++n, this)) return r;
}
//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/sum.js
function no(e) {
	return this.eachAfter(function(t) {
		for (var n = +e(t.data) || 0, r = t.children, i = r && r.length; --i >= 0;) n += r[i].value;
		t.value = n;
	});
}
//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/sort.js
function ro(e) {
	return this.eachBefore(function(t) {
		t.children && t.children.sort(e);
	});
}
//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/path.js
function io(e) {
	for (var t = this, n = ao(t, e), r = [t]; t !== n;) t = t.parent, r.push(t);
	for (var i = r.length; e !== n;) r.splice(i, 0, e), e = e.parent;
	return r;
}
function ao(e, t) {
	if (e === t) return e;
	var n = e.ancestors(), r = t.ancestors(), i = null;
	for (e = n.pop(), t = r.pop(); e === t;) i = e, e = n.pop(), t = r.pop();
	return i;
}
//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/ancestors.js
function oo() {
	for (var e = this, t = [e]; e = e.parent;) t.push(e);
	return t;
}
//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/descendants.js
function so() {
	return Array.from(this);
}
//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/leaves.js
function co() {
	var e = [];
	return this.eachBefore(function(t) {
		t.children || e.push(t);
	}), e;
}
//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/links.js
function lo() {
	var e = this, t = [];
	return e.each(function(n) {
		n !== e && t.push({
			source: n.parent,
			target: n
		});
	}), t;
}
//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/iterator.js
function* uo() {
	var e = this, t, n = [e], r, i, a;
	do
		for (t = n.reverse(), n = []; e = t.pop();) if (yield e, r = e.children) for (i = 0, a = r.length; i < a; ++i) n.push(r[i]);
	while (n.length);
}
//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/index.js
function fo(e, t) {
	e instanceof Map ? (e = [void 0, e], t === void 0 && (t = ho)) : t === void 0 && (t = mo);
	for (var n = new vo(e), r, i = [n], a, o, s, c; r = i.pop();) if ((o = t(r.data)) && (c = (o = Array.from(o)).length)) for (r.children = o, s = c - 1; s >= 0; --s) i.push(a = o[s] = new vo(o[s])), a.parent = r, a.depth = r.depth + 1;
	return n.eachBefore(_o);
}
function po() {
	return fo(this).eachBefore(go);
}
function mo(e) {
	return e.children;
}
function ho(e) {
	return Array.isArray(e) ? e[1] : null;
}
function go(e) {
	e.data.value !== void 0 && (e.value = e.data.value), e.data = e.data.data;
}
function _o(e) {
	var t = 0;
	do
		e.height = t;
	while ((e = e.parent) && e.height < ++t);
}
function vo(e) {
	this.data = e, this.depth = this.height = 0, this.parent = null;
}
vo.prototype = fo.prototype = {
	constructor: vo,
	count: Za,
	each: Qa,
	eachAfter: eo,
	eachBefore: $a,
	find: to,
	sum: no,
	sort: ro,
	path: io,
	ancestors: oo,
	descendants: so,
	leaves: co,
	links: lo,
	copy: po,
	[Symbol.iterator]: uo
};
//#endregion
//#region node_modules/d3-hierarchy/src/accessors.js
function yo(e) {
	if (typeof e != "function") throw Error();
	return e;
}
//#endregion
//#region node_modules/d3-hierarchy/src/constant.js
function bo() {
	return 0;
}
function xo(e) {
	return function() {
		return e;
	};
}
//#endregion
//#region node_modules/d3-hierarchy/src/treemap/round.js
function So(e) {
	e.x0 = Math.round(e.x0), e.y0 = Math.round(e.y0), e.x1 = Math.round(e.x1), e.y1 = Math.round(e.y1);
}
//#endregion
//#region node_modules/d3-hierarchy/src/treemap/dice.js
function Co(e, t, n, r, i) {
	for (var a = e.children, o, s = -1, c = a.length, l = e.value && (r - t) / e.value; ++s < c;) o = a[s], o.y0 = n, o.y1 = i, o.x0 = t, o.x1 = t += o.value * l;
}
//#endregion
//#region node_modules/d3-hierarchy/src/treemap/slice.js
function wo(e, t, n, r, i) {
	for (var a = e.children, o, s = -1, c = a.length, l = e.value && (i - n) / e.value; ++s < c;) o = a[s], o.x0 = t, o.x1 = r, o.y0 = n, o.y1 = n += o.value * l;
}
//#endregion
//#region node_modules/d3-hierarchy/src/treemap/squarify.js
var To = (1 + Math.sqrt(5)) / 2;
function Eo(e, t, n, r, i, a) {
	for (var o = [], s = t.children, c, l, u = 0, d = 0, f = s.length, p, m, h = t.value, g, _, v, y, b, x, S; u < f;) {
		p = i - n, m = a - r;
		do
			g = s[d++].value;
		while (!g && d < f);
		for (_ = v = g, x = Math.max(m / p, p / m) / (h * e), S = g * g * x, b = Math.max(v / S, S / _); d < f; ++d) {
			if (g += l = s[d].value, l < _ && (_ = l), l > v && (v = l), S = g * g * x, y = Math.max(v / S, S / _), y > b) {
				g -= l;
				break;
			}
			b = y;
		}
		o.push(c = {
			value: g,
			dice: p < m,
			children: s.slice(u, d)
		}), c.dice ? Co(c, n, r, i, h ? r += m * g / h : a) : wo(c, n, r, h ? n += p * g / h : i, a), h -= g, u = d;
	}
	return o;
}
var Do = (function e(t) {
	function n(e, n, r, i, a) {
		Eo(t, e, n, r, i, a);
	}
	return n.ratio = function(t) {
		return e((t = +t) > 1 ? t : 1);
	}, n;
})(To);
//#endregion
//#region node_modules/d3-hierarchy/src/treemap/index.js
function Oo() {
	var e = Do, t = !1, n = 1, r = 1, i = [0], a = bo, o = bo, s = bo, c = bo, l = bo;
	function u(e) {
		return e.x0 = e.y0 = 0, e.x1 = n, e.y1 = r, e.eachBefore(d), i = [0], t && e.eachBefore(So), e;
	}
	function d(t) {
		var n = i[t.depth], r = t.x0 + n, u = t.y0 + n, d = t.x1 - n, f = t.y1 - n;
		d < r && (r = d = (r + d) / 2), f < u && (u = f = (u + f) / 2), t.x0 = r, t.y0 = u, t.x1 = d, t.y1 = f, t.children && (n = i[t.depth + 1] = a(t) / 2, r += l(t) - n, u += o(t) - n, d -= s(t) - n, f -= c(t) - n, d < r && (r = d = (r + d) / 2), f < u && (u = f = (u + f) / 2), e(t, r, u, d, f));
	}
	return u.round = function(e) {
		return arguments.length ? (t = !!e, u) : t;
	}, u.size = function(e) {
		return arguments.length ? (n = +e[0], r = +e[1], u) : [n, r];
	}, u.tile = function(t) {
		return arguments.length ? (e = yo(t), u) : e;
	}, u.padding = function(e) {
		return arguments.length ? u.paddingInner(e).paddingOuter(e) : u.paddingInner();
	}, u.paddingInner = function(e) {
		return arguments.length ? (a = typeof e == "function" ? e : xo(+e), u) : a;
	}, u.paddingOuter = function(e) {
		return arguments.length ? u.paddingTop(e).paddingRight(e).paddingBottom(e).paddingLeft(e) : u.paddingTop();
	}, u.paddingTop = function(e) {
		return arguments.length ? (o = typeof e == "function" ? e : xo(+e), u) : o;
	}, u.paddingRight = function(e) {
		return arguments.length ? (s = typeof e == "function" ? e : xo(+e), u) : s;
	}, u.paddingBottom = function(e) {
		return arguments.length ? (c = typeof e == "function" ? e : xo(+e), u) : c;
	}, u.paddingLeft = function(e) {
		return arguments.length ? (l = typeof e == "function" ? e : xo(+e), u) : l;
	}, u;
}
//#endregion
//#region src/lib/item-label.ts
var ko = {
	system: "System context",
	toolDefinition: "Tool definition",
	userMessage: "User message",
	assistantMessage: "Assistant message",
	toolResult: "Tool result",
	compactionSummary: "Compaction summary",
	customMessage: "Custom context message",
	branchSummary: "Branch summary",
	thinking: "Thinking",
	unrecordedContext: "Unrecorded request context",
	other: "Context item"
};
function Ao(e, t = "Unlabelled context item") {
	let n = e?.label;
	if (n && n.trim().length > 0) return n;
	let r = e?.preview?.text;
	if (r && r.trim().length > 0) return r;
	if (e) {
		let n = e.kind.trim();
		return (ko[n] ?? n.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^\w/, (e) => e.toUpperCase())) || t;
	}
	return t;
}
function jo(e) {
	let t = e.trim().match(/^((?:Read|Write|Edit)(?: result)?)\s*[·:]\s*(.+)$/i);
	if (!t) return null;
	let n = t[1], r = t[2].trim();
	if (!/[\\/]/.test(r) || /^[a-z][a-z\d+.-]*:\/\//i.test(r)) return null;
	let i = r.split(/[\\/]/).filter(Boolean);
	return i.length > 0 ? {
		prefix: n,
		segments: i
	} : null;
}
function Mo(e) {
	let t = e.map((e) => {
		let t = Ao(e);
		return {
			id: e.id,
			fullLabel: t,
			source: jo(t)
		};
	}), n = {
		pathCount: 0,
		children: /* @__PURE__ */ new Map()
	};
	for (let { source: e } of t) {
		if (!e) continue;
		let t = n;
		for (let n = e.segments.length - 1; n >= 0; --n) {
			let r = e.segments[n], i = t.children.get(r);
			i || (i = {
				pathCount: 0,
				children: /* @__PURE__ */ new Map()
			}, t.children.set(r, i)), i.pathCount += 1, t = i;
		}
	}
	return new Map(t.map(({ id: e, fullLabel: t, source: r }) => {
		if (!r) return [e, t];
		let i = n, a = r.segments.length;
		for (let e = r.segments.length - 1, t = 1; e >= 0; --e, t += 1) if (i = i.children.get(r.segments[e]), i.pathCount === 1) {
			a = t;
			break;
		}
		let o = r.segments.slice(-a).join("/");
		return [e, r.prefix ? `${r.prefix} · ${o}` : o];
	}));
}
//#endregion
//#region src/lib/kind-labels.ts
var No = {
	system: "System",
	toolDefinition: "Tool definition",
	userMessage: "User message",
	assistantMessage: "Assistant message",
	toolResult: "Tool result",
	compactionSummary: "Compaction summary",
	customMessage: "Custom message",
	branchSummary: "Branch summary",
	thinking: "Thinking",
	unrecordedContext: "Unrecorded request context",
	other: "Other"
}, Po = {
	system: "System",
	toolDefinition: "Tool definitions",
	userMessage: "User messages",
	assistantMessage: "Assistant messages",
	toolResult: "Tool results",
	compactionSummary: "Compaction summaries",
	customMessage: "Custom messages",
	branchSummary: "Branch summaries",
	thinking: "Thinking",
	unrecordedContext: "Unrecorded request context",
	other: "Other context"
};
function Fo(e) {
	return No[e];
}
function Io(e) {
	return Po[e];
}
//#endregion
//#region src/lib/diagnostics.ts
var Lo = {
	providerUsageIncomplete: {
		title: "Provider usage is incomplete",
		impact: "Prompt reconciliation may be unavailable or partial."
	},
	unsupportedTokenizer: {
		title: "No supported tokenizer is available",
		impact: "Token counts for this model cannot be calculated with a known tokenizer."
	},
	heuristicTokenizer: {
		title: "A character heuristic was used",
		impact: "This is a rough estimate, not an exact tokenizer count."
	},
	estimatedProviderSerialization: {
		title: "Provider serialization was estimated",
		impact: "The request format is approximated, so framing and prompt totals may differ."
	},
	unsupportedImage: {
		title: "Image content is not fully counted",
		impact: "Text counts may omit image payload tokens."
	},
	unsupportedPayload: {
		title: "Some content could not be tokenized",
		impact: "The affected payload is unavailable or unsupported by the selected method."
	},
	unavailablePayload: {
		title: "Some content is unavailable",
		impact: "The affected payload is excluded from the token estimate."
	},
	knownFramingOverheadAvailable: {
		title: "Known request framing is included",
		impact: "Supported message and tool framing overhead contributes to the calculated total."
	},
	missingSystemPrompt: {
		title: "No system prompt was found in the session",
		impact: "The provider may add system instructions that are not represented here."
	},
	missingToolDefinitions: {
		title: "No tool definitions were found in the session",
		impact: "Provider-side tool schemas may add prompt tokens not represented here."
	},
	modelSwitchTransformation: {
		title: "Content was transformed for a model switch",
		impact: "The later request may serialize earlier content differently."
	},
	negativeResidual: {
		title: "Calculated context exceeds reported prompt usage",
		impact: "Differences in serialization or provider accounting may explain the negative residual."
	},
	inferredFromReportedUsage: {
		title: "Size inferred from reported usage",
		impact: "This is the call's reported input less its recorded items, so it covers request content the session does not record. It is not counted from any text."
	},
	estimatedImageSize: {
		title: "Image tokens are estimated from the image size",
		impact: "The provider's documented sizing rule is applied to the image's width and height; it is not an exact count."
	},
	unrecordedToolDefinition: {
		title: "A tool definition is not recorded",
		impact: "The tool reference loads a definition into the request whose size is unknown; only the reference is counted."
	},
	thinkingNotReadByModel: {
		title: "Thinking from another model",
		impact: "The provider drops thinking it cannot read for this model, so it adds no tokens to this request."
	},
	excludedFromContext: {
		title: "Content was excluded from model context",
		impact: "This item does not contribute to the request token estimate."
	}
};
function Ro(e) {
	return Lo[e] ?? null;
}
//#endregion
//#region src/lib/composition.ts
var zo = [
	"system",
	"toolDefinition",
	"userMessage",
	"assistantMessage",
	"toolResult",
	"compactionSummary",
	"customMessage",
	"branchSummary",
	"thinking",
	"unrecordedContext",
	"other"
], Bo = (e, t) => ({
	width: e,
	height: t,
	rectangles: [],
	groups: []
});
function Vo(e) {
	return typeof e == "number" && Number.isSafeInteger(e) && e >= 0 ? e : null;
}
function Ho(e) {
	return Ro(e) ?? {
		title: "Additional estimate limitation",
		impact: "Select this item to inspect additional diagnostics."
	};
}
function Uo(e, t) {
	return e < t ? -1 : +(e > t);
}
function Wo(e, t) {
	return e.tokens === null ? t.tokens === null ? 0 : 1 : t.tokens === null ? -1 : t.tokens - e.tokens;
}
function Go(e) {
	return [...e].sort((e, t) => Wo(e, t) || e.sourceOrder - t.sourceOrder || Uo(e.id, t.id));
}
function Ko(e) {
	return zo.flatMap((t) => {
		let n = Go(e.filter((e) => e.kind === t));
		return n.length === 0 ? [] : [{
			kind: t,
			label: Io(t),
			items: n
		}];
	});
}
function qo(e, t) {
	return e === null || e > t ? null : t - e;
}
function Jo({ item: e, sourceOrder: t, tokens: n, ageAtCall: r, estimateMethods: i, estimateCoverage: a, explanations: o, knownContributionCount: s, missingContributionCount: c, partialEstimateContributionCount: l, unavailableCoverageContributionCount: u, scopePresenceCount: d, overflowed: f }) {
	return {
		id: e.id,
		kind: e.kind,
		kindLabel: Fo(e.kind),
		label: Ao(e),
		sourceOrder: t,
		tokens: n,
		share: null,
		estimateMethod: i.length === 1 ? i[0] : null,
		estimateMethods: i,
		estimateCoverage: a,
		explanations: o,
		ageAtCall: r,
		knownContributionCount: s,
		missingContributionCount: c,
		partialEstimateContributionCount: l,
		unavailableCoverageContributionCount: u,
		scopePresenceCount: d,
		overflowed: f
	};
}
function Yo(e, t) {
	if (!(t === null || t <= 0)) for (let n of e) n.tokens !== null && (n.share = n.tokens / t);
}
function Xo(e) {
	let t = Ko(e.items), n = e.items.filter((e) => e.tokens !== null).length, r = e.items.length - n, i = e.items.reduce((e, t) => e + t.missingContributionCount, 0), a = e.items.reduce((e, t) => e + t.partialEstimateContributionCount, 0), o = e.items.reduce((e, t) => e + t.unavailableCoverageContributionCount, 0), s = e.totalOverflow || e.numericItemCallCount === 0 ? null : e.measuredTokenTotal, c = s !== null && s > 0, l = n > 0 && s === 0;
	return Yo(e.items, s), {
		...e,
		measuredTokenTotal: s,
		groups: t,
		measuredItemCount: n,
		unmeasuredItemCount: r,
		missingItemCallCount: i,
		partialItemCallCount: a,
		unavailableCoverageItemCallCount: o,
		hasPositiveWeights: c,
		allMeasuredZero: l
	};
}
function Zo(e, t) {
	let n = e.callByIndex.get(t);
	if (!n) return null;
	let r = e.analysis.modelCalls, i = r.findIndex((e) => e.index === t), a = new Map(r.map((e, t) => [e.index, t])), o = /* @__PURE__ */ new Set(), s = 0, c = !1, l = 0, u = [];
	return n.contextItemIds.forEach((t, r) => {
		if (o.has(t)) return;
		o.add(t);
		let d = e.itemById.get(t);
		if (!d) return;
		let f = n.tokenizationProfileId ? e.itemEstimateByProfile.get(t)?.get(n.tokenizationProfileId) ?? null : null, p = Vo(f?.tokens), m = p === null ? 0 : 1, h = +(p === null), g = +(f?.coverage === "partial"), _ = +(f?.coverage === "unavailable");
		p !== null && (l += 1, s > 2 ** 53 - 1 - p ? c = !0 : s += p);
		let v = a.get(d.firstModelCall) ?? null, y = f ? [f.method] : [], b = p === null ? "unavailable" : f?.coverage ?? "unavailable";
		u.push(Jo({
			item: d,
			sourceOrder: r,
			tokens: p,
			ageAtCall: qo(v, i),
			estimateMethods: y,
			estimateCoverage: b,
			explanations: (f?.noteCodes ?? []).map(Ho),
			knownContributionCount: m,
			missingContributionCount: h,
			partialEstimateContributionCount: g,
			unavailableCoverageContributionCount: _,
			scopePresenceCount: 1,
			overflowed: !1
		}));
	}), {
		...Xo({
			callIndex: t,
			profileId: n.tokenizationProfileId,
			profileIds: n.tokenizationProfileId ? [n.tokenizationProfileId] : [],
			scope: "atCall",
			scopeStartCallIndex: n.index,
			scopeEndCallIndex: n.index,
			scopeCallCount: 1,
			items: u,
			measuredTokenTotal: s,
			numericItemCallCount: l,
			totalItemCallCount: u.length,
			totalOverflow: c
		}),
		scope: "atCall",
		callIndex: t
	};
}
function Qo(e, t = null) {
	let n = e.analysis.modelCalls;
	if (t !== null && !e.callByIndex.has(t)) return null;
	let r = t === null ? n.length - 1 : n.findIndex((e) => e.index === t);
	if (t !== null && r < 0) return null;
	let i = r < 0 ? [] : n.slice(0, r + 1), a = new Map(e.analysis.contextItems.map((e, t) => [e.id, t])), o = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Set(), c = 0, l = !1, u = 0, d = 0;
	for (let t = 0; t < i.length; t += 1) {
		let n = i[t];
		n.tokenizationProfileId && s.add(n.tokenizationProfileId);
		let r = /* @__PURE__ */ new Set();
		for (let i of n.contextItemIds) {
			if (r.has(i)) continue;
			r.add(i);
			let s = e.itemById.get(i);
			if (!s) continue;
			d += 1;
			let f = o.get(i);
			f || (f = {
				item: s,
				sourceOrder: a.get(i) ?? 2 ** 53 - 1,
				totalTokens: 0,
				overflowed: !1,
				knownContributionCount: 0,
				missingContributionCount: 0,
				partialEstimateContributionCount: 0,
				unavailableCoverageContributionCount: 0,
				scopePresenceCount: 0,
				firstPresencePosition: t,
				methods: /* @__PURE__ */ new Set(),
				explanationCodes: /* @__PURE__ */ new Set()
			}, o.set(i, f)), f.scopePresenceCount += 1;
			let p = n.tokenizationProfileId ? e.itemEstimateByProfile.get(i)?.get(n.tokenizationProfileId) ?? null : null;
			if (p) {
				f.methods.add(p.method);
				for (let e of p.noteCodes) f.explanationCodes.add(e);
			}
			let m = Vo(p?.tokens);
			if (p?.coverage === "partial" && (f.partialEstimateContributionCount += 1), p?.coverage === "unavailable" && (f.unavailableCoverageContributionCount += 1), m === null || !p) {
				f.missingContributionCount += 1;
				continue;
			}
			u += 1, f.knownContributionCount += 1, f.totalTokens > 2 ** 53 - 1 - m ? f.overflowed = !0 : f.overflowed || (f.totalTokens += m), c > 2 ** 53 - 1 - m ? l = !0 : l || (c += m);
		}
	}
	let f = [...o.values()].sort((e, t) => e.sourceOrder - t.sourceOrder || Uo(e.item.id, t.item.id)).map((e) => {
		let t = e.overflowed, n = e.knownContributionCount === 0 || t ? null : e.totalTokens, i = e.knownContributionCount === 0 ? "unavailable" : e.missingContributionCount > 0 || e.partialEstimateContributionCount > 0 || e.unavailableCoverageContributionCount > 0 ? "partial" : "complete";
		return Jo({
			item: e.item,
			sourceOrder: e.sourceOrder,
			tokens: n,
			ageAtCall: qo(e.firstPresencePosition, r),
			estimateMethods: [...e.methods].sort(),
			estimateCoverage: i,
			explanations: [...e.explanationCodes].sort().map(Ho),
			knownContributionCount: e.knownContributionCount,
			missingContributionCount: e.missingContributionCount,
			partialEstimateContributionCount: e.partialEstimateContributionCount,
			unavailableCoverageContributionCount: e.unavailableCoverageContributionCount,
			scopePresenceCount: e.scopePresenceCount,
			overflowed: t
		});
	}), p = [...s].sort();
	return {
		...Xo({
			callIndex: t,
			profileId: p.length === 1 ? p[0] : null,
			profileIds: p,
			scope: "cumulative",
			scopeStartCallIndex: i[0]?.index ?? null,
			scopeEndCallIndex: i[i.length - 1]?.index ?? null,
			scopeCallCount: i.length,
			items: f,
			measuredTokenTotal: c,
			numericItemCallCount: u,
			totalItemCallCount: d,
			totalOverflow: l
		}),
		scope: "cumulative"
	};
}
function $o() {
	let e = null, t = /* @__PURE__ */ new Map();
	return {
		get retainedEntryCount() {
			return t.size;
		},
		get(n, r, i) {
			e !== n && (t.clear(), e = n);
			let a = t.get(r);
			if (a?.endpoint === i) return a.projection;
			let o = r === "atCall" ? i === null ? null : Zo(n, i) : Qo(n, i);
			return t.set(r, {
				endpoint: i,
				projection: o
			}), o;
		}
	};
}
function es(e, t, n = 10) {
	let r = t - 12, i = Math.floor(r / (n * .62));
	if (i < 4) return "";
	if (e.length <= i) return e;
	let a = e.match(/(?:[A-Za-z]:)?(?:[/\\][^/\\\s]+)+$/)?.[0];
	if (a) {
		let t = a.split(/[\\/]/).filter(Boolean), n = t[t.length - 1] ?? a, r = e.slice(0, e.length - a.length), o = `${r}…/${n}`;
		if (o.length <= i) return o;
		if (n.length >= i - 1) return `…${n.slice(-(i - 1))}`;
		let s = i - n.length - 2;
		return `${r.slice(0, Math.max(0, s))}…/${n}`;
	}
	let o = Math.ceil((i - 1) / 2), s = Math.floor((i - 1) / 2);
	return `${e.slice(0, o)}…${s > 0 ? e.slice(-s) : ""}`;
}
function ts(e, t, n) {
	if (!Number.isFinite(t) || !Number.isFinite(n) || t <= 0 || n <= 0 || !e.hasPositiveWeights || e.totalOverflow) return Bo(Number.isFinite(t) && t > 0 ? t : 0, Number.isFinite(n) && n > 0 ? n : 0);
	let r = fo({
		label: "Composition",
		children: e.groups.map((e) => ({
			label: e.label,
			kind: e.kind,
			children: e.items.filter((e) => e.tokens !== null).map((e) => ({
				label: e.label,
				kind: e.kind,
				item: e
			}))
		})).filter((e) => (e.children?.length ?? 0) > 0)
	}).sum((e) => e.item?.tokens ?? 0), i = Oo().size([t, n]).tile(Do).paddingInner(2).paddingTop((e) => e.depth === 1 ? 15 : 0).round(!1)(r), a = new Map(Go(e.items).map((e, t) => [e.id, t])), o = [], s = [];
	return i.each((e) => {
		let t = e.x1 - e.x0, n = e.y1 - e.y0;
		e.depth === 1 && e.data.kind && t > 0 && n > 0 && s.push({
			kind: e.data.kind,
			label: e.data.label,
			x: e.x0,
			y: e.y0,
			width: t,
			height: n,
			labelText: t >= 58 && n >= 17 ? es(e.data.label, t, 9) : ""
		});
		let r = e.data.item;
		if (!r || t <= 0 || n <= 0 || (r.tokens ?? 0) <= 0) return;
		let i = a.get(r.id);
		if (i === void 0) return;
		let c = t >= 68 && n >= 38;
		o.push({
			item: r,
			x: e.x0,
			y: e.y0,
			width: t,
			height: n,
			labelFits: c,
			labelText: c ? es(r.label, t, 10) : "",
			optionIndex: i
		});
	}), {
		width: t,
		height: n,
		rectangles: o,
		groups: s
	};
}
//#endregion
//#region src/lib/components/CallComposition.svelte
var ns = /* @__PURE__ */ W("<div class=\"presentation-controls svelte-8fl9lq\" role=\"group\" aria-label=\"Composition presentation\"><button type=\"button\" class=\"svelte-8fl9lq\">Treemap</button> <button type=\"button\" class=\"svelte-8fl9lq\">List</button></div>"), rs = /* @__PURE__ */ W("<div class=\"composition-controls svelte-8fl9lq\"><div class=\"scope-controls svelte-8fl9lq\" role=\"group\" aria-label=\"Composition scope\"><button type=\"button\" class=\"svelte-8fl9lq\">At call</button> <button type=\"button\" class=\"svelte-8fl9lq\">Cumulative</button></div> <!></div>"), is = /* @__PURE__ */ W("<div class=\"empty-state svelte-8fl9lq\"><h3 class=\"svelte-8fl9lq\">No model-call usage</h3> <p class=\"svelte-8fl9lq\">This session has no model calls. Terminal items remain available in Context lifespans.</p></div>"), as = /* @__PURE__ */ W("<div class=\"empty-state svelte-8fl9lq\"><p class=\"svelte-8fl9lq\">Pin a call to inspect its item estimates.</p> <button type=\"button\">Inspect latest call</button></div>"), os = /* @__PURE__ */ W("<div class=\"empty-state svelte-8fl9lq\"><p class=\"svelte-8fl9lq\">Preparing composition…</p></div>"), ss = /* @__PURE__ */ W("<p class=\"endpoint-status svelte-8fl9lq\" role=\"status\"> </p>"), cs = /* @__PURE__ */ W("<button type=\"button\">Whole session</button>"), ls = /* @__PURE__ */ W("<div class=\"endpoint-actions svelte-8fl9lq\"><div class=\"call-stepper svelte-8fl9lq\" role=\"group\" aria-label=\"Inspect adjacent calls\"><button type=\"button\" aria-label=\"Inspect previous call\">Previous call</button> <button type=\"button\" aria-label=\"Inspect next call\">Next call</button></div> <!></div>"), us = /* @__PURE__ */ W("<p class=\"coverage-headline svelte-8fl9lq\"> </p>"), ds = /* @__PURE__ */ W("<span> </span>"), fs = /* @__PURE__ */ W("<li> <code class=\"svelte-8fl9lq\"> </code> <!></li>"), ps = /* @__PURE__ */ W("<ul class=\"svelte-8fl9lq\"></ul>"), ms = /* @__PURE__ */ W("<p class=\"svelte-8fl9lq\"><code class=\"svelte-8fl9lq\"> </code> <!></p>"), hs = /* @__PURE__ */ W("<p class=\"coverage-status svelte-8fl9lq\" role=\"status\"> </p>"), gs = /* @__PURE__ */ W("<p class=\"coverage-status svelte-8fl9lq\">All numeric item estimates are zero; no equal-area rectangles are substituted.</p>"), _s = /* @__PURE__ */ W("<p class=\"coverage-status svelte-8fl9lq\">No numeric item estimates are available in this scope; showing the complete List.</p>"), vs = /* @__PURE__ */ W("<p class=\"omission-note svelte-8fl9lq\" role=\"status\"> <button type=\"button\" class=\"svelte-8fl9lq\">View all in List</button></p>"), ys = /* @__PURE__ */ Rr("<clipPath><rect></rect></clipPath>"), bs = /* @__PURE__ */ Rr("<text class=\"svelte-8fl9lq\"> </text>"), xs = /* @__PURE__ */ Rr("<g class=\"kind-group svelte-8fl9lq\"><title> </title><rect class=\"svelte-8fl9lq\"></rect><!></g>"), Ss = /* @__PURE__ */ Rr("<text class=\"tile-value svelte-8fl9lq\"> </text>"), Cs = /* @__PURE__ */ Rr("<g aria-hidden=\"true\"><text class=\"svelte-8fl9lq\"> </text><!></g>"), ws = /* @__PURE__ */ Rr("<g role=\"option\" tabindex=\"-1\"><title> </title><rect fill-opacity=\"1\"></rect><!></g>"), Ts = /* @__PURE__ */ W("<!> <div class=\"treemap-frame svelte-8fl9lq\"><svg class=\"composition-treemap svelte-8fl9lq\" role=\"listbox\" tabindex=\"0\"><defs><!><!></defs><!><!></svg></div>", 1), Es = /* @__PURE__ */ W("<small class=\"svelte-8fl9lq\"> </small>"), Ds = /* @__PURE__ */ W("<div role=\"option\" tabindex=\"-1\"><span class=\"kind-mark svelte-8fl9lq\" aria-hidden=\"true\"></span> <span class=\"row-label svelte-8fl9lq\"><b class=\"svelte-8fl9lq\"> </b> <small class=\"svelte-8fl9lq\"> </small> <!> <!> <!></span> <span class=\"row-measures svelte-8fl9lq\"><b class=\"svelte-8fl9lq\"> </b> <small class=\"svelte-8fl9lq\"> </small> <small class=\"svelte-8fl9lq\"> </small></span></div>"), Os = /* @__PURE__ */ W("<div class=\"composition-list svelte-8fl9lq\" role=\"listbox\" tabindex=\"0\"></div>"), ks = /* @__PURE__ */ W("<span class=\"svelte-8fl9lq\"> </span> <!>", 1), As = /* @__PURE__ */ W("<span class=\"svelte-8fl9lq\"> </span>"), js = /* @__PURE__ */ W("<button type=\"button\" class=\"svelte-8fl9lq\">Reveal in River</button>"), Ms = /* @__PURE__ */ W("<section class=\"selected-composition-item svelte-8fl9lq\" aria-label=\"Selected item in Composition\"><div class=\"selected-summary-copy svelte-8fl9lq\"><strong class=\"svelte-8fl9lq\"> </strong> <!></div> <div class=\"selected-item-actions svelte-8fl9lq\"><button type=\"button\" class=\"svelte-8fl9lq\">View details</button> <button type=\"button\" class=\"svelte-8fl9lq\">Find in lifespans</button> <!></div></section>"), Ns = /* @__PURE__ */ W("<details class=\"reconciliation svelte-8fl9lq\"><summary class=\"svelte-8fl9lq\">Compare with provider usage</summary> <p class=\"svelte-8fl9lq\">Comparison is informational; it does not validate request overhead or change composition\n          areas.</p> <dl class=\"svelte-8fl9lq\"><div><dt class=\"svelte-8fl9lq\">Provider prompt</dt> <dd class=\"svelte-8fl9lq\"> </dd></div> <div><dt class=\"svelte-8fl9lq\">Calculated visible context</dt> <dd class=\"svelte-8fl9lq\"> </dd></div> <div><dt class=\"svelte-8fl9lq\">Known request framing</dt> <dd class=\"svelte-8fl9lq\"> </dd></div> <div><dt class=\"svelte-8fl9lq\">Difference</dt> <dd class=\"svelte-8fl9lq\"> </dd></div></dl></details>"), Ps = /* @__PURE__ */ W("<!> <header class=\"composition-header svelte-8fl9lq\"><div class=\"scope-title svelte-8fl9lq\"><h3 class=\"svelte-8fl9lq\"> </h3> <p class=\"svelte-8fl9lq\"> </p></div> <!></header> <!> <div class=\"composition-totals svelte-8fl9lq\" aria-label=\"Composition totals and coverage\"><strong class=\"svelte-8fl9lq\"> <!></strong> <span> <!></span> <!></div> <details class=\"coverage-details svelte-8fl9lq\"><summary class=\"svelte-8fl9lq\">Diagnostics</summary> <p class=\"svelte-8fl9lq\"> </p> <!> <p class=\"svelte-8fl9lq\"> </p></details> <!> <!> <details class=\"composition-help svelte-8fl9lq\"><summary class=\"svelte-8fl9lq\">Composition help</summary> <div class=\"help-content svelte-8fl9lq\"><p class=\"svelte-8fl9lq\"><!></p> <p class=\"svelte-8fl9lq\">Areas are approximate because kind-group gutters reduce their space. Zero and unavailable\n          values are never enlarged. Item colors are stable identity cues shared with River, not\n          cache or cost states; labels, group boundaries, and selection also carry meaning.</p> <p class=\"svelte-8fl9lq\">Select a tile or use List to inspect an item; use River zoom/select to investigate its\n          call placement, and search or filter lifespans to compare persistence.</p></div></details> <!> <!> <!>", 1), Fs = /* @__PURE__ */ W("<section class=\"composition svelte-8fl9lq\" aria-label=\"Context composition\"><!> <!></section>"), Is = {
	hash: "svelte-8fl9lq",
	code: ".composition.svelte-8fl9lq {min-width:0;}.composition-controls.svelte-8fl9lq,\n  .scope-controls.svelte-8fl9lq,\n  .presentation-controls.svelte-8fl9lq,\n  .composition-header.svelte-8fl9lq,\n  .endpoint-actions.svelte-8fl9lq,\n  .call-stepper.svelte-8fl9lq {display:flex;flex-wrap:wrap;align-items:center;gap:8px;}.composition-controls.svelte-8fl9lq {justify-content:space-between;gap:8px 16px;margin-bottom:10px;}.scope-controls.svelte-8fl9lq button[aria-pressed='true']:where(.svelte-8fl9lq),\n  .presentation-controls.svelte-8fl9lq button[aria-pressed='true']:where(.svelte-8fl9lq) {border-color:var(--accent);background:var(--action);color:var(--active-text);}.composition-header.svelte-8fl9lq {justify-content:space-between;margin:8px 0;}.endpoint-status.svelte-8fl9lq {margin:6px 0;color:var(--warning);font-size:var(--text-sm);}.scope-title.svelte-8fl9lq {min-width:0;}h3.svelte-8fl9lq {margin:0;color:var(--text-strong);font-size:var(--text-lg);}.composition-header.svelte-8fl9lq p:where(.svelte-8fl9lq),\n  .empty-state.svelte-8fl9lq p:where(.svelte-8fl9lq) {margin:3px 0 0;color:var(--secondary);font-size:var(--text-sm);overflow-wrap:anywhere;}.endpoint-actions.svelte-8fl9lq {justify-content:flex-end;}.composition-totals.svelte-8fl9lq {display:flex;flex-wrap:wrap;gap:5px 14px;color:var(--text);font-size:var(--text-sm);font-variant-numeric:tabular-nums;}.composition-totals.svelte-8fl9lq strong:where(.svelte-8fl9lq) {color:var(--text-strong);}.coverage-headline.svelte-8fl9lq,\n  .coverage-status.svelte-8fl9lq,\n  .omission-note.svelte-8fl9lq {margin:6px 0;color:var(--warning);font-size:var(--text-sm);}.coverage-headline.svelte-8fl9lq {color:var(--text-strong);font-weight:650;}.coverage-details.svelte-8fl9lq {margin:6px 0;color:var(--secondary);font-size:var(--text-sm);}.coverage-details.svelte-8fl9lq p:where(.svelte-8fl9lq) {max-width:75ch;margin:5px 0;}.omission-note.svelte-8fl9lq button:where(.svelte-8fl9lq) {margin-left:7px;padding:3px 7px;font-size:var(--text-xs);}.composition-help.svelte-8fl9lq,\n  .reconciliation.svelte-8fl9lq {margin:8px 0;color:var(--secondary);font-size:var(--text-sm);}summary.svelte-8fl9lq {width:fit-content;color:var(--text);cursor:pointer;}.help-content.svelte-8fl9lq {max-width:75ch;padding:4px 0 0 12px;}.help-content.svelte-8fl9lq p:where(.svelte-8fl9lq),\n  .reconciliation.svelte-8fl9lq p:where(.svelte-8fl9lq),\n  .coverage-details.svelte-8fl9lq ul:where(.svelte-8fl9lq) {display:grid;gap:5px;padding-left:20px;overflow-wrap:anywhere;}.coverage-details.svelte-8fl9lq code:where(.svelte-8fl9lq) {overflow-wrap:anywhere;}.reconciliation.svelte-8fl9lq dl:where(.svelte-8fl9lq) {display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:6px 12px;margin:7px 0 0;}dt.svelte-8fl9lq {color:var(--muted);font-size:10px;}dd.svelte-8fl9lq {margin:2px 0 0;color:var(--text);font-size:var(--text-sm);font-variant-numeric:tabular-nums;overflow-wrap:anywhere;}.treemap-frame.svelte-8fl9lq {width:100%;overflow:auto;border:1px solid var(--separator);border-radius:var(--radius);background:var(--plot);}.composition-treemap.svelte-8fl9lq {display:block;max-width:100%;background:var(--plot);}.kind-group.svelte-8fl9lq rect:where(.svelte-8fl9lq) {fill:none;stroke:var(--text);stroke-opacity:0.52;stroke-width:1;pointer-events:none;}.kind-group.svelte-8fl9lq text:where(.svelte-8fl9lq) {fill:var(--text-strong);font-size:9px;font-weight:600;pointer-events:none;}.composition-treemap.svelte-8fl9lq g[role='option']:where(.svelte-8fl9lq) {cursor:pointer;}.composition-treemap.svelte-8fl9lq g[role='option']:where(.svelte-8fl9lq) rect:where(.svelte-8fl9lq) {stroke:var(--plot);stroke-width:1;}.composition-treemap.svelte-8fl9lq:focus g[role='option'].active:where(.svelte-8fl9lq) rect:where(.svelte-8fl9lq) {stroke:var(--accent);stroke-width:2;}.composition-treemap.svelte-8fl9lq g[role='option'].selected:where(.svelte-8fl9lq) rect:where(.svelte-8fl9lq) {stroke:var(--selection);stroke-width:2;}.composition-treemap.svelte-8fl9lq g[role='option']:where(.svelte-8fl9lq) rect.partial:where(.svelte-8fl9lq) {stroke:var(--warning);stroke-dasharray:3 2;}.composition-treemap.svelte-8fl9lq g[role='option']:where(.svelte-8fl9lq) text:where(.svelte-8fl9lq) {fill:var(--text);font-size:10px;pointer-events:none;}.composition-treemap.svelte-8fl9lq g[role='option']:where(.svelte-8fl9lq) text.tile-value:where(.svelte-8fl9lq) {fill:var(--text);font-size:9px;}.composition-list.svelte-8fl9lq {display:grid;gap:3px;max-height:390px;overflow:auto;padding:3px;border:1px solid var(--separator);border-radius:var(--radius);background:var(--plot);overscroll-behavior:contain;}.composition-row.svelte-8fl9lq {display:grid;grid-template-columns:10px minmax(0, 1fr) minmax(130px, 0.55fr);align-items:center;gap:8px;min-width:0;padding:7px;border:1px solid transparent;border-radius:var(--control-radius);cursor:pointer;}.composition-list.svelte-8fl9lq:focus .composition-row.active:where(.svelte-8fl9lq) {border-color:var(--accent);background:var(--surface-raised);}.composition-row.selected.svelte-8fl9lq {border-color:var(--selection);background:var(--action);}.composition-row.unavailable.svelte-8fl9lq {color:var(--secondary);}.kind-mark.svelte-8fl9lq {width:9px;height:9px;border-radius:var(--radius-small);}.row-label.svelte-8fl9lq,\n  .row-measures.svelte-8fl9lq {display:grid;min-width:0;gap:2px;}.row-label.svelte-8fl9lq b:where(.svelte-8fl9lq) {overflow-wrap:anywhere;color:var(--text-strong);font-size:var(--text-sm);}.row-label.svelte-8fl9lq small:where(.svelte-8fl9lq),\n  .row-measures.svelte-8fl9lq small:where(.svelte-8fl9lq) {color:var(--secondary);font-size:10px;overflow-wrap:anywhere;}.row-measures.svelte-8fl9lq {text-align:right;font-variant-numeric:tabular-nums;}.row-measures.svelte-8fl9lq b:where(.svelte-8fl9lq) {color:var(--text-strong);font-size:var(--text-sm);}.selected-composition-item.svelte-8fl9lq {display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 14px;min-height:46px;margin-top:9px;padding:var(--control-padding);border:1px solid var(--separator);border-radius:var(--control-radius);background:var(--plot);}.selected-summary-copy.svelte-8fl9lq {display:grid;min-width:0;gap:2px;}.selected-summary-copy.svelte-8fl9lq strong:where(.svelte-8fl9lq),\n  .selected-summary-copy.svelte-8fl9lq span:where(.svelte-8fl9lq),\n  .selected-summary-copy.svelte-8fl9lq small:where(.svelte-8fl9lq) {overflow-wrap:anywhere;}.selected-summary-copy.svelte-8fl9lq strong:where(.svelte-8fl9lq) {color:var(--text-strong);font-size:var(--text-sm);}.selected-summary-copy.svelte-8fl9lq span:where(.svelte-8fl9lq),\n  .selected-summary-copy.svelte-8fl9lq small:where(.svelte-8fl9lq) {color:var(--secondary);font-size:var(--text-xs);}.selected-item-actions.svelte-8fl9lq {display:flex;flex-wrap:wrap;gap:6px;}.selected-item-actions.svelte-8fl9lq button:where(.svelte-8fl9lq) {padding:5px 7px;font-size:var(--text-xs);}.empty-state.svelte-8fl9lq {padding:12px;border:1px solid var(--separator);border-radius:var(--radius);background:var(--plot);}\n  @container highwater (max-width: 650px) {.reconciliation.svelte-8fl9lq dl:where(.svelte-8fl9lq) {grid-template-columns:repeat(2, minmax(0, 1fr));}.composition-header.svelte-8fl9lq {align-items:flex-start;}\n  }\n  @container highwater (max-width: 440px) {.composition-row.svelte-8fl9lq {grid-template-columns:10px minmax(0, 1fr);}.row-measures.svelte-8fl9lq {grid-column:2;text-align:left;}\n  }"
};
function Ls(e, t) {
	Be(t, !0), li(e, Is);
	let n = () => ot(Ma, "$activePalette", r), [r, i] = st(), a = X(t, "pinnedCallIndex", 3, null), o = X(t, "selectedItemId", 3, null), s = X(t, "isVisible", 3, !1), c = X(t, "scope", 7, "cumulative"), l = X(t, "endpointNotice", 3, ""), u = X(t, "onScopeChange", 3, null), d = X(t, "onUnpinCall", 3, () => {}), f = X(t, "onRevealInRiver", 3, () => {}), p = X(t, "onViewDetails", 3, () => {}), m = X(t, "onFindInLifespans", 3, () => {}), h = X(t, "compact", 3, !1), g = /* @__PURE__ */ F(void 0), _ = /* @__PURE__ */ F(null), v = /* @__PURE__ */ F(null), y = /* @__PURE__ */ F(800), b = /* @__PURE__ */ F(null), x = /* @__PURE__ */ P(() => H(b) ?? (h() ? "list" : "treemap")), S = /* @__PURE__ */ F(null), C = $o(), w = /* @__PURE__ */ P(() => t.indexed.analysis.modelCalls), ee = /* @__PURE__ */ P(() => a() === null ? -1 : H(w).findIndex((e) => e.index === a())), T = /* @__PURE__ */ P(() => H(ee) < 0 ? null : H(w)[H(ee)]), E = /* @__PURE__ */ P(() => H(ee) > 0 ? H(w)[H(ee) - 1] : null), te = /* @__PURE__ */ P(() => H(ee) >= 0 && H(ee) < H(w).length - 1 ? H(w)[H(ee) + 1] : null), D = /* @__PURE__ */ P(() => s() ? C.get(t.indexed, c(), a()) : null), O = /* @__PURE__ */ P(() => H(D) ? Go(H(D).items) : []), k = /* @__PURE__ */ P(() => H(D) !== null && H(D).hasPositiveWeights && !H(D).totalOverflow), ne = /* @__PURE__ */ P(() => H(D) && H(k) ? ts(H(D), H(y), 360) : {
		width: H(y),
		height: 360,
		rectangles: [],
		groups: []
	}), re = /* @__PURE__ */ P(() => new Set(H(ne).rectangles.map(({ item: e }) => e.id))), ie = /* @__PURE__ */ P(() => H(k) && H(ne).rectangles.length > 0), ae = /* @__PURE__ */ P(() => H(ie) ? H(x) : "list"), oe = /* @__PURE__ */ P(() => H(ae) === "treemap" ? H(O).filter((e) => H(re).has(e.id)) : H(O));
	Tn(() => {
		H(oe).length > 0 && !H(oe).some((e) => e.id === H(S)) && I(S, H(oe)[0].id, !0);
	});
	let se = /* @__PURE__ */ P(() => H(oe).findIndex((e) => e.id === H(S))), ce = /* @__PURE__ */ P(() => H(O).findIndex((e) => e.id === H(S))), le = /* @__PURE__ */ P(() => H(ce) < 0 ? void 0 : De(H(ce))), ue = /* @__PURE__ */ P(() => o() ? t.indexed.itemById.get(o()) ?? null : null), de = /* @__PURE__ */ P(() => H(D)?.items.find((e) => e.id === o()) ?? null), fe = /* @__PURE__ */ P(() => H(ue) !== null && H(ue).presence.length > 0), pe = /* @__PURE__ */ P(() => (H(D)?.profileIds ?? []).map((e) => {
		let n = t.indexed.analysis.tokenAnalysis.profiles.find((t) => t.id === e);
		return {
			id: e,
			description: n ? `${n.provider} / ${n.model} · ${ke(n.method)}` : "Tokenization profile unavailable"
		};
	})), me = /* @__PURE__ */ P(() => H(pe).length === 0 ? "Token estimate method unavailable" : H(pe).length === 1 ? H(pe)[0].description : `Mixed profiles across ${Z(H(pe).length)} call profiles`), he = /* @__PURE__ */ P(() => c() === "atCall" ? H(T) ? `Context composition · Call ${H(T).index}` : "Context composition · No call selected" : H(D)?.scopeEndCallIndex === null || H(D)?.scopeEndCallIndex === void 0 || a() === null ? "Cumulative context usage · Whole session" : `Cumulative context usage · Calls ${H(D).scopeStartCallIndex}–${H(D).scopeEndCallIndex}`), ge = /* @__PURE__ */ P(() => c() === "atCall" ? `${Z(H(D)?.items.length ?? 0)} present items` : `${Z(H(D)?.scopeCallCount ?? 0)} model calls included`), _e = /* @__PURE__ */ P(() => c() === "atCall" ? "Estimated tokens" : "Estimated token-turns"), A = /* @__PURE__ */ P(() => c() === "atCall" ? "estimated item tokens" : "estimated token-turns"), ve = /* @__PURE__ */ P(() => (H(D)?.missingItemCallCount ?? 0) > 0 || (H(D)?.partialItemCallCount ?? 0) > 0 || (H(D)?.unavailableCoverageItemCallCount ?? 0) > 0), j = /* @__PURE__ */ P(() => H(D)?.numericItemCallCount ?? 0), ye = /* @__PURE__ */ P(() => H(D)?.totalItemCallCount ?? 0), be = /* @__PURE__ */ P(() => H(D)?.items.filter((e) => e.tokens === 0).length ?? 0), Se = /* @__PURE__ */ P(() => H(D)?.items.filter((e) => e.tokens === null && !e.overflowed).length ?? 0), Ce = /* @__PURE__ */ P(() => H(D)?.items.filter((e) => e.overflowed).length ?? 0), we = /* @__PURE__ */ P(() => H(D)?.items.filter((e) => (e.tokens ?? 0) > 0).length ?? 0), Te = /* @__PURE__ */ P(() => H(ne).rectangles.length), Ee = /* @__PURE__ */ P(() => Math.max(0, H(we) - H(Te)));
	function De(e) {
		return `composition-option-${c()}-${a() ?? "whole"}-${e}`;
	}
	function Oe(e) {
		return `composition-tile-clip-${c()}-${a() ?? "whole"}-${e}`;
	}
	function ke(e) {
		return ma(e, "Mixed or unavailable estimate method");
	}
	function Ae(e) {
		let t = e.tokens === null ? e.overflowed ? "safe subtotal unavailable because the sum overflowed" : "token estimate unavailable" : `${Z(e.tokens)} estimated ${c() === "atCall" ? "tokens" : "token-turns"}`, n = e.share === null ? "" : `${Va(e.share)} of ${H(ve) ? "available-estimate subset" : "numeric item estimates"}`, r = e.estimateMethods.length > 1 ? "mixed estimate methods" : ke(e.estimateMethod), i = `estimate coverage ${e.estimateCoverage}`, a = c() === "cumulative" ? `${e.knownContributionCount} of ${e.scopePresenceCount} item-call contributions have numeric estimates; ${e.missingContributionCount} unavailable` : "", o = e.explanations.map((e) => `${e.title}: ${e.impact}`).join("; "), s = e.ageAtCall === null ? "age unavailable" : `age ${e.ageAtCall} calls at the ${c() === "atCall" ? "inspected call" : "scope endpoint"}`;
		return `${e.label}, ${e.kindLabel}, ${t}, ${r}, ${i}${n ? `, ${n}` : ""}${a ? `, ${a}` : ""}${o ? `, ${o}` : ""}, ${s}`;
	}
	function je(e) {
		I(S, e.id, !0), t.onSelectItem(e.id);
	}
	async function Me() {
		if (await gr(), H(ae) !== "list" || !H(_) || !H(le)) return;
		let e = Vi(H(_)).getElementById(H(le));
		if (!e || !H(_).contains(e)) return;
		let t = H(_).getBoundingClientRect(), n = e.getBoundingClientRect();
		n.top < t.top ? H(_).scrollTop += n.top - t.top : n.bottom > t.bottom && (H(_).scrollTop += n.bottom - t.bottom);
	}
	function Ne(e) {
		if (H(oe).length === 0) return;
		let t = H(se) < 0 ? 0 : H(se);
		if (e.key === "ArrowDown" || e.key === "ArrowRight") t = Math.min(H(oe).length - 1, t + 1);
		else if (e.key === "ArrowUp" || e.key === "ArrowLeft") t = Math.max(0, t - 1);
		else if (e.key === "Home") t = 0;
		else if (e.key === "End") t = H(oe).length - 1;
		else if (e.key === "Enter" || e.key === " ") {
			let n = H(oe)[t];
			n && je(n), e.preventDefault();
			return;
		} else return;
		e.preventDefault(), I(S, H(oe)[t]?.id ?? null, !0), Me();
	}
	function Pe(e) {
		I(b, e, !0);
	}
	function Fe(e) {
		c() !== e && (c(e), u()?.(e));
	}
	function N(e) {
		e.key === "Escape" && H(v)?.open && (e.preventDefault(), e.stopPropagation(), H(v).open = !1, H(v).querySelector("summary")?.focus());
	}
	function Ie(e) {
		return e.tokens === null ? e.overflowed ? "Subtotal exceeds safe range" : "Unavailable" : `${Z(e.tokens)} ${c() === "atCall" ? "estimated tokens" : "estimated token-turns"}`;
	}
	function Le(e) {
		return e.share === null ? "Share unavailable" : `${Va(e.share)} of ${H(ve) ? "available-estimate subset" : "numeric estimates"}`;
	}
	function Re() {
		return !H(D) || H(ye) === 0 ? "No item appearances are in this scope" : H(j) === H(ye) ? "Numeric estimates available for all item appearances in this scope" : `Numeric estimates available for ${Z(H(j))} of ${Z(H(ye))} item appearances in this scope`;
	}
	function ze() {
		let e = [];
		return H(be) > 0 && e.push(`${Z(H(be))} zero-valued items`), H(Se) > 0 && e.push(`${Z(H(Se))} unavailable estimates`), H(Ce) > 0 && e.push(`${Z(H(Ce))} overflowed subtotals`), H(Ee) > 0 && e.push(`${Z(H(Ee))} positive items too small to render at this layout size`), e.join("; ");
	}
	function He() {
		if (!H(D)) return "";
		let e = [];
		return H(D).totalOverflow && e.push("The safe integer range was exceeded; shares and areas are withheld."), H(D).missingItemCallCount > 0 && e.push(`${Z(H(D).missingItemCallCount)} of ${Z(H(D).totalItemCallCount)} item-call contributions have no numeric estimate; subtotals and shares use the available-estimate subset.`), H(D).partialItemCallCount > 0 && e.push(`${Z(H(D).partialItemCallCount)} item-call estimates have partial payload coverage; subtotals remain qualified.`), H(D).unavailableCoverageItemCallCount > 0 && e.push(`${Z(H(D).unavailableCoverageItemCallCount)} item-call estimates have unavailable semantic coverage; any numeric contributions remain usable but qualified.`), e.join(" ");
	}
	function Ue() {
		if (!H(g) || !s()) return;
		let e = H(g).clientWidth;
		e > 0 && Math.abs(e - H(y)) > .5 && I(y, e, !0);
	}
	Cn(() => {
		s() && yr(Ue);
	}), zi(() => {
		Ue();
		let e = typeof ResizeObserver > "u" ? null : new ResizeObserver((e) => {
			let t = e[0]?.contentRect.width;
			s() && t && Math.abs(t - H(y)) > .5 && I(y, t, !0);
		});
		return H(g) && e?.observe(H(g)), window.addEventListener("resize", Ue), () => {
			e?.disconnect(), window.removeEventListener("resize", Ue);
		};
	});
	var We = Fs(), Ge = L(We), Ke = (e) => {
		var t = rs(), n = L(t), r = L(n), i = B(r, 2);
		M(n);
		var a = B(n, 2), o = (e) => {
			var t = ns(), n = L(t), r = B(n, 2);
			M(t), V(() => {
				Y(n, "aria-pressed", H(x) === "treemap"), Y(r, "aria-pressed", H(x) === "list");
			}), U("click", n, () => Pe("treemap")), U("click", r, () => Pe("list")), G(e, t);
		};
		q(a, (e) => {
			H(D) && (c() !== "atCall" || H(T) !== null) && e(o);
		}), M(t), V(() => {
			Y(r, "aria-pressed", c() === "atCall"), Y(i, "aria-pressed", c() === "cumulative");
		}), U("click", r, () => Fe("atCall")), U("click", i, () => Fe("cumulative")), G(e, t);
	};
	q(Ge, (e) => {
		H(w).length > 0 && e(Ke);
	});
	var qe = B(Ge, 2), Je = (e) => {
		G(e, is());
	}, Ye = (e) => {
		var n = as(), r = B(L(n), 2);
		M(n), U("click", r, () => t.onPinCall(H(w)[H(w).length - 1].index)), G(e, n);
	}, Xe = (e) => {
		G(e, os());
	}, Ze = (e) => {
		let r = /* @__PURE__ */ P(He);
		var i = Ps(), s = R(i), u = (e) => {
			var t = ss(), n = z(t, !0);
			V(() => K(n, l())), G(e, t);
		};
		q(s, (e) => {
			l() && c() === "cumulative" && a() === null && e(u);
		});
		var h = B(s, 2), g = L(h), y = L(g), b = z(y, !0), x = z(B(y, 2));
		M(g);
		var C = B(g, 2), w = (e) => {
			var n = ls(), r = L(n), i = L(r), a = B(i, 2);
			M(r);
			var o = B(r, 2), s = (e) => {
				var t = cs();
				U("click", t, function(...e) {
					d()?.apply(this, e);
				}), G(e, t);
			};
			q(o, (e) => {
				c() === "cumulative" && e(s);
			}), M(n), V(() => {
				i.disabled = H(E) === null, a.disabled = H(te) === null;
			}), U("click", i, () => H(E) && t.onPinCall(H(E).index)), U("click", a, () => H(te) && t.onPinCall(H(te).index)), G(e, n);
		};
		q(C, (e) => {
			a() !== null && e(w);
		}), M(h);
		var ee = B(h, 2), k = (e) => {
			var t = us(), n = z(t, !0);
			V((e) => K(n, e), [() => Re()]), G(e, t);
		};
		q(ee, (e) => {
			(H(ye) === 0 || H(j) !== H(ye)) && e(k);
		});
		var re = B(ee, 2), ie = L(re), oe = L(ie), se = B(oe), ce = (e) => {
			_a(e, {
				id: "composition-totals-note",
				label: "About these totals",
				children: (e, t) => {
					xe(), G(e, zr("Totals and shares use only the item appearances with numeric estimates. Some\n            appearances have no estimate or are only partly counted, so the totals can be lower than\n            the true figure."));
				},
				$$slots: { default: !0 }
			});
		};
		q(se, (e) => {
			H(ve) && e(ce);
		}), M(ie);
		var be = B(ie, 2), Se = L(be), Ce = B(Se), we = (e) => {
			var t = zr();
			V((e) => K(t, `· ${e ?? ""} with numeric estimates`), [() => Z(H(D).measuredItemCount)]), G(e, t);
		};
		q(Ce, (e) => {
			H(D).unmeasuredItemCount > 0 && e(we);
		}), M(be);
		var Te = B(be, 2), Ee = (e) => {
			var t = ds(), n = z(t);
			V((e) => K(n, `${e ?? ""} items unavailable`), [() => Z(H(D).unmeasuredItemCount)]), G(e, t);
		};
		q(Te, (e) => {
			H(D).unmeasuredItemCount > 0 && e(Ee);
		}), M(re);
		var Me = B(re, 2), Fe = B(L(Me), 2), Be = z(Fe), Ve = B(Fe, 2), Ue = (e) => {
			var t = ps();
			J(t, 21, () => H(pe), (e) => e.id, (e, t) => {
				var n = fs(), r = L(n), i = B(r), a = z(i, !0);
				Ya(B(i, 2), {
					get value() {
						return H(t).id;
					},
					label: "profile ID"
				}), M(n), V(() => {
					K(r, `${H(t).description ?? ""} · `), K(a, H(t).id);
				}), G(e, n);
			}), M(t), G(e, t);
		}, We = (e) => {
			var t = ms(), n = L(t), r = z(n, !0);
			Ya(B(n, 2), {
				get value() {
					return H(T).tokenizationProfileId;
				},
				label: "profile ID"
			}), M(t), V(() => K(r, H(T).tokenizationProfileId)), G(e, t);
		};
		q(Ve, (e) => {
			c() === "cumulative" && H(pe).length > 0 ? e(Ue) : c() === "atCall" && H(T)?.tokenizationProfileId && e(We, 1);
		});
		var Ge = z(B(Ve, 2));
		M(Me);
		var Ke = B(Me, 2), qe = (e) => {
			var t = hs(), n = z(t, !0);
			V(() => K(n, H(r))), G(e, t);
		};
		q(Ke, (e) => {
			H(r) && e(qe);
		});
		var Je = B(Ke, 2), Ye = (e) => {
			G(e, gs());
		}, Xe = (e) => {
			G(e, _s());
		};
		q(Je, (e) => {
			H(D).allMeasuredZero ? e(Ye) : H(D).measuredItemCount === 0 && e(Xe, 1);
		});
		var Ze = B(Je, 2), Qe = L(Ze), $e = B(Qe, 2), et = L($e), tt = L(et), nt = (e) => {
			G(e, zr("Token-turns count an item's estimated tokens each time it appears in a model call. This\n            is input-context exposure, not unique content, provider usage, billed tokens, or cost."));
		}, rt = (e) => {
			G(e, zr("Areas use only this call's applicable item estimates. Shares use the numeric-estimate\n            subset; unknown estimates are not inferred from provider totals."));
		};
		q(tt, (e) => {
			c() === "cumulative" ? e(nt) : e(rt, -1);
		}), M(et), xe(4), M($e), M(Ze), Li(Ze, (e) => I(v, e), () => H(v));
		var it = B(Ze, 2), at = (e) => {
			var r = Ts(), i = R(r), a = (e) => {
				var t = vs(), n = L(t), r = B(n);
				M(t), V((e, t, r) => K(n, `Treemap shows ${e ?? ""} of ${t ?? ""} items. ${r ?? ""}. `), [
					() => Z(H(ne).rectangles.length),
					() => Z(H(D).items.length),
					() => ze()
				]), U("click", r, () => Pe("list")), G(e, t);
			};
			q(i, (e) => {
				H(ne).rectangles.length < H(D).items.length && e(a);
			});
			var s = B(i, 2), c = L(s);
			Y(c, "height", 360);
			var l = L(c), u = L(l);
			J(u, 17, () => H(ne).groups, (e) => e.kind, (e, t) => {
				var n = ys(), r = L(n);
				Y(r, "height", 13), M(n), V((e) => {
					Y(n, "id", `composition-group-clip-${H(t).kind}`), Y(r, "x", H(t).x + 3), Y(r, "y", H(t).y + 1), Y(r, "width", e);
				}, [() => Math.max(0, H(t).width - 6)]), G(e, n);
			}), J(B(u), 17, () => H(ne).rectangles, (e) => e.item.id, (e, t) => {
				var n = ys(), r = z(n);
				V((e, i, a) => {
					Y(n, "id", e), Y(r, "x", H(t).x + 4), Y(r, "y", H(t).y + 3), Y(r, "width", i), Y(r, "height", a);
				}, [
					() => Oe(H(t).optionIndex),
					() => Math.max(0, H(t).width - 8),
					() => Math.max(0, H(t).height - 6)
				]), G(e, n);
			}), M(l);
			var d = B(l);
			J(d, 17, () => H(ne).groups, (e) => e.kind, (e, t) => {
				var n = xs(), r = L(n), i = z(r, !0), a = B(r), o = B(a), s = (e) => {
					var n = bs(), r = z(n, !0);
					V(() => {
						Y(n, "x", H(t).x + 5), Y(n, "y", H(t).y + 11), Y(n, "clip-path", `url(#composition-group-clip-${H(t).kind})`), K(r, H(t).labelText);
					}), G(e, n);
				};
				q(o, (e) => {
					H(t).labelText && e(s);
				}), M(n), V(() => {
					Y(n, "aria-label", `${H(t).label} group`), K(i, H(t).label), Y(a, "x", H(t).x), Y(a, "y", H(t).y), Y(a, "width", H(t).width), Y(a, "height", H(t).height);
				}), G(e, n);
			}), J(B(d), 17, () => H(ne).rectangles, (e) => e.item.id, (e, r) => {
				var i = ws();
				let a;
				var s = L(i), c = z(s, !0), l = B(s);
				let u;
				var d = B(l), f = (e) => {
					var i = Cs(), a = L(i);
					let o;
					var s = z(a, !0), c = B(a), l = (e) => {
						var i = Ss();
						let a;
						var o = z(i);
						V((e, t, n) => {
							Y(i, "x", H(r).x + 5), Y(i, "y", H(r).y + 31), a = vi(i, "", a, { fill: e }), K(o, `${t ?? ""}${n ?? ""}`);
						}, [
							() => Ta(wa(t.indexed, H(r).item.id, n())),
							() => Z(H(r).item.tokens),
							() => H(r).item.share === null ? "" : ` · ${Va(H(r).item.share)}`
						]), G(e, i);
					};
					q(c, (e) => {
						H(r).height >= 49 && e(l);
					}), M(i), V((e, t) => {
						Y(i, "clip-path", e), Y(a, "x", H(r).x + 5), Y(a, "y", H(r).y + 16), o = vi(a, "", o, { fill: t }), K(s, H(r).labelText);
					}, [() => `url(#${Oe(H(r).optionIndex)})`, () => Ta(wa(t.indexed, H(r).item.id, n()))]), G(e, i);
				};
				q(d, (e) => {
					H(r).labelFits && H(r).labelText && e(f);
				}), M(i), V((e, t, n, s) => {
					Y(i, "id", e), Y(i, "aria-selected", o() === H(r).item.id), Y(i, "aria-label", t), Y(i, "data-composition-item", H(r).item.id), a = gi(i, 0, "svelte-8fl9lq", null, a, {
						selected: o() === H(r).item.id,
						active: H(S) === H(r).item.id
					}), K(c, n), Y(l, "x", H(r).x), Y(l, "y", H(r).y), Y(l, "width", H(r).width), Y(l, "height", H(r).height), Y(l, "fill", s), u = gi(l, 0, "svelte-8fl9lq", null, u, { partial: H(r).item.estimateCoverage !== "complete" });
				}, [
					() => De(H(r).optionIndex),
					() => Ae(H(r).item),
					() => Ae(H(r).item),
					() => wa(t.indexed, H(r).item.id, n())
				]), U("pointerup", i, () => je(H(r).item)), G(e, i);
			}), M(c), M(s), V(() => {
				Y(c, "width", H(ne).width), Y(c, "viewBox", `0 0 ${H(ne).width} 360`), Y(c, "aria-label", `${H(he)} treemap; ${H(ne).rectangles.length} visible tiles of ${H(D).items.length} items; use arrow keys to inspect`), Y(c, "aria-activedescendant", H(le));
			}), U("keydown", c, Ne), G(e, r);
		}, ot = (e) => {
			var r = Os();
			J(r, 23, () => H(O), (e) => e.id, (e, r, i) => {
				var a = Ds();
				let s;
				var l = L(a), u = B(l, 2), d = L(u), f = z(d, !0), p = B(d, 2), m = z(p), h = B(p, 2), g = (e) => {
					var t = Es(), n = z(t);
					V((e, t, r) => K(n, `${e ?? ""} of ${t ?? ""} item-call contributions numeric · ${r ?? ""} unavailable`), [
						() => Z(H(r).knownContributionCount),
						() => Z(H(r).scopePresenceCount),
						() => Z(H(r).missingContributionCount)
					]), G(e, t);
				};
				q(h, (e) => {
					c() === "cumulative" && e(g);
				});
				var _ = B(h, 2), v = (e) => {
					var t = Es(), n = z(t);
					V((e, t, r) => K(n, `Known subtotal only; ${e ?? ""} missing,
                  ${t ?? ""} partial-coverage, and
                  ${r ?? ""} unavailable-semantic contributions.`), [
						() => Z(H(r).missingContributionCount),
						() => Z(H(r).partialEstimateContributionCount),
						() => Z(H(r).unavailableCoverageContributionCount)
					]), G(e, t);
				};
				q(_, (e) => {
					(H(r).missingContributionCount > 0 || H(r).partialEstimateContributionCount > 0 || H(r).unavailableCoverageContributionCount > 0) && e(v);
				}), J(B(_, 2), 17, () => H(r).explanations, (e) => e.title, (e, t) => {
					var n = Es(), r = z(n);
					V(() => K(r, `${H(t).title ?? ""}: ${H(t).impact ?? ""}`)), G(e, n);
				}), M(u);
				var y = B(u, 2), b = L(y), x = z(b, !0), C = B(b, 2), w = z(C, !0), ee = z(B(C, 2), !0);
				M(y), M(a), V((e, t, n, i, u, d) => {
					Y(a, "id", e), s = gi(a, 1, "composition-row svelte-8fl9lq", null, s, {
						selected: o() === H(r).id,
						active: H(S) === H(r).id,
						unavailable: H(r).tokens === null
					}), Y(a, "aria-selected", o() === H(r).id), Y(a, "aria-label", t), Y(a, "data-composition-item", H(r).id), vi(l, n), K(f, H(r).label), K(m, `${H(r).kindLabel ?? ""} · ${i ?? ""} · ${H(r).estimateCoverage ?? ""} estimate coverage`), K(x, u), K(w, d), K(ee, H(r).ageAtCall === null ? "Age unavailable" : `${H(r).ageAtCall} calls old at ${c() === "atCall" ? "this call" : "scope endpoint"}`);
				}, [
					() => De(H(i)),
					() => Ae(H(r)),
					() => `background:${wa(t.indexed, H(r).id, n())}`,
					() => H(r).estimateMethods.length > 1 ? "Mixed estimate methods" : ke(H(r).estimateMethod),
					() => Ie(H(r)),
					() => Le(H(r))
				]), U("pointerup", a, () => je(H(r))), G(e, a);
			}), M(r), Li(r, (e) => I(_, e), () => H(_)), V(() => {
				Y(r, "aria-label", `${H(he)} items ranked by estimated contribution; ${H(O).length} items`), Y(r, "aria-activedescendant", H(le));
			}), U("keydown", r, Ne), G(e, r);
		};
		q(it, (e) => {
			H(ae) === "treemap" ? e(at) : e(ot, -1);
		});
		var st = B(it, 2), ct = (e) => {
			var t = Ms(), n = L(t), r = L(n), i = z(r, !0), a = B(r, 2), o = (e) => {
				var t = ks(), n = R(t), r = z(n), i = B(n, 2), a = (e) => {
					var t = Es(), n = z(t);
					V((e, t, r) => K(n, `Known subtotal; ${e ?? ""} item-call
                estimates unavailable, ${t ?? ""} partial-coverage, and ${r ?? ""} unavailable-semantic.`), [
						() => Z(H(de).missingContributionCount),
						() => Z(H(de).partialEstimateContributionCount),
						() => Z(H(de).unavailableCoverageContributionCount)
					]), G(e, t);
				};
				q(i, (e) => {
					(H(de).missingContributionCount > 0 || H(de).partialEstimateContributionCount > 0 || H(de).unavailableCoverageContributionCount > 0) && e(a);
				}), V((e, t) => K(r, `${e ?? ""} · ${t ?? ""}`), [() => Ie(H(de)), () => Le(H(de))]), G(e, t);
			}, s = (e) => {
				var t = As(), n = z(t, !0);
				V(() => K(n, c() === "atCall" ? `Not present at call ${H(T)?.index ?? "Unknown"}.` : "No contribution within this cumulative scope.")), G(e, t);
			};
			q(a, (e) => {
				H(de) ? e(o) : e(s, -1);
			}), M(n);
			var l = B(n, 2), u = L(l), d = B(u, 2), h = B(d, 2), g = (e) => {
				var t = js();
				U("click", t, () => f()(H(ue).id)), G(e, t);
			};
			q(h, (e) => {
				H(fe) && e(g);
			}), M(l), M(t), V(() => K(i, H(ue).label)), U("click", u, function(...e) {
				p()?.apply(this, e);
			}), U("click", d, () => m()(H(ue).id)), G(e, t);
		};
		q(st, (e) => {
			o() && H(ue) && e(ct);
		});
		var lt = B(st, 2), ut = (e) => {
			var t = Ns(), n = B(L(t), 4), r = L(n), i = z(B(L(r), 2));
			M(r);
			var a = B(r, 2), o = z(B(L(a), 2));
			M(a);
			var s = B(a, 2), c = z(B(L(s), 2));
			M(s);
			var l = B(s, 2), u = z(B(L(l), 2), !0);
			M(l), M(n), M(t), V((e, t, n, r) => {
				K(i, `${e ?? ""} tokens`), K(o, `${t ?? ""} tokens`), K(c, `${n ?? ""} tokens`), K(u, r);
			}, [
				() => Z(H(T).reportedPromptTokens),
				() => Z(H(T).tokenAnalysis.calculatedVisibleTokens),
				() => Z(H(T).tokenAnalysis.knownFramingOverheadTokens),
				() => H(T).tokenAnalysis.residualTokens === null ? "Unknown" : `${Z(H(T).tokenAnalysis.residualTokens)} tokens`
			]), G(e, t);
		};
		q(lt, (e) => {
			c() === "atCall" && H(T) && e(ut);
		}), V((e, t, n, r, i, a, o) => {
			K(b, H(he)), K(x, `${H(_e) ?? ""} · ${H(ge) ?? ""}`), K(oe, `${e ?? ""}
        ${H(A) ?? ""}`), K(Se, `${t ?? ""} items `), K(Be, `Tokenizer: ${H(me) ?? ""}`), K(Ge, `${n ?? ""} of ${r ?? ""} item appearances
        have numeric estimates in this ${c() === "atCall" ? "call" : "cumulative scope"}.
        ${i ?? ""} are missing, ${a ?? ""} have partial payload coverage, and ${o ?? ""} have unavailable semantic coverage.`);
		}, [
			() => Z(H(D).measuredTokenTotal),
			() => Z(H(D).items.length),
			() => Z(H(j)),
			() => Z(H(ye)),
			() => Z(H(D).missingItemCallCount),
			() => Z(H(D).partialItemCallCount),
			() => Z(H(D).unavailableCoverageItemCallCount)
		]), U("keydown", Qe, N), G(e, i);
	};
	q(qe, (e) => {
		H(w).length === 0 ? e(Je) : c() === "atCall" && !H(T) ? e(Ye, 1) : H(D) ? e(Ze, -1) : e(Xe, 2);
	}), M(We), Li(We, (e) => I(g, e), () => H(g)), G(e, We), Ve(), i();
}
kr([
	"click",
	"keydown",
	"pointerup"
]);
//#endregion
//#region src/lib/components/RiverCallJump.svelte
var Rs = /* @__PURE__ */ W("<p role=\"status\" class=\"svelte-1gbti2\"> </p>"), zs = /* @__PURE__ */ W("<div class=\"call-jump svelte-1gbti2\"><form novalidate=\"\" class=\"svelte-1gbti2\"><label class=\"svelte-1gbti2\">Go to call <input aria-label=\"Call number\" type=\"number\" inputmode=\"numeric\" step=\"1\" class=\"svelte-1gbti2\"/></label> <button type=\"submit\" title=\"Pin this call without changing zoom\">Go</button></form> <!></div>"), Bs = {
	hash: "svelte-1gbti2",
	code: ".call-jump.svelte-1gbti2 {min-width:0;margin-left:7px;}form.svelte-1gbti2 {display:flex;flex-wrap:wrap;align-items:center;gap:7px;}label.svelte-1gbti2 {display:flex;align-items:center;gap:6px;font-size:var(--text-sm);}input.svelte-1gbti2 {width:64px;min-width:0;padding:5px;}p.svelte-1gbti2 {color:var(--secondary);font-size:var(--text-sm);}"
};
function Vs(e, t) {
	Be(t, !0), li(e, Bs);
	let n = X(t, "ready", 3, !1), r = X(t, "onDone", 3, () => {}), i = X(t, "message", 15, ""), a = X(t, "hideMessage", 3, !1), o = /* @__PURE__ */ F(""), s = /* @__PURE__ */ P(() => !n() || t.callIndices.length === 0), c = /* @__PURE__ */ P(() => t.callIndices[0] ?? 1), l = /* @__PURE__ */ P(() => t.callIndices[t.callIndices.length - 1] ?? 1);
	function u(e) {
		if (e.key === "Escape") {
			if (e.isComposing) {
				e.stopPropagation();
				return;
			}
			e.preventDefault(), e.stopPropagation(), I(o, ""), i("");
		}
	}
	function d(e) {
		e.preventDefault();
		let n = la(String(H(o)), t.callIndices);
		if (n === null) {
			i("Enter a whole-number call index.");
			return;
		}
		i(Number(H(o)) === n ? "" : `Call ${H(o)} is not available; moving to call ${n}.`), t.onJumpToCall(n), r()();
	}
	var f = zs(), p = L(f), m = L(p), h = B(L(m));
	ki(h), M(m);
	var g = B(m, 2);
	M(p);
	var _ = B(p, 2), v = (e) => {
		var t = Rs(), n = z(t, !0);
		V(() => K(n, i())), G(e, t);
	};
	q(_, (e) => {
		i() && !a() && e(v);
	}), M(f), V(() => {
		Y(h, "min", H(c)), Y(h, "max", H(l)), h.disabled = H(s), g.disabled = H(s);
	}), Or("submit", p, d), U("keydown", h, u), Ni(h, () => H(o), (e) => I(o, e)), G(e, f), Ve();
}
kr(["keydown"]);
//#endregion
//#region src/lib/components/CompactMenu.svelte
var Hs = /* @__PURE__ */ W("<details class=\"view-options compact-menu svelte-1ilwl0u\"><summary class=\"svelte-1ilwl0u\"> </summary> <div class=\"menu-panel svelte-1ilwl0u\" role=\"group\"><!></div></details>"), Us = {
	hash: "svelte-1ilwl0u",
	code: ".compact-menu.svelte-1ilwl0u {position:relative;}summary.svelte-1ilwl0u {display:inline-flex;align-items:center;gap:6px;min-height:var(--control-size);padding:var(--toggle-padding);border:1px solid var(--separator);border-radius:var(--control-radius);background:var(--surface);color:var(--text);list-style:none;white-space:nowrap;}summary.svelte-1ilwl0u::-webkit-details-marker {display:none;}summary.svelte-1ilwl0u::after {content:'';width:0;height:0;border-top:5px solid currentColor;border-right:4px solid transparent;border-left:4px solid transparent;}.compact-menu[open].svelte-1ilwl0u > summary:where(.svelte-1ilwl0u) {border-color:var(--accent);}.menu-panel.svelte-1ilwl0u {position:absolute;top:calc(100% + 4px);right:0;z-index:6;display:flex;flex-wrap:wrap;align-items:center;gap:8px;width:max-content;max-width:min(320px, calc(100cqw - 24px));padding:10px;border:1px solid var(--separator);border-radius:var(--radius);background:var(--surface-raised);box-shadow:0 6px 18px rgb(0 0 0 / 0.18);}"
};
function Ws(e, t) {
	Be(t, !0), li(e, Us);
	let n = /* @__PURE__ */ F(!1), r;
	Cn(() => {
		if (!H(n)) return;
		let e = (e) => {
			e.composedPath().includes(r) || I(n, !1);
		};
		return document.addEventListener("pointerdown", e, !0), () => document.removeEventListener("pointerdown", e, !0);
	});
	var i = Hs(), a = L(i), o = z(a, !0), s = B(a, 2);
	ci(L(s), () => t.children), M(s), M(i), Li(i, (e) => r = e, () => r), V(() => {
		K(o, t.label), Y(s, "aria-label", t.label);
	}), Ri("open", "toggle", i, (e) => I(n, e), () => H(n)), G(e, i), Ve();
}
//#endregion
//#region src/lib/components/ContextRiverNavigation.svelte
var Gs = /* @__PURE__ */ W("<button type=\"button\" class=\"step-call svelte-i2yay7\" aria-label=\"Previous call\" aria-keyshortcuts=\"ArrowLeft h\" title=\"Previous call (← / h)\">‹</button>"), Ks = /* @__PURE__ */ W("<button type=\"button\" class=\"step-call svelte-i2yay7\" aria-label=\"Next call\" aria-keyshortcuts=\"ArrowRight l\" title=\"Next call (→ / l)\">›</button>"), qs = /* @__PURE__ */ W("<span class=\"zoom-level svelte-i2yay7\"> </span> <button type=\"button\" aria-label=\"Zoom out\" title=\"Zoom out\">−</button> <button type=\"button\" aria-label=\"Zoom in\" title=\"Zoom in\">+</button> <button type=\"button\" aria-label=\"Fit all calls\" title=\"Fit all calls\">Fit all</button> <button type=\"button\">Latest</button> <!>", 1), Js = /* @__PURE__ */ W("<div class=\"controls svelte-i2yay7\" role=\"group\" aria-label=\"Chart zoom and navigation\"><!> <span class=\"range svelte-i2yay7\" aria-live=\"polite\" data-testid=\"visible-call-range\"> </span> <!> <!></div>"), Ys = /* @__PURE__ */ W("<div class=\"viewport-status svelte-i2yay7\"><span class=\"range svelte-i2yay7\" aria-live=\"polite\" data-testid=\"visible-call-range\"> </span></div> <div class=\"controls svelte-i2yay7\" role=\"group\" aria-label=\"Chart zoom and navigation\"><!> <!> <!></div>", 1), Xs = /* @__PURE__ */ W("<p class=\"jump-message svelte-i2yay7\" role=\"status\"> </p>"), Zs = /* @__PURE__ */ W("<div role=\"group\" aria-label=\"Context River navigation\"><!> <!></div>"), Qs = {
	hash: "svelte-i2yay7",
	code: ".viewport-navigation.svelte-i2yay7 {display:grid;grid-template-columns:minmax(0, 1fr) minmax(0, auto);align-items:start;gap:10px 16px;margin:8px 0 12px;min-width:0;}\n  /* One button row tall, so the range lines up with the first row of controls even when\n     they wrap onto a second row. */.viewport-status.svelte-i2yay7 {display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;min-width:0;min-height:var(--control-size);}.range.svelte-i2yay7 {color:var(--text);font-variant-numeric:tabular-nums;font-weight:600;}.controls.svelte-i2yay7 {display:flex;grid-column:2;grid-row:1;align-self:start;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:7px;}.jump-message.svelte-i2yay7 {grid-column:1 / -1;margin:0;color:var(--secondary);font-size:var(--text-sm);}.step-call.svelte-i2yay7 {width:var(--control-size);height:var(--control-size);padding:0;flex:0 0 var(--control-size);font-size:22px;line-height:1;}.zoom-level.svelte-i2yay7 {color:var(--secondary);font-size:var(--text-sm);font-variant-numeric:tabular-nums;}.compact.svelte-i2yay7 {grid-template-columns:minmax(0, 1fr);}.compact.svelte-i2yay7 .controls:where(.svelte-i2yay7) {grid-column:1;flex-wrap:nowrap;justify-content:flex-start;}.compact.svelte-i2yay7 .range:where(.svelte-i2yay7) {min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}.compact.svelte-i2yay7 .compact-menu {margin-left:auto;}\n  @container highwater (max-width: 760px) {.viewport-navigation.svelte-i2yay7 {grid-template-columns:minmax(0, 1fr);}.controls.svelte-i2yay7 {grid-column:1;grid-row:2;justify-content:flex-start;}\n  }"
};
function $s(e, t) {
	Be(t, !0), li(e, Qs);
	let n = (e) => {
		var t = Gs();
		Li(t, (e) => m = e, () => m), V(() => t.disabled = H(f) === null || !c()), U("click", t, () => H(f) !== null && o()(H(f))), G(e, t);
	}, r = (e) => {
		var t = Ks();
		Li(t, (e) => h = e, () => h), V(() => t.disabled = H(p) === null || !c()), U("click", t, () => H(p) !== null && o()(H(p))), G(e, t);
	}, i = (e) => {
		var n = qs(), r = R(n), i = z(r), a = B(r, 2), o = B(a, 2), l = B(o, 2), f = B(l, 2), p = B(f, 2);
		{
			let e = /* @__PURE__ */ P(() => t.viewport.ready && c());
			Vs(p, {
				get callIndices() {
					return t.callIndices;
				},
				get ready() {
					return H(e);
				},
				get onJumpToCall() {
					return s();
				},
				hideMessage: !0,
				get message() {
					return H(u);
				},
				set message(e) {
					I(u, e, !0);
				}
			});
		}
		V((e) => {
			K(i, `Zoom ${e ?? ""}×`), a.disabled = !t.viewport.ready || H(d) || !t.viewport.canZoomOut, o.disabled = !t.viewport.ready || H(d) || !t.viewport.canZoomIn, l.disabled = !t.viewport.ready || H(d) || t.viewport.isFitAll, f.disabled = !t.viewport.ready || H(d) || !t.viewport.hasOverflow;
		}, [() => t.viewport.zoomFactor.toFixed(1)]), U("click", a, function(...e) {
			t.onZoomOut?.apply(this, e);
		}), U("click", o, function(...e) {
			t.onZoomIn?.apply(this, e);
		}), U("click", l, function(...e) {
			t.onFitAll?.apply(this, e);
		}), U("click", f, function(...e) {
			t.onLatest?.apply(this, e);
		}), G(e, n);
	}, a = X(t, "pinnedCallIndex", 3, null), o = X(t, "onSelectCall", 3, () => {}), s = X(t, "onJumpToCall", 3, (e) => o()(e)), c = X(t, "isVisible", 3, !0), l = X(t, "compact", 3, !1), u = /* @__PURE__ */ F(""), d = /* @__PURE__ */ P(() => t.callIndices.length === 0), f = /* @__PURE__ */ P(() => t.viewport.ready ? na(t.callIndices, a(), t.viewport, -1) : null), p = /* @__PURE__ */ P(() => t.viewport.ready ? na(t.callIndices, a(), t.viewport, 1) : null), m, h;
	Tn(() => {
		H(p) === null && H(f) !== null && Vi(h).activeElement === h && gr().then(() => m.focus()), H(f) === null && H(p) !== null && Vi(m).activeElement === m && gr().then(() => h.focus());
	});
	let g = /* @__PURE__ */ P(() => H(d) ? "No model calls" : t.viewport.ready ? t.viewport.firstVisibleCallIndex === null || t.viewport.lastVisibleCallIndex === null ? `No call markers visible of ${t.callIndices.length}` : t.viewport.firstVisibleCallIndex === t.viewport.lastVisibleCallIndex ? `Call ${t.viewport.firstVisibleCallIndex} of ${t.callIndices.length}` : `Calls ${t.viewport.firstVisibleCallIndex}–${t.viewport.lastVisibleCallIndex} of ${t.callIndices.length}` : "Measuring chart viewport…");
	var _ = Zs();
	let v;
	var y = L(_), b = (e) => {
		var t = Js(), a = L(t);
		n(a);
		var o = B(a, 2), s = z(o, !0), c = B(o, 2);
		r(c), Ws(B(c, 2), {
			label: "More",
			children: (e, t) => {
				i(e);
			},
			$$slots: { default: !0 }
		}), M(t), V(() => K(s, H(g))), G(e, t);
	}, x = (e) => {
		var t = Ys(), a = R(t), o = z(L(a), !0);
		M(a);
		var s = B(a, 2), c = L(s);
		n(c);
		var l = B(c, 2);
		r(l);
		var u = B(l, 2);
		i(u), M(s), V(() => K(o, H(g))), G(e, t);
	};
	q(y, (e) => {
		l() ? e(b) : e(x, -1);
	});
	var S = B(y, 2), C = (e) => {
		var t = Xs(), n = z(t, !0);
		V(() => K(n, H(u))), G(e, t);
	};
	q(S, (e) => {
		H(u) && e(C);
	}), M(_), V(() => v = gi(_, 1, "viewport-navigation svelte-i2yay7", null, v, { compact: l() })), G(e, _), Ve();
}
kr(["click"]);
//#endregion
//#region src/lib/context-river/lifespans.ts
function ec(e, t, n) {
	if (e.length === 0 || !Number.isFinite(n)) return null;
	let r = (t) => {
		let n = 0, r = e.length;
		for (; n < r;) {
			let i = n + Math.floor((r - n) / 2);
			e[i] < t ? n = i + 1 : r = i;
		}
		return n;
	}, i = r(t.startCall), a = r(t.endCall), o = a < e.length && e[a] === t.endCall ? a : a - 1;
	if (i > o || i >= e.length) return null;
	let s = Math.round(Math.max(0, Math.min(1, n)) * (e.length - 1));
	return e[Math.max(i, Math.min(o, s))];
}
function tc(e) {
	return e.presenceCallCount;
}
function nc(e) {
	return e.tokenTurns;
}
function rc(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e) for (let e of n.tokenEstimates) e.tokens !== null && Number.isFinite(e.tokens) && t.set(e.profileId, (t.get(e.profileId) ?? 0) + 1);
	let n = null, r = 0;
	for (let [e, i] of t) (i > r || i === r && n !== null && fc(e, n) < 0) && (n = e, r = i);
	return n;
}
function ic(e, t) {
	return t === null ? null : e.tokenEstimates.find((e) => e.profileId === t)?.tokens ?? null;
}
function ac(e) {
	let t = e.map(nc).filter((e) => e !== null);
	return t.length === 0 ? null : t.reduce((e, t) => e + t, 0);
}
function oc(e) {
	return e.reduce((e, t) => e + tc(t), 0);
}
function sc(e, t = "tokenTurns", n = null, r = (e) => [e]) {
	let i = new Map(e.map((e, t) => [e.id, t])), a = (e) => {
		let t = r(e);
		return t[t.length - 1] ?? e;
	};
	return [...e].sort((e, o) => {
		let s = 0;
		return s = t === "firstAppearance" ? dc(lc(e), lc(o)) : t === "presenceCount" ? oc(r(o)) - oc(r(e)) : t === "size" ? uc(ic(a(e), n), ic(a(o), n)) : uc(ac(r(e)), ac(r(o))), s || (i.get(e.id) ?? 2 ** 53 - 1) - (i.get(o.id) ?? 2 ** 53 - 1) || fc(e.id, o.id);
	});
}
function cc(e, t = 8) {
	if (e.length <= t) return [...e];
	let n = Math.max(2, Math.floor(t)), r = /* @__PURE__ */ new Set();
	for (let t = 0; t < n; t += 1) r.add(Math.round(t * (e.length - 1) / (n - 1)));
	return [...r].map((t) => e[t]);
}
function lc(e) {
	return e.firstModelCall > 0 ? e.firstModelCall : null;
}
function uc(e, t) {
	return e === null ? t === null ? 0 : 1 : t === null ? -1 : t - e;
}
function dc(e, t) {
	return e === null ? t === null ? 0 : 1 : t === null ? -1 : e - t;
}
function fc(e, t) {
	return e < t ? -1 : +(e > t);
}
//#endregion
//#region src/lib/item-versions.ts
function pc(e) {
	return e.kind === "system" ? "system" : e.kind === "toolDefinition" && e.metadata.toolName ? `toolDefinition:${e.metadata.toolName}` : null;
}
function mc(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e) {
		let e = pc(n);
		if (e === null || n.presence.length === 0) continue;
		let r = t.get(e);
		r ? r.push(n) : t.set(e, [n]);
	}
	let n = /* @__PURE__ */ new Map();
	for (let e of t.values()) {
		if (e.length < 2) continue;
		let t = [...e].sort((e, t) => e.firstModelCall - t.firstModelCall);
		if (!t.some((e, n) => n > 0 && e.firstModelCall <= t[n - 1].lastModelCall)) for (let [e, r] of t.entries()) n.set(r.id, {
			firstId: t[0].id,
			number: e + 1,
			count: t.length,
			previousId: t[e - 1]?.id ?? null,
			nextId: t[e + 1]?.id ?? null
		});
	}
	return n;
}
function hc(e, t, n) {
	let r = t.get(n)?.firstId ?? n, i = [];
	for (let n = r; n !== null;) {
		let r = e.get(n);
		if (!r) break;
		i.push(r), n = t.get(n)?.nextId ?? null;
	}
	return i;
}
function gc(e) {
	return [...new Set(e.map((e) => e.metadata.toolName ?? e.label))].sort();
}
function _c(e, t, n) {
	let r = e.filter((e) => e.kind === "toolDefinition"), i = r.filter((e) => e.firstModelCall === n), a = gc(i.filter((e) => t.get(e.id)?.previousId)), o = gc(i.filter((e) => !t.get(e.id)?.previousId)), s = gc(r.filter((e) => e.presence.length > 0 && e.lastModelCall === n - 1 && !t.get(e.id)?.nextId)), c = [
		o.length > 0 ? `tools added: ${o.join(", ")}` : "",
		a.length > 0 ? `tool definitions changed: ${a.join(", ")}` : "",
		s.length > 0 ? `tools removed: ${s.join(", ")}` : ""
	].filter(Boolean);
	return c.length > 0 ? c.join("; ") : "the prompt text changed";
}
//#endregion
//#region src/lib/components/ContextLifespans.svelte
var vc = /* @__PURE__ */ W("<span class=\"result-count svelte-1pk7niq\"> </span>"), yc = /* @__PURE__ */ W("<option> </option>"), bc = /* @__PURE__ */ W("<button class=\"clear-filters svelte-1pk7niq\" type=\"button\">Clear filters</button>"), xc = /* @__PURE__ */ W("<div class=\"browse-controls svelte-1pk7niq\" role=\"group\" aria-label=\"Filter and sort context items\"><label class=\"search-field svelte-1pk7niq\" for=\"lifespan-search\"><span id=\"lifespan-search-label\">Search items</span> <input id=\"lifespan-search\" aria-labelledby=\"lifespan-search-label\" type=\"search\" placeholder=\"Label or preview\" class=\"svelte-1pk7niq\"/></label> <label class=\"browse-field kind-field svelte-1pk7niq\" for=\"lifespan-kind\"><span>Kind</span> <select id=\"lifespan-kind\" aria-label=\"Filter by kind\" class=\"svelte-1pk7niq\"><option>All kinds</option><!></select></label> <label class=\"browse-field sort-field svelte-1pk7niq\" for=\"lifespan-sort\"><span>Sort by</span> <select id=\"lifespan-sort\" aria-label=\"Sort items\" class=\"svelte-1pk7niq\"><option>Token-turn exposure</option><option>Size (tokens)</option><option>First appearance</option><option>Lifetime (calls present)</option></select></label> <label class=\"browse-field scope-field svelte-1pk7niq\" for=\"lifespan-scope\"><span>Scope</span> <select id=\"lifespan-scope\" aria-label=\"Scope context items\" class=\"svelte-1pk7niq\"><option>Whole session</option><option> </option></select></label> <!></div>"), Sc = /* @__PURE__ */ W("<div class=\"compact-browse svelte-1pk7niq\"><!></div>"), Cc = /* @__PURE__ */ W("<button type=\"button\" class=\"svelte-1pk7niq\"> </button>"), wc = /* @__PURE__ */ W("<span class=\"scope-help svelte-1pk7niq\">Pin a call in Context River to enable call-specific scope.</span>"), Tc = /* @__PURE__ */ W("<p class=\"scope-status svelte-1pk7niq\" role=\"status\"> </p>"), Ec = /* @__PURE__ */ W("<button type=\"button\" class=\"svelte-1pk7niq\">Reset filters and find item</button>"), Dc = /* @__PURE__ */ W("<p class=\"find-status svelte-1pk7niq\" role=\"status\"> <!></p>"), Oc = /* @__PURE__ */ W("<p class=\"sort-help svelte-1pk7niq\"> </p>"), kc = /* @__PURE__ */ W("<p class=\"selection-note svelte-1pk7niq\">The selected item is hidden by these filters; its inspector remains available.</p>"), Ac = /* @__PURE__ */ W("<span class=\"axis-pin-marker svelte-1pk7niq\" aria-hidden=\"true\"><span class=\"svelte-1pk7niq\"> </span></span>"), jc = /* @__PURE__ */ W("<span> </span>"), Mc = /* @__PURE__ */ W("<span class=\"axis-boundary svelte-1pk7niq\" aria-hidden=\"true\"></span>"), Nc = /* @__PURE__ */ W("<p class=\"empty-state svelte-1pk7niq\">No context items in this session.</p>"), Pc = /* @__PURE__ */ W("<p class=\"empty-state svelte-1pk7niq\">No items match these filters. Clear filters to see the full list.</p>"), Fc = /* @__PURE__ */ W("<span class=\"pin-marker svelte-1pk7niq\" aria-hidden=\"true\"></span>"), Ic = /* @__PURE__ */ W("<span class=\"boundary svelte-1pk7niq\" aria-hidden=\"true\"></span>"), Lc = /* @__PURE__ */ W("<button type=\"button\"></button>"), Rc = /* @__PURE__ */ W("<span class=\"version-mark svelte-1pk7niq\" aria-hidden=\"true\"></span>"), zc = /* @__PURE__ */ W("<!> <!>", 1), Bc = /* @__PURE__ */ W("<small class=\"svelte-1pk7niq\"> </small>"), Vc = /* @__PURE__ */ W("<div tabindex=\"-1\"><div class=\"label svelte-1pk7niq\"><span class=\"swatch svelte-1pk7niq\"></span> <div class=\"label-copy svelte-1pk7niq\"><button type=\"button\"> </button> <small class=\"svelte-1pk7niq\"> </small></div></div> <div class=\"track svelte-1pk7niq\"><!> <!> <!></div> <div class=\"meta svelte-1pk7niq\"> <!></div></div>"), Hc = /* @__PURE__ */ W("<div class=\"more-rows svelte-1pk7niq\"><span> </span> <button type=\"button\"> </button></div>"), Uc = /* @__PURE__ */ W("<div class=\"rows\"></div> <!>", 1), Wc = /* @__PURE__ */ W("<div class=\"lifespan-content svelte-1pk7niq\"><!> <div class=\"lifespan-scope-status svelte-1pk7niq\"><span>Scope: <strong class=\"svelte-1pk7niq\"> </strong></span> <!></div> <!> <!> <!> <!> <div class=\"lifespan-legend svelte-1pk7niq\" aria-label=\"Lifespan markers\"><span class=\"svelte-1pk7niq\"><i class=\"legend-presence svelte-1pk7niq\"></i>Item presence</span> <span class=\"svelte-1pk7niq\"><i class=\"legend-pin svelte-1pk7niq\"></i>Pinned call</span> <span class=\"svelte-1pk7niq\"><i class=\"legend-compaction svelte-1pk7niq\"></i>Compaction boundary</span></div> <div class=\"axis-row svelte-1pk7niq\"><span class=\"axis-title svelte-1pk7niq\">Full-session calls</span> <div class=\"axis-track svelte-1pk7niq\" role=\"img\"><!> <!> <!></div> <span class=\"axis-note svelte-1pk7niq\">calls</span></div> <!></div>"), Gc = /* @__PURE__ */ W("<section class=\"lifespans\" aria-label=\"Context lifespans\"><details class=\"lifespan-disclosure svelte-1pk7niq\"><summary class=\"lifespan-header svelte-1pk7niq\"><span class=\"disclosure-chevron svelte-1pk7niq\" aria-hidden=\"true\"></span> <span class=\"lifespan-heading svelte-1pk7niq\"><h2 class=\"svelte-1pk7niq\"> </h2></span> <!></summary> <!></details></section>"), Kc = {
	hash: "svelte-1pk7niq",
	code: ".lifespan-disclosure.svelte-1pk7niq {min-width:0;}.lifespan-disclosure.svelte-1pk7niq > summary:where(.svelte-1pk7niq) {list-style:none;}.lifespan-disclosure.svelte-1pk7niq > summary:where(.svelte-1pk7niq)::-webkit-details-marker {display:none;}.lifespan-header.svelte-1pk7niq {position:sticky;top:0;z-index:4;display:grid;grid-template-columns:14px minmax(0, 1fr) auto;justify-content:space-between;gap:8px;align-items:start;margin:-2px -2px 8px;padding:6px 2px;background:var(--surface);cursor:pointer;}.disclosure-chevron.svelte-1pk7niq {width:9px;height:9px;margin:4px 0 0 2px;border-right:2px solid var(--text);border-bottom:2px solid var(--text);transform:rotate(-45deg);transition:transform 120ms ease;}.lifespan-disclosure[open].svelte-1pk7niq .disclosure-chevron:where(.svelte-1pk7niq) {transform:rotate(45deg);}.lifespan-heading.svelte-1pk7niq {display:grid;min-width:0;gap:2px;}.lifespan-content.svelte-1pk7niq {min-width:0;}h2.svelte-1pk7niq {font-size:var(--text-lg);margin:0;color:var(--text-strong);}.result-count.svelte-1pk7niq {color:var(--secondary);white-space:nowrap;}.lifespan-content.svelte-1pk7niq {container:lifespans / inline-size;}.browse-controls.svelte-1pk7niq {display:grid;grid-template-columns:minmax(180px, 1.5fr) minmax(130px, 1fr) minmax(150px, 1.1fr) minmax(165px, 1fr)\n      auto;align-items:end;gap:8px;margin:10px 0 12px;}.search-field.svelte-1pk7niq,\n  .kind-field.svelte-1pk7niq,\n  .sort-field.svelte-1pk7niq,\n  .scope-field.svelte-1pk7niq,\n  .clear-filters.svelte-1pk7niq {min-width:0;}.browse-controls.svelte-1pk7niq input:where(.svelte-1pk7niq),\n  .browse-controls.svelte-1pk7niq select:where(.svelte-1pk7niq) {box-sizing:border-box;}.search-field.svelte-1pk7niq,\n  .browse-field.svelte-1pk7niq {display:grid;gap:3px;color:var(--secondary);font-size:var(--text-sm);}.search-field.svelte-1pk7niq {grid-template-columns:1fr;}.browse-controls.svelte-1pk7niq input:where(.svelte-1pk7niq),\n  .browse-controls.svelte-1pk7niq select:where(.svelte-1pk7niq) {min-width:0;width:100%;background-color:var(--plot);border:1px solid var(--control-border);border-radius:var(--control-radius);color:var(--text-strong);padding:7px 8px;font:inherit;font-size:var(--text-sm);}.browse-controls.svelte-1pk7niq select:where(.svelte-1pk7niq) {padding-right:32px;}.browse-controls.svelte-1pk7niq button:where(.svelte-1pk7niq) {white-space:nowrap;}.sort-help.svelte-1pk7niq,\n  .scope-help.svelte-1pk7niq,\n  .scope-status.svelte-1pk7niq,\n  .selection-note.svelte-1pk7niq,\n  .find-status.svelte-1pk7niq,\n  .more-rows.svelte-1pk7niq {display:flex;align-items:center;gap:var(--space-3);margin-top:var(--space-3);color:var(--secondary);font-size:var(--text-sm);}.empty-state.svelte-1pk7niq {color:var(--secondary);font-size:var(--text-sm);margin:7px 0;}.lifespan-scope-status.svelte-1pk7niq {display:flex;flex-wrap:wrap;align-items:center;gap:7px 12px;margin:6px 0;color:var(--secondary);font-size:var(--text-sm);}.lifespan-scope-status.svelte-1pk7niq strong:where(.svelte-1pk7niq) {color:var(--text);}.lifespan-scope-status.svelte-1pk7niq button:where(.svelte-1pk7niq),\n  .find-status.svelte-1pk7niq button:where(.svelte-1pk7niq) {padding:4px 7px;font-size:var(--text-sm);}.find-status.svelte-1pk7niq button:where(.svelte-1pk7niq) {margin-left:7px;}.lifespan-legend.svelte-1pk7niq {display:flex;flex-wrap:wrap;gap:6px 16px;margin:7px 0;color:var(--secondary);font-size:var(--text-sm);}.lifespan-legend.svelte-1pk7niq span:where(.svelte-1pk7niq) {display:inline-flex;align-items:center;gap:5px;}.lifespan-legend.svelte-1pk7niq i:where(.svelte-1pk7niq) {display:inline-block;width:15px;height:8px;}.legend-presence.svelte-1pk7niq {border-radius:4px;background:var(--lifespan-version);}.legend-pin.svelte-1pk7niq {width:0 !important;border-left:2px solid var(--text-strong);}.legend-compaction.svelte-1pk7niq {height:0 !important;border-top:1px dashed var(--compaction);}.axis-row.svelte-1pk7niq,\n  .row.svelte-1pk7niq {display:grid;grid-template-columns:minmax(140px, 220px) minmax(0, 1fr) 115px;gap:10px;align-items:center;}.axis-row.svelte-1pk7niq {min-height:24px;margin:4px 0 2px;color:var(--secondary);font-size:10px;}.axis-title.svelte-1pk7niq {white-space:nowrap;}.axis-track.svelte-1pk7niq {height:22px;position:relative;min-width:0;border-bottom:1px solid var(--separator);}.axis-tick.svelte-1pk7niq {position:absolute;bottom:2px;transform:translateX(-50%);padding:0 2px;background:var(--plot);font-variant-numeric:tabular-nums;}.axis-tick.first.svelte-1pk7niq {transform:none;}.axis-tick.last.svelte-1pk7niq {transform:translateX(-100%);}.axis-tick.center.svelte-1pk7niq {transform:translateX(-50%);}.axis-pin-marker.svelte-1pk7niq,\n  .pin-marker.svelte-1pk7niq {position:absolute;z-index:3;height:100%;border-left:2px solid var(--text-strong);pointer-events:none;}.axis-pin-marker.svelte-1pk7niq,\n  .pin-marker.svelte-1pk7niq {top:0;}.axis-pin-marker.svelte-1pk7niq span:where(.svelte-1pk7niq) {position:absolute;top:0;left:2px;padding:0 2px;color:var(--text-strong);background:var(--plot);font-size:9px;white-space:nowrap;}.axis-boundary.svelte-1pk7niq,\n  .boundary.svelte-1pk7niq {position:absolute;z-index:2;height:100%;border-left:1px dashed var(--compaction);pointer-events:none;}.axis-boundary.svelte-1pk7niq {top:0;opacity:0.75;}.axis-note.svelte-1pk7niq {text-align:right;}.row.svelte-1pk7niq {scroll-margin-block:54px;padding:7px 3px;border-top:1px solid var(--chart-guide);transition:opacity 120ms ease;}.row.selected.svelte-1pk7niq {background:var(--selected-surface);box-shadow:inset 3px 0 var(--selection);}.row.svelte-1pk7niq:focus-visible {outline:2px solid var(--accent);outline-offset:-2px;}.row.selected.svelte-1pk7niq .segment:where(.svelte-1pk7niq) {outline:2px solid var(--selection);outline-offset:1px;}.label.svelte-1pk7niq {display:flex;align-items:center;gap:7px;min-width:0;}.swatch.svelte-1pk7niq {flex:0 0 9px;width:9px;height:9px;border-radius:var(--radius-small);}.label-copy.svelte-1pk7niq {display:grid;min-width:0;}.item-label.svelte-1pk7niq,\n  .terminal-item.svelte-1pk7niq {overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text);text-align:left;}.item-label.svelte-1pk7niq {min-width:0;width:100%;padding:0;border:0;border-radius:0;background:transparent;font:inherit;}.item-label.svelte-1pk7niq:hover {background:transparent;text-decoration:underline;}.item-label.svelte-1pk7niq:focus-visible {outline:2px solid var(--accent);outline-offset:1px;}.label-copy.svelte-1pk7niq small:where(.svelte-1pk7niq) {overflow:hidden;color:var(--muted);text-overflow:ellipsis;white-space:nowrap;font-size:10px;}.track.svelte-1pk7niq {height:22px;position:relative;min-width:0;background:var(--plot);border-radius:var(--control-radius);overflow:hidden;}.segment.svelte-1pk7niq {position:absolute;top:3px;height:16px;min-width:3px;padding:0;border:0;border-radius:4px;cursor:pointer;}\n  /* Versions that follow on directly meet without a rounded gap. */.segment.replaced-after.svelte-1pk7niq {border-top-right-radius:0;border-bottom-right-radius:0;}.segment.replaces-before.svelte-1pk7niq {border-top-left-radius:0;border-bottom-left-radius:0;}.segment.compacted.svelte-1pk7niq {border-right:4px double var(--selection);background-image:repeating-linear-gradient(\n      135deg,\n      var(--presence-overlay) 0 3px,\n      transparent 3px 7px\n    );}.segment.svelte-1pk7niq:focus-visible {outline:2px solid var(--selection);outline-offset:1px;}.boundary.svelte-1pk7niq {top:0;}\n  /* Where a new version of a system prompt or tool definition starts; matches the River's mark. */.version-mark.svelte-1pk7niq {position:absolute;z-index:3;top:3px;height:16px;border-left:1.5px solid var(--selection-focus);pointer-events:none;}.meta.svelte-1pk7niq {text-align:right;color:var(--secondary);font-size:var(--text-sm);white-space:nowrap;}.meta.svelte-1pk7niq small:where(.svelte-1pk7niq) {display:block;color:var(--muted);font-size:10px;}\n  @container lifespans (max-width: 900px) {.browse-controls.svelte-1pk7niq {grid-template-columns:minmax(0, 1.35fr) minmax(115px, 1fr) minmax(145px, 1.1fr) minmax(145px, 1fr)\n        auto;grid-template-areas:'search search kind kind .'\n        'sort sort scope scope reset';}.search-field.svelte-1pk7niq {grid-area:search;}.kind-field.svelte-1pk7niq {grid-area:kind;}.sort-field.svelte-1pk7niq {grid-area:sort;}.scope-field.svelte-1pk7niq {grid-area:scope;}.clear-filters.svelte-1pk7niq {grid-area:reset;justify-self:end;}\n  }\n  @container lifespans (max-width: 680px) {.browse-controls.svelte-1pk7niq {grid-template-columns:repeat(2, minmax(0, 1fr));grid-template-areas:'search search'\n        'kind kind'\n        'sort scope'\n        'reset reset';}.clear-filters.svelte-1pk7niq {justify-self:start;}\n  }\n  @container lifespans (max-width: 430px) {.browse-controls.svelte-1pk7niq {grid-template-columns:minmax(0, 1fr);grid-template-areas:'search'\n        'kind'\n        'sort'\n        'scope'\n        'reset';}\n  }\n  @container highwater (max-width: 700px) {.axis-row.svelte-1pk7niq,\n    .row.svelte-1pk7niq {grid-template-columns:120px minmax(0, 1fr);}.axis-note.svelte-1pk7niq,\n    .meta.svelte-1pk7niq {display:none;}\n  }\n  @container highwater (max-width: 420px) {.browse-controls.svelte-1pk7niq {grid-template-columns:minmax(0, 1fr);}.browse-controls.svelte-1pk7niq > :where(.svelte-1pk7niq) {grid-column:auto;}.result-count.svelte-1pk7niq {white-space:normal;text-align:right;}\n  }.compact-browse.svelte-1pk7niq {display:flex;justify-content:flex-end;margin-bottom:8px;}.compact-browse.svelte-1pk7niq .browse-controls:where(.svelte-1pk7niq) {width:min(300px, calc(100cqw - 48px));}\n  /* Narrow views: each item's full label on its own line above a full-width bar. */\n  @container highwater (max-width: 520px) {.axis-row.svelte-1pk7niq,\n    .row.svelte-1pk7niq {grid-template-columns:minmax(0, 1fr);}.axis-title.svelte-1pk7niq {display:none;}.row.svelte-1pk7niq .label:where(.svelte-1pk7niq) {min-width:0;}\n    /* Two lines at most; the full label is the row's tooltip and in the item details. */.row.svelte-1pk7niq .item-label:where(.svelte-1pk7niq) {display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;overflow:hidden;white-space:normal;overflow-wrap:anywhere;text-align:left;}\n  }\n  @media (prefers-reduced-motion: reduce) {.row.svelte-1pk7niq,\n    .disclosure-chevron.svelte-1pk7niq {transition:none;}\n  }"
};
function qc(e, t) {
	Be(t, !0), li(e, Kc);
	let n = () => ot(Ma, "$activePalette", r), [r, i] = st(), a = X(t, "selectedItemId", 3, null), o = X(t, "pinnedCallIndex", 3, null), s = X(t, "findRequest", 3, null), c = X(t, "compact", 3, !1), l = [
		"assistantMessage",
		"branchSummary",
		"compactionSummary",
		"customMessage",
		"other",
		"system",
		"thinking",
		"toolDefinition",
		"toolResult",
		"unrecordedContext",
		"userMessage"
	], u = /* @__PURE__ */ F(""), d = /* @__PURE__ */ F("all"), f = /* @__PURE__ */ F("all"), p = /* @__PURE__ */ F(""), m = /* @__PURE__ */ F("tokenTurns"), h = /* @__PURE__ */ F(50), g = /* @__PURE__ */ F(!1), _ = -1, v = /* @__PURE__ */ F(null), y = /* @__PURE__ */ F(""), b = /* @__PURE__ */ F(void 0), x = !0;
	Bi(() => {
		x = !1;
	});
	let S = /* @__PURE__ */ P(() => t.indexed.analysis.contextItems), C = /* @__PURE__ */ P(() => Mo(H(S))), w = /* @__PURE__ */ P(() => rc(H(S))), ee = /* @__PURE__ */ P(() => H(w) === null ? null : t.indexed.analysis.tokenAnalysis.profiles.find((e) => e.id === H(w)) ?? null), T = /* @__PURE__ */ P(() => H(ee) ? `${H(ee).provider}/${H(ee).model} · ${H(ee).method}` : H(w) ?? "unavailable"), E = /* @__PURE__ */ P(() => o() === null ? null : t.indexed.contextSetByCall.get(o()) ?? null), te = /* @__PURE__ */ P(() => H(S).filter((e) => (t.indexed.versionByItemId.get(e.id)?.number ?? 1) === 1)), D = /* @__PURE__ */ P(() => new Map(H(te).map((e) => [e.id, hc(t.indexed.itemById, t.indexed.versionByItemId, e.id)]))), O = /* @__PURE__ */ P(() => (e) => H(D).get(e.id) ?? [e]), k = /* @__PURE__ */ P(() => sc(H(te), H(m), H(w), H(O))), ne = /* @__PURE__ */ P(() => H(f) === "presentAtPin" && H(E) !== null ? H(k).filter((e) => H(O)(e).some((e) => H(E).has(e.id))) : H(k)), re = /* @__PURE__ */ P(() => H(u).trim().slice(0, 120).toLowerCase()), ie = /* @__PURE__ */ P(() => H(ne).filter((e) => {
		let t = H(d) === "all" || e.kind === H(d), n = H(re).length === 0 || H(O)(e).some((e) => e.label.toLowerCase().includes(H(re)) || (e.preview?.text ?? "").toLowerCase().includes(H(re)));
		return t && n;
	})), ae = /* @__PURE__ */ P(() => H(ie).reduce((e, t) => e + H(O)(t).length, 0)), oe = /* @__PURE__ */ P(() => H(ie).slice(0, H(h))), se = /* @__PURE__ */ P(() => H(ie).length - H(oe).length), ce = /* @__PURE__ */ P(() => l.filter((e) => H(S).some((t) => t.kind === e))), le = /* @__PURE__ */ P(() => +!!H(re) + (H(d) === "all" ? 0 : 1) + (H(f) === "all" ? 0 : 1)), ue = /* @__PURE__ */ P(() => H(re).length > 0 || H(d) !== "all" || H(f) !== "all"), de = /* @__PURE__ */ P(() => t.indexed.analysis.modelCalls.map((e) => e.index)), fe = /* @__PURE__ */ P(() => cc(H(de))), pe = /* @__PURE__ */ P(() => H(de).length), me = /* @__PURE__ */ P(() => new Map(H(de).map((e, t) => [e, t]))), he = /* @__PURE__ */ P(() => o() === null || !H(me).has(o()) ? null : A(o())), ge = /* @__PURE__ */ P(() => a() !== null && H(ue) && !H(ie).some((e) => Ce(e, a())));
	Tn(() => {
		H(d) !== "all" && !H(ce).includes(H(d)) && I(d, "all");
	}), Tn(() => {
		H(m) === "size" && H(w) === null && I(m, "tokenTurns");
	}), Tn(() => {
		H(f) === "presentAtPin" && o() === null && (I(f, "all"), I(p, "Pin cleared; showing all items."));
	}), Tn(() => {
		H(f) === "all" && o() !== null && I(p, "");
	}), Tn(() => {
		H(re), H(d), H(f), H(m), I(h, 50);
	}), Tn(() => {
		if (s() && s().requestId !== _) {
			_ = s().requestId, I(v, s().itemId, !0), I(y, ""), I(g, !0);
			let e = s().requestId;
			gr().then(() => Ne(e));
		}
	}), Tn(() => {
		!s() && H(v) && (I(v, null), I(y, ""));
	});
	function _e(e) {
		return `${Q(e)} item${e === 1 ? "" : "s"}`;
	}
	function A(e) {
		let t = H(me).get(e);
		return t === void 0 ? 0 : H(pe) <= 1 ? 50 : t / (H(pe) - 1) * 100;
	}
	function ve(e, n, r) {
		if (e.detail === 0) {
			t.onSelectItem(n);
			return;
		}
		let i = e.currentTarget.closest(".track")?.getBoundingClientRect(), a = i && i.width > 0 ? ec(H(de), r, (e.clientX - i.left) / i.width) : null;
		a === null ? t.onSelectItem(n) : t.onSelectItem(n, a);
	}
	function j(e, t, n = !1, r = !1) {
		let i = H(pe) <= 1 ? 8 : Math.min(2.2, 35 / Math.max(1, H(pe) - 1)), a = n ? ye(e.startCall) : Math.max(0, A(e.startCall) - i), o = r ? ye(e.endCall + 1) : Math.min(100, A(e.endCall) + i);
		return `left:${a}%;width:${Math.max(1, o - a)}%;background-color:${t}`;
	}
	function ye(e) {
		let t = H(de)[0] ?? 1;
		if (e > (H(de)[H(de).length - 1] ?? 0)) return 100;
		let n = A(e), r = A(e - 1);
		return e <= t ? Math.max(0, n - 1) : (n + r) / 2;
	}
	function be(e) {
		return H(C).get(e.id) ?? Se(e);
	}
	function Se(e) {
		return Ao(e, "Unlabelled item");
	}
	function Ce(e, t) {
		return H(O)(e).some((e) => e.id === t);
	}
	function we(e) {
		return t.indexed.versionByItemId.get(e)?.firstId ?? e;
	}
	function Te(e) {
		let t = [];
		for (let n of H(O)(e).flatMap((e) => e.presence)) {
			let e = t[t.length - 1];
			e && n.startCall === e.endCall + 1 ? t[t.length - 1] = {
				...e,
				endCall: n.endCall
			} : t.push(n);
		}
		return t;
	}
	function Ee(e) {
		let t = Te(e);
		if (t.length === 0) return "No model-call presence";
		let n = H(O)(e).length, r = n > 1 ? ` · ${n} versions` : "";
		return `Present at ${t.map((e) => e.startCall === e.endCall ? `call ${e.startCall}` : `calls ${e.startCall}–${e.endCall}`).join(", ")}${r}`;
	}
	function De(e) {
		return H(O)(e).reduce((e, t) => e + t.tokenTurnsCoverage.coveredCalls, 0);
	}
	function Oe(e) {
		return H(O)(e).reduce((e, t) => e + t.tokenTurnsCoverage.totalCalls, 0);
	}
	function ke(e, n) {
		return (t.indexed.compactionBySourceId.get(e) ?? []).some((e) => e.beforeModelCall === n.endCall + 1);
	}
	function Ae() {
		return `Full-session call axis ${H(de).length === 0 ? "this session has no model calls" : `from call ${H(de)[0]} to ${H(de)[H(de).length - 1]}; ticks ${H(fe).join(", ")}`}; dashed markers show compaction boundaries${o() === null ? "" : `; solid vertical marker shows pinned call ${o()}`}; independent of chart zoom`;
	}
	function je() {
		I(u, ""), I(d, "all"), I(f, "all"), I(p, ""), I(y, "");
	}
	function Me(e) {
		return `lifespan-item-${encodeURIComponent(e)}`;
	}
	async function Ne(e = _) {
		if (!x || e !== _ || !H(v)) return;
		let t = we(H(v)), n = H(ie).findIndex((e) => e.id === t);
		if (n >= H(h) && (I(h, Math.ceil((n + 1) / 50) * 50), await gr(), !x || e !== _)) return;
		let r = [...H(b)?.querySelectorAll("[data-lifespan-item-id]") ?? []].find((e) => e.dataset.lifespanItemId === t);
		r ? (r.scrollIntoView({ block: "center" }), r.focus({ preventScroll: !0 }), I(y, "")) : (I(y, "The selected item is hidden by current lifespan filters."), gr().then(() => {
			let e = H(b)?.querySelector(".find-status button");
			e?.scrollIntoView({ block: "center" }), e?.focus();
		}));
	}
	async function Pe() {
		je(), await gr(), await Ne();
	}
	function Fe() {
		I(h, H(h) + 50);
	}
	var N = Gc(), Ie = L(N), Le = L(Ie), Re = B(L(Le), 2), ze = z(L(Re));
	M(Re);
	var He = B(Re, 2), Ue = (e) => {
		var t = vc(), n = z(t);
		V((e, t) => K(n, `${e ?? ""} of ${t ?? ""} items`), [() => Q(H(ae)), () => Q(H(S).length)]), G(e, t);
	};
	q(He, (e) => {
		H(ue) && e(Ue);
	}), M(Le);
	var We = B(Le, 2), Ge = (e) => {
		var r = Wc();
		{
			let e = (e) => {
				var t = xc(), n = L(t), r = B(L(n), 2);
				ki(r), Y(r, "maxlength", 120), M(n);
				var i = B(n, 2), a = B(L(i), 2), s = L(a);
				s.value = s.__value = "all", J(B(s), 16, () => H(ce), (e) => e, (e, t) => {
					var n = yc(), r = z(n, !0), i = {};
					V((e) => {
						K(r, e), i !== (i = t) && (n.value = (n.__value = i) ?? "");
					}, [() => Fo(t)]), G(e, n);
				}), M(a), Si(a), M(i);
				var c = B(i, 2), l = B(L(c), 2), p = L(l);
				p.value = p.__value = "tokenTurns";
				var h = B(p);
				h.value = h.__value = "size";
				var g = B(h);
				g.value = g.__value = "firstAppearance";
				var _ = B(g);
				_.value = _.__value = "presenceCount", M(l), Si(l), M(c);
				var v = B(c, 2), y = B(L(v), 2), b = L(y);
				b.value = b.__value = "all";
				var x = B(b), S = z(x);
				x.value = x.__value = "presentAtPin", M(y), Si(y), M(v);
				var C = B(v, 2), ee = (e) => {
					var t = bc();
					U("click", t, je), G(e, t);
				};
				q(C, (e) => {
					H(ue) && e(ee);
				}), M(t), V(() => {
					h.disabled = H(w) === null, x.disabled = o() === null, K(S, `Present at call ${o() ?? "(pin a call first)" ?? ""}`);
				}), Ni(r, () => H(u), (e) => I(u, e)), Ci(a, () => H(d), (e) => I(d, e)), Ci(l, () => H(m), (e) => I(m, e)), Ci(y, () => H(f), (e) => I(f, e)), G(e, t);
			};
			var i = L(r), s = (t) => {
				var n = Sc(), r = L(n);
				{
					let t = /* @__PURE__ */ P(() => H(le) > 0 ? `Filter and sort (${H(le)})` : "Filter and sort");
					Ws(r, {
						get label() {
							return H(t);
						},
						children: (t, n) => {
							e(t);
						},
						$$slots: { default: !0 }
					});
				}
				M(n), G(t, n);
			}, l = (t) => {
				e(t);
			};
			q(i, (e) => {
				c() ? e(s) : e(l, -1);
			});
			var h = B(i, 2), g = L(h), _ = z(B(L(g)), !0);
			M(g);
			var b = B(g, 2), x = (e) => {
				var t = Cc(), n = z(t);
				V(() => {
					t.disabled = H(f) === "presentAtPin", K(n, `Show items present at call ${o() ?? ""}`);
				}), U("click", t, () => I(f, "presentAtPin")), G(e, t);
			}, C = (e) => {
				G(e, wc());
			};
			q(b, (e) => {
				o() === null ? e(C, -1) : e(x);
			}), M(h);
			var ee = B(h, 2), E = (e) => {
				var t = Tc(), n = z(t, !0);
				V(() => K(n, H(p))), G(e, t);
			};
			q(ee, (e) => {
				H(p) && e(E);
			});
			var te = B(ee, 2), D = (e) => {
				var n = Dc(), r = L(n), i = B(r), a = (e) => {
					var t = Ec();
					U("click", t, Pe), G(e, t);
				}, o = /* @__PURE__ */ P(() => H(v) && t.indexed.itemById.has(H(v)));
				q(i, (e) => {
					H(o) && e(a);
				}), M(n), V(() => K(r, `${H(y) ?? ""} `)), G(e, n);
			};
			q(te, (e) => {
				H(y) && e(D);
			});
			var k = B(te, 2), ne = (e) => {
				var t = Oc(), n = z(t);
				V(() => K(n, `Size uses one shared profile (${H(T) ?? ""}); items without a numeric estimate for
            it sort last.`)), G(e, t);
			};
			q(k, (e) => {
				H(m) === "size" && e(ne);
			});
			var re = B(k, 2), ae = (e) => {
				G(e, kc());
			};
			q(re, (e) => {
				H(ge) && e(ae);
			});
			var de = B(re, 4), pe = B(L(de), 2), me = L(pe), we = (e) => {
				var t = Ac(), n = z(L(t), !0);
				M(t), V(() => {
					vi(t, `left:${H(he)}%`), K(n, o());
				}), G(e, t);
			};
			q(me, (e) => {
				H(he) !== null && e(we);
			});
			var Te = B(me, 2);
			J(Te, 19, () => H(fe), (e) => `tick:${e}`, (e, t, n) => {
				var r = jc();
				let i;
				var a = z(r, !0);
				V((e) => {
					i = gi(r, 1, "axis-tick svelte-1pk7niq", null, i, {
						first: H(n) === 0,
						last: H(n) === H(fe).length - 1,
						center: H(fe).length === 1
					}), vi(r, e), K(a, H(t));
				}, [() => `left:${A(H(t))}%`]), G(e, r);
			}), J(B(Te, 2), 17, () => t.indexed.analysis.compactions, (e) => e.id, (e, t) => {
				var n = Mc();
				V((e) => vi(n, e), [() => `left:${ye(H(t).beforeModelCall)}%`]), G(e, n);
			}), M(pe), xe(2), M(de);
			var Ne = B(de, 2), N = (e) => {
				G(e, Nc());
			}, Ie = (e) => {
				G(e, Pc());
			}, Le = (e) => {
				var r = Uc(), i = R(r);
				J(i, 21, () => H(oe), (e) => e.id, (e, r) => {
					let i = /* @__PURE__ */ P(() => be(H(r)));
					var o = Vc();
					let s;
					var c = L(o), l = L(c), u = B(l, 2), d = L(u);
					let f;
					var p = z(d, !0), m = z(B(d, 2));
					M(u), M(c);
					var h = B(c, 2), g = L(h), _ = (e) => {
						var t = Fc();
						V(() => vi(t, `left:${H(he)}%`)), G(e, t);
					};
					q(g, (e) => {
						H(he) !== null && e(_);
					});
					var v = B(g, 2);
					J(v, 17, () => t.indexed.analysis.compactions, (e) => e.id, (e, t) => {
						var n = Ic();
						V((e) => vi(n, e), [() => `left:${ye(H(t).beforeModelCall)}%`]), G(e, n);
					}), J(B(v, 2), 19, () => H(O)(H(r)), (e) => e.id, (e, o, s) => {
						let c = /* @__PURE__ */ P(() => H(O)(H(r)).length > 1 ? `${Se(H(r))} version ${H(s) + 1}` : Se(H(r)));
						var l = zc(), u = R(l);
						J(u, 19, () => H(o).presence, (e, t) => `${H(o).id}:${t}`, (e, l, u) => {
							let d = /* @__PURE__ */ P(() => H(u) === H(o).presence.length - 1 && H(O)(H(r))[H(s) + 1]?.firstModelCall === H(l).endCall + 1), f = /* @__PURE__ */ P(() => H(u) === 0 && H(s) > 0 && H(O)(H(r))[H(s) - 1]?.lastModelCall === H(l).startCall - 1);
							var p = Lc();
							let m;
							V((e, t, n) => {
								m = gi(p, 1, "segment svelte-1pk7niq", null, m, {
									compacted: e,
									"replaced-after": H(d),
									"replaces-before": H(f)
								}), Y(p, "aria-label", `${H(c)}, calls ${H(l).startCall} through ${H(l).endCall}`), Y(p, "aria-pressed", a() === H(o).id), Y(p, "title", t), vi(p, n);
							}, [
								() => ke(H(o).id, H(l)),
								() => `${H(c) === Se(H(r)) ? H(i) : H(c)}: calls ${H(l).startCall}–${H(l).endCall}`,
								() => j(H(l), wa(t.indexed, H(r).id, n()), H(f), H(d))
							]), Or("pointerenter", p, (e) => t.onHoverItem(H(o).id, e)), U("pointermove", p, (e) => t.onHoverItem(H(o).id, e)), Or("pointerleave", p, () => t.onHoverItem(null)), U("click", p, (e) => ve(e, H(o).id, H(l))), G(e, p);
						});
						var d = B(u, 2), f = (e) => {
							var t = Rc();
							V((e) => vi(t, e), [() => `left:${ye(H(o).firstModelCall)}%`]), G(e, t);
						};
						q(d, (e) => {
							H(s) > 0 && e(f);
						}), G(e, l);
					}), M(h);
					var y = B(h, 2), b = L(y), x = B(b), S = (e) => {
						var t = Bc(), n = z(t);
						V((e) => K(n, `${e ?? ""} calls covered`), [() => Ka(De(H(r)), Oe(H(r)))]), G(e, t);
					}, C = /* @__PURE__ */ P(() => De(H(r)) < Oe(H(r)));
					q(x, (e) => {
						H(C) && e(S);
					}), M(y), M(o), V((e, t, n, a, u, h, g, _, v, x) => {
						Y(o, "id", e), s = gi(o, 1, "row svelte-1pk7niq", null, s, { selected: t }), Y(o, "aria-label", n), Y(o, "data-lifespan-item-id", H(r).id), Y(c, "title", a), vi(l, u), f = gi(d, 1, "item-label svelte-1pk7niq", null, f, { "terminal-item": H(r).presence.length === 0 }), Y(d, "aria-label", h), K(p, H(i)), K(m, `${g ?? ""} · ${_ ?? ""}`), Y(y, "title", v), K(b, `${x ?? ""} `);
					}, [
						() => Me(H(r).id),
						() => Ce(H(r), a()),
						() => `${Se(H(r))}; ${Fo(H(r).kind)}; ${Ee(H(r))}`,
						() => Se(H(r)),
						() => `background:${wa(t.indexed, H(r).id, n())}`,
						() => `Select ${Se(H(r))}${H(r).presence.length === 0 ? "; no model-call presence" : ""}`,
						() => Fo(H(r).kind),
						() => Ee(H(r)),
						() => `${oc(H(O)(H(r)))} calls; ${Ka(De(H(r)), Oe(H(r)))} tokenized`,
						() => Ga(ac(H(O)(H(r))), "calculatedTokens")
					]), U("click", d, () => t.onSelectItem(H(r).id)), G(e, o);
				}), M(i);
				var o = B(i, 2), s = (e) => {
					var t = Hc(), n = L(t), r = z(n), i = B(n, 2), a = z(i);
					M(t), V((e, t, n) => {
						K(r, `Showing ${e ?? ""} of ${t ?? ""}`), K(a, `Show ${n ?? ""} more`);
					}, [
						() => Q(H(oe).length),
						() => _e(H(ie).length),
						() => Q(Math.min(50, H(se)))
					]), U("click", i, Fe), G(e, t);
				};
				q(o, (e) => {
					H(se) > 0 && e(s);
				}), G(e, r);
			};
			q(Ne, (e) => {
				H(S).length === 0 ? e(N) : H(ie).length === 0 ? e(Ie, 1) : e(Le, -1);
			}), M(r), V((e) => {
				K(_, H(f) === "all" ? "Whole session" : `Present at call ${o()}`), Y(pe, "aria-label", e);
			}, [() => Ae()]);
		}
		G(e, r);
	};
	q(We, (e) => {
		H(g) && e(Ge);
	}), M(Ie), M(N), Li(N, (e) => I(b, e), () => H(b)), V((e) => K(ze, `Context lifespans · ${e ?? ""}`), [() => _e(H(S).length)]), Ri("open", "toggle", Ie, (e) => I(g, e), () => H(g)), G(e, N), Ve(), i();
}
kr(["click", "pointermove"]);
//#endregion
//#region node_modules/d3-shape/src/constant.js
function Jc(e) {
	return function() {
		return e;
	};
}
//#endregion
//#region node_modules/d3-path/src/path.js
var Yc = Math.PI, Xc = 2 * Yc, Zc = 1e-6, Qc = Xc - Zc;
function $c(e) {
	this._ += e[0];
	for (let t = 1, n = e.length; t < n; ++t) this._ += arguments[t] + e[t];
}
function el(e) {
	let t = Math.floor(e);
	if (!(t >= 0)) throw Error(`invalid digits: ${e}`);
	if (t > 15) return $c;
	let n = 10 ** t;
	return function(e) {
		this._ += e[0];
		for (let t = 1, r = e.length; t < r; ++t) this._ += Math.round(arguments[t] * n) / n + e[t];
	};
}
var tl = class {
	constructor(e) {
		this._x0 = this._y0 = this._x1 = this._y1 = null, this._ = "", this._append = e == null ? $c : el(e);
	}
	moveTo(e, t) {
		this._append`M${this._x0 = this._x1 = +e},${this._y0 = this._y1 = +t}`;
	}
	closePath() {
		this._x1 !== null && (this._x1 = this._x0, this._y1 = this._y0, this._append`Z`);
	}
	lineTo(e, t) {
		this._append`L${this._x1 = +e},${this._y1 = +t}`;
	}
	quadraticCurveTo(e, t, n, r) {
		this._append`Q${+e},${+t},${this._x1 = +n},${this._y1 = +r}`;
	}
	bezierCurveTo(e, t, n, r, i, a) {
		this._append`C${+e},${+t},${+n},${+r},${this._x1 = +i},${this._y1 = +a}`;
	}
	arcTo(e, t, n, r, i) {
		if (e = +e, t = +t, n = +n, r = +r, i = +i, i < 0) throw Error(`negative radius: ${i}`);
		let a = this._x1, o = this._y1, s = n - e, c = r - t, l = a - e, u = o - t, d = l * l + u * u;
		if (this._x1 === null) this._append`M${this._x1 = e},${this._y1 = t}`;
		else if (d > Zc) {
			if (!(Math.abs(u * s - c * l) > Zc) || !i) this._append`L${this._x1 = e},${this._y1 = t}`;
			else {
				let f = n - a, p = r - o, m = s * s + c * c, h = f * f + p * p, g = Math.sqrt(m), _ = Math.sqrt(d), v = i * Math.tan((Yc - Math.acos((m + d - h) / (2 * g * _))) / 2), y = v / _, b = v / g;
				Math.abs(y - 1) > Zc && this._append`L${e + y * l},${t + y * u}`, this._append`A${i},${i},0,0,${+(u * f > l * p)},${this._x1 = e + b * s},${this._y1 = t + b * c}`;
			}
		}
	}
	arc(e, t, n, r, i, a) {
		if (e = +e, t = +t, n = +n, a = !!a, n < 0) throw Error(`negative radius: ${n}`);
		let o = n * Math.cos(r), s = n * Math.sin(r), c = e + o, l = t + s, u = 1 ^ a, d = a ? r - i : i - r;
		this._x1 === null ? this._append`M${c},${l}` : (Math.abs(this._x1 - c) > Zc || Math.abs(this._y1 - l) > Zc) && this._append`L${c},${l}`, n && (d < 0 && (d = d % Xc + Xc), d > Qc ? this._append`A${n},${n},0,1,${u},${e - o},${t - s}A${n},${n},0,1,${u},${this._x1 = c},${this._y1 = l}` : d > Zc && this._append`A${n},${n},0,${+(d >= Yc)},${u},${this._x1 = e + n * Math.cos(i)},${this._y1 = t + n * Math.sin(i)}`);
	}
	rect(e, t, n, r) {
		this._append`M${this._x0 = this._x1 = +e},${this._y0 = this._y1 = +t}h${n = +n}v${+r}h${-n}Z`;
	}
	toString() {
		return this._;
	}
};
tl.prototype;
//#endregion
//#region node_modules/d3-shape/src/path.js
function nl(e) {
	let t = 3;
	return e.digits = function(n) {
		if (!arguments.length) return t;
		if (n == null) t = null;
		else {
			let e = Math.floor(n);
			if (!(e >= 0)) throw RangeError(`invalid digits: ${n}`);
			t = e;
		}
		return e;
	}, () => new tl(t);
}
Array.prototype.slice;
function rl(e) {
	return typeof e == "object" && "length" in e ? e : Array.from(e);
}
//#endregion
//#region node_modules/d3-shape/src/curve/linear.js
function il(e) {
	this._context = e;
}
il.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._point = 0;
	},
	lineEnd: function() {
		(this._line || this._line !== 0 && this._point === 1) && this._context.closePath(), this._line = 1 - this._line;
	},
	point: function(e, t) {
		switch (e = +e, t = +t, this._point) {
			case 0:
				this._point = 1, this._line ? this._context.lineTo(e, t) : this._context.moveTo(e, t);
				break;
			case 1: this._point = 2;
			default: this._context.lineTo(e, t);
		}
	}
};
function al(e) {
	return new il(e);
}
//#endregion
//#region node_modules/d3-shape/src/point.js
function ol(e) {
	return e[0];
}
function sl(e) {
	return e[1];
}
//#endregion
//#region node_modules/d3-shape/src/line.js
function cl(e, t) {
	var n = Jc(!0), r = null, i = al, a = null, o = nl(s);
	e = typeof e == "function" ? e : e === void 0 ? ol : Jc(e), t = typeof t == "function" ? t : t === void 0 ? sl : Jc(t);
	function s(s) {
		var c, l = (s = rl(s)).length, u, d = !1, f;
		for (r ?? (a = i(f = o())), c = 0; c <= l; ++c) !(c < l && n(u = s[c], c, s)) === d && ((d = !d) ? a.lineStart() : a.lineEnd()), d && a.point(+e(u, c, s), +t(u, c, s));
		if (f) return a = null, f + "" || null;
	}
	return s.x = function(t) {
		return arguments.length ? (e = typeof t == "function" ? t : Jc(+t), s) : e;
	}, s.y = function(e) {
		return arguments.length ? (t = typeof e == "function" ? e : Jc(+e), s) : t;
	}, s.defined = function(e) {
		return arguments.length ? (n = typeof e == "function" ? e : Jc(!!e), s) : n;
	}, s.curve = function(e) {
		return arguments.length ? (i = e, r != null && (a = i(r)), s) : i;
	}, s.context = function(e) {
		return arguments.length ? (e == null ? r = a = null : a = i(r = e), s) : r;
	}, s;
}
//#endregion
//#region node_modules/d3-shape/src/area.js
function ll(e, t, n) {
	var r = null, i = Jc(!0), a = null, o = al, s = null, c = nl(l);
	e = typeof e == "function" ? e : e === void 0 ? ol : Jc(+e), t = typeof t == "function" ? t : Jc(t === void 0 ? 0 : +t), n = typeof n == "function" ? n : n === void 0 ? sl : Jc(+n);
	function l(l) {
		var u, d, f, p = (l = rl(l)).length, m, h = !1, g, _ = Array(p), v = Array(p);
		for (a ?? (s = o(g = c())), u = 0; u <= p; ++u) {
			if (!(u < p && i(m = l[u], u, l)) === h) {
				if (h = !h) d = u, s.areaStart(), s.lineStart();
				else {
					for (s.lineEnd(), s.lineStart(), f = u - 1; f >= d; --f) s.point(_[f], v[f]);
					s.lineEnd(), s.areaEnd();
				}
			}
			h && (_[u] = +e(m, u, l), v[u] = +t(m, u, l), s.point(r ? +r(m, u, l) : _[u], n ? +n(m, u, l) : v[u]));
		}
		if (g) return s = null, g + "" || null;
	}
	function u() {
		return cl().defined(i).curve(o).context(a);
	}
	return l.x = function(t) {
		return arguments.length ? (e = typeof t == "function" ? t : Jc(+t), r = null, l) : e;
	}, l.x0 = function(t) {
		return arguments.length ? (e = typeof t == "function" ? t : Jc(+t), l) : e;
	}, l.x1 = function(e) {
		return arguments.length ? (r = e == null ? null : typeof e == "function" ? e : Jc(+e), l) : r;
	}, l.y = function(e) {
		return arguments.length ? (t = typeof e == "function" ? e : Jc(+e), n = null, l) : t;
	}, l.y0 = function(e) {
		return arguments.length ? (t = typeof e == "function" ? e : Jc(+e), l) : t;
	}, l.y1 = function(e) {
		return arguments.length ? (n = e == null ? null : typeof e == "function" ? e : Jc(+e), l) : n;
	}, l.lineX0 = l.lineY0 = function() {
		return u().x(e).y(t);
	}, l.lineY1 = function() {
		return u().x(e).y(n);
	}, l.lineX1 = function() {
		return u().x(r).y(t);
	}, l.defined = function(e) {
		return arguments.length ? (i = typeof e == "function" ? e : Jc(!!e), l) : i;
	}, l.curve = function(e) {
		return arguments.length ? (o = e, a != null && (s = o(a)), l) : o;
	}, l.context = function(e) {
		return arguments.length ? (e == null ? a = s = null : s = o(a = e), l) : a;
	}, l;
}
//#endregion
//#region node_modules/d3-shape/src/curve/monotone.js
function ul(e) {
	return e < 0 ? -1 : 1;
}
function dl(e, t, n) {
	var r = e._x1 - e._x0, i = t - e._x1, a = (e._y1 - e._y0) / (r || i < 0 && -0), o = (n - e._y1) / (i || r < 0 && -0), s = (a * i + o * r) / (r + i);
	return (ul(a) + ul(o)) * Math.min(Math.abs(a), Math.abs(o), .5 * Math.abs(s)) || 0;
}
function fl(e, t) {
	var n = e._x1 - e._x0;
	return n ? (3 * (e._y1 - e._y0) / n - t) / 2 : t;
}
function pl(e, t, n) {
	var r = e._x0, i = e._y0, a = e._x1, o = e._y1, s = (a - r) / 3;
	e._context.bezierCurveTo(r + s, i + s * t, a - s, o - s * n, a, o);
}
function ml(e) {
	this._context = e;
}
ml.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._x0 = this._x1 = this._y0 = this._y1 = this._t0 = NaN, this._point = 0;
	},
	lineEnd: function() {
		switch (this._point) {
			case 2:
				this._context.lineTo(this._x1, this._y1);
				break;
			case 3: pl(this, this._t0, fl(this, this._t0));
		}
		(this._line || this._line !== 0 && this._point === 1) && this._context.closePath(), this._line = 1 - this._line;
	},
	point: function(e, t) {
		var n = NaN;
		if (e = +e, t = +t, e !== this._x1 || t !== this._y1) {
			switch (this._point) {
				case 0:
					this._point = 1, this._line ? this._context.lineTo(e, t) : this._context.moveTo(e, t);
					break;
				case 1:
					this._point = 2;
					break;
				case 2:
					this._point = 3, pl(this, fl(this, n = dl(this, e, t)), n);
					break;
				default: pl(this, this._t0, n = dl(this, e, t));
			}
			this._x0 = this._x1, this._x1 = e, this._y0 = this._y1, this._y1 = t, this._t0 = n;
		}
	}
}, Object.create(ml.prototype).point = function(e, t) {
	ml.prototype.point.call(this, t, e);
};
function hl(e) {
	return new ml(e);
}
//#endregion
//#region src/lib/context-river/reported-input.ts
function gl(e, t) {
	if (e.analysis.displayWeightUnit === "unavailable" || t.stopReason?.endsWith("-aggregate") || t.reportedUsageCompleteness !== "complete") return null;
	let n = t.reportedPromptTokens, r = t.tokenAnalysis.calculatedVisibleTokens;
	return n === null || r === null || !t.tokenizationProfileId || !Number.isSafeInteger(n) || n < 0 || !Number.isSafeInteger(r) || r < 0 ? null : {
		callIndex: t.index,
		reconstructed: r,
		reported: n,
		gap: Math.max(0, n - r)
	};
}
function _l(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let r of t) {
		let t = e.callByIndex.get(r.callIndex), i = t ? gl(e, t) : null;
		!i || !Number.isSafeInteger(r.totalDisplayWeight) || r.totalDisplayWeight < 0 || r.totalDisplayWeight !== i.reconstructed || n.set(i.callIndex, i);
	}
	return n;
}
function vl(e) {
	let t = [], n = null, r = 0;
	for (let i of e.analysis.modelCalls) {
		let a = gl(e, i);
		a && (a.reconstructed > a.reported && (r += 1), n = Math.max(n ?? 0, a.gap), a.reported > 0 && t.push(a.gap / a.reported));
	}
	t.sort((e, t) => e - t);
	let i = Math.floor(t.length / 2);
	return {
		comparedCalls: t.length,
		medianGapShare: t.length === 0 ? null : t.length % 2 == 1 ? t[i] : (t[i - 1] + t[i]) / 2,
		maximumGap: n,
		estimateAboveReportedCalls: r
	};
}
function yl(e, t) {
	return e.map((e) => ({
		...e,
		totalDisplayWeight: Math.max(e.totalDisplayWeight, t.get(e.callIndex)?.reported ?? 0)
	}));
}
function bl(e, t, n, r) {
	let i = [], a = null;
	for (let [n, r] of e.entries()) {
		let o = t.get(r.callIndex);
		if (!o) {
			a = null;
			continue;
		}
		a || (a = [], i.push(a));
		let s = e[n - 1], c = e[n + 1], l = Math.max(0, Math.min(6, s ? (r.x - s.x) / 2 : Infinity, c ? (c.x - r.x) / 2 : Infinity));
		a.push({
			x: r.x,
			halfWidth: l,
			reported: o.reported,
			gap: o.gap
		});
	}
	let o = n.height - n.margin.bottom, s = Math.max(0, o - n.margin.top), c = (e) => o - s * e / Math.max(1, r), l = cl().x((e) => e.x).y((e) => c(e.reported)).curve(al), u = ll().x((e) => e.x).y0(o).y1((e) => c(e.reported)).curve(al);
	return i.map((e) => {
		let t = e.length === 1 ? [{
			...e[0],
			x: Math.max(n.margin.left, e[0].x - e[0].halfWidth)
		}, {
			...e[0],
			x: Math.min(n.width - n.margin.right, e[0].x + e[0].halfWidth)
		}] : e;
		return {
			line: l(t) ?? "",
			fill: e.some((e) => e.gap > 0) ? u(t) ?? "" : ""
		};
	});
}
//#endregion
//#region src/lib/analysis-validation.ts
var $ = class extends Error {
	constructor(e) {
		super(e), this.name = "AnalysisValidationError";
	}
};
function xl(e, t) {
	if (new Set(e).size !== e.length) throw new $(`Duplicate ${t}`);
}
function Sl(e, t) {
	if (e !== null && (!Number.isSafeInteger(e) || e < 0)) throw new $(`${t} is not a safe non-negative integer`);
}
//#endregion
//#region src/lib/reconstruction.ts
var Cl = {
	missingHistoricalSystemPrompt: "Historical system instructions are not recorded completely.",
	missingHistoricalToolDefinitions: "Historical tool declarations are not recorded completely.",
	unrecordedRequestTransforms: "Plugins and provider request transformations may not be recorded.",
	unknownOutputAccounting: "Output/reasoning overlap is unverified; recorded counters are kept separate.",
	unknownCompactionPrompt: "The exact prompt used to generate a compaction summary is not recorded.",
	unpairedCompactionSummary: "A summary has no matching compaction marker; no history reset was inferred.",
	ambiguousPruningBoundary: "A tool-result pruning boundary cannot be ordered precisely against a call.",
	unsupportedContent: "Some recorded content or attachments cannot be projected into model context.",
	storageGenerationSelection: "One storage generation was selected using recorded recency and projection availability.",
	aggregatedCompactionUsage: "A compaction billing record may aggregate multiple requests; request count and input exposure are unknown.",
	missingCompactionUsage: "Some compaction records have no request usage; session usage totals may be incomplete.",
	projectedRequestBoundaries: "Migrated assistant records may omit original request boundaries or include synthetic attempts.",
	unrecordedHarnessCalls: "The harness's own model calls, such as title generation and compaction, are not recorded.",
	inferredUnsentHistory: "A forked or spawned thread's first call reported far less input than its parent's history, so the oldest inherited items are shown as not sent. Where that history ends was inferred from usage.",
	inferredContextReset: "At the start of a turn the reported input fell far below the calculated context with no compaction recorded, so the earlier conversation is shown as reset. This was inferred from usage.",
	unverifiedCompactionRetention: "A compaction does not record which recent messages it kept; only its summary is carried forward.",
	unrenderedAttachments: "Some context the harness added was recorded without its text, so its size is unknown.",
	unrecordedRounds: "A request that was stopped or interrupted recorded its model calls as one, so its calls' context and output are not split.",
	traceRecordsIncomplete: "Some calls have no Copilot trace record (Copilot keeps them for a few days), so they show only what the session file records: no per-call usage, timing, system prompt or tools.",
	traceRecordsUnreadable: "Copilot's trace database could not be read, so calls show only what the session file records.",
	repairedCompactionLink: "A compaction marker named a later or missing record as its predecessor; the conversation was continued from the record before the marker."
}, wl = /* @__PURE__ */ new Set([
	"opencode",
	"claude-code",
	"codex",
	"vscode-copilot"
]);
function Tl(e) {
	let t = e.reconstruction;
	if ((t !== void 0 || wl.has(e.session.source)) && (!t || t.status !== "partial" || !Array.isArray(t.explanationCodes) || t.explanationCodes.length === 0 || t.explanationCodes.length > 32 || t.explanationCodes.some((e) => typeof e != "string" || !Object.prototype.hasOwnProperty.call(Cl, e)) || new Set(t.explanationCodes).size !== t.explanationCodes.length)) throw new $("Analysis has invalid or missing source reconstruction coverage");
}
//#endregion
//#region src/lib/estimate-quality.ts
var El = .02, Dl = .1, Ol = {
	modelTokenizer: "Tokens are counted with the model's own tokenizer.",
	apiSerializationEstimate: "Tokens are counted with a reconstruction of the model's tokenizer, and the request format around them is estimated.",
	characterHeuristic: "Some tokens are estimated from character counts, which is rough."
}, kl = {
	tokenizationDisabled: "Token counting is turned off for this server.",
	"one-or-more-context-items-unavailable": "Some context items have no content to count."
};
function Al(e) {
	let { session: t } = e.analysis;
	if (t.reconciliationComparableCalls > 0 && t.medianAbsoluteResidualPercent !== null) {
		let e = t.medianAbsoluteResidualPercent;
		return {
			share: e,
			lead: `On median, the River's totals differ from the input the provider reported by ${Va(e)}, across ${Q(t.reconciliationComparableCalls)} calls.`
		};
	}
	let n = vl(e);
	if (n.medianGapShare === null) return null;
	let r = n.maximumGap === null ? "" : ` The largest gap is ${Z(n.maximumGap)} tokens.`;
	return {
		share: n.medianGapShare,
		lead: `On median, the River's totals differ from the input the provider reported by ${Va(n.medianGapShare)}, across ${Q(n.comparedCalls)} calls.${r}`
	};
}
function jl(e) {
	let [t, ...n] = e.modelCalls;
	return !t || n.length === 0 ? /* @__PURE__ */ new Set() : new Set(t.tokenAnalysis.explanationCodes.filter((e) => n.every((t) => t.tokenAnalysis.explanationCodes.includes(e))));
}
function Ml(e, t) {
	return e === "heuristicTokenizer" || e === "estimatedProviderSerialization" || e === "knownFramingOverheadAvailable" ? !0 : e === "missingSystemPrompt" || e === "missingToolDefinitions" ? t.contextItems.some((e) => e.kind === "unrecordedContext") || (t.reconstruction?.explanationCodes ?? []).some((e) => e.startsWith("missingHistorical")) : !1;
}
function Nl(e) {
	let { analysis: t } = e, { tokenAnalysis: n } = t, r = (t.reconstruction?.explanationCodes ?? []).map((e) => Cl[e]).filter((e) => !!e);
	if (t.displayWeightUnit === "unavailable") {
		let e = kl[n.fallbackReason ?? ""];
		return {
			level: "unavailable",
			label: "Estimates: unavailable",
			lead: "Token sizes aren't available for this session, so the River shows every item at the same placeholder size.",
			reasons: e ? [e, ...r] : r
		};
	}
	t.contextItems.some((e) => e.kind === "unrecordedContext") && r.push("Content the source does not record, such as the system prompt and tool definitions, is measured from reported usage as \"Unrecorded request context\".");
	let i = n.itemEstimateCoverage;
	i.partialItems > 0 && r.push(`${Q(i.partialItems)} of ${Q(i.totalItems)} items have only part of their content counted.`), i.unavailableItems > 0 && r.push(`${Q(i.unavailableItems)} of ${Q(i.totalItems)} items could not be counted.`);
	let a = Object.keys(n.tokenizerMethods);
	for (let e of a) {
		let t = Ol[e];
		t && r.push(t);
	}
	for (let e of jl(t)) {
		let n = Ro(e);
		n && !Ml(e, t) && r.push(`${n.title}. ${n.impact}`);
	}
	let o = Al(e), s, c;
	if (o) s = o.share <= El ? "good" : o.share <= Dl ? "partial" : "rough", c = o.lead;
	else {
		let e = i.partialItems === 0 && i.unavailableItems === 0;
		s = a.includes("characterHeuristic") ? "rough" : e && a.every((e) => e === "modelTokenizer") ? "good" : "partial", c = "No call has reported input to compare against, so this is based on how the tokens were counted.";
	}
	return {
		level: s,
		label: `Estimates: ${s}`,
		lead: c,
		reasons: r
	};
}
//#endregion
//#region src/lib/cost-basis.ts
var Pl = {
	piModelRates: {
		label: "Harness-recorded cost",
		totalLabel: "Harness-recorded cost total",
		promptLabel: "Harness-recorded prompt cost",
		componentPrefix: "Pi-rate",
		basisLabel: "Configured Pi model rates",
		note: "Cost recorded by Pi using configured model rates, not provider-billed charges. Recorded zero does not necessarily mean free.",
		trackCaveat: "not provider billed"
	},
	sourceModelRates: {
		label: "Harness-recorded cost",
		totalLabel: "Harness-recorded cost total",
		promptLabel: "Harness-recorded prompt cost",
		componentPrefix: "Harness-rate",
		basisLabel: "Configured harness model rates",
		note: "Cost recorded by the harness using its configured model rates, not provider-billed charges. Recorded zero does not necessarily mean free.",
		trackCaveat: "not provider billed"
	},
	providerReported: {
		label: "Provider-reported cost",
		totalLabel: "Provider-reported cost total",
		promptLabel: "Provider-reported prompt cost",
		componentPrefix: "Reported",
		basisLabel: "Provider-reported",
		note: "Cost amounts were reported by the provider and may not represent an invoice total.",
		trackCaveat: "reported by the provider"
	},
	unknown: {
		label: "Reported cost",
		totalLabel: "Reported cost total",
		promptLabel: "Reported prompt cost",
		componentPrefix: "Reported",
		basisLabel: "Not identified",
		note: "The cost basis is not identified; treat these values as source data rather than invoice amounts.",
		trackCaveat: "cost basis not identified"
	}
}, Fl = {
	...Pl.unknown,
	basisLabel: "None: Claude Code records no cost",
	note: "Claude Code records token usage but no cost for each call, so costs are calculated from the price table.",
	trackCaveat: "no recorded cost"
}, Il = {
	...Pl.unknown,
	basisLabel: "None: Codex records no cost",
	note: "Codex records token usage but no cost for each call, so costs are calculated from the price table.",
	trackCaveat: "no recorded cost"
}, Ll = {
	...Pl.unknown,
	label: "Copilot-recorded cost",
	totalLabel: "Copilot-recorded cost total",
	basisLabel: "Copilot credits, at $0.01 a credit",
	note: "Copilot records what it charged for each call in credits, in trace records it keeps for a few days, and for each request in the session file. Calls without a record are priced from the price table.",
	trackCaveat: "recorded by Copilot"
};
function Rl(e, t) {
	return t === "claude-code" ? Fl : t === "codex" ? Il : t === "vscode-copilot" ? Ll : Pl[e] ?? Pl.unknown;
}
function zl(e) {
	return e === "pi";
}
function Bl(e) {
	return zl(e) ? "Pi-normalized" : "Source-normalized";
}
//#endregion
//#region src/lib/economics.ts
var Vl = {
	providerUsageIncomplete: {
		title: "Prompt usage is incomplete",
		impact: "A required bucket is missing or could not be summed, so no cache ratios are derived."
	},
	providerUsageMissing: {
		title: "Prompt usage is missing",
		impact: "This call has no persisted prompt buckets for its audited provider/API policy."
	},
	unexpectedCacheWriteBucket: {
		title: "Unexpected cache-write bucket",
		impact: "This normalized call has a nonzero write bucket outside the audited OpenAI policy, so its ratios are withheld."
	},
	cacheWriteNotReported: {
		title: "Cache writes are not separately reported",
		impact: "The audited API policy does not provide a separate cache-write ratio."
	},
	cacheWriteNotRetainedByPi: {
		title: "Pi did not retain cache-write detail",
		impact: "The adapter normalizes cache writes to zero and may drop upstream write tokens; this is not a measured zero."
	},
	cacheWriteTtlNotRetained: {
		title: "Cache-write lifetime is unavailable",
		impact: "The aggregate write count does not retain its TTL split, so a prompt-cost subtotal is omitted when writes exist."
	},
	piCostComponentsIncomplete: {
		title: "Cost components are incomplete",
		impact: "The available calculated total remains separate; no prompt-cost subtotal is inferred."
	},
	piCostMissing: {
		title: "Cost data is missing",
		impact: "No persisted cost components are available for this call."
	},
	piCostTotalDiffersFromComponents: {
		title: "Cost total differs from its components",
		impact: "The persisted total and component values are kept independently; neither is balanced or reassigned."
	},
	piModelRateCostBasis: {
		title: "Cost uses model rates",
		impact: "This is a calculation from configured model rates, not a provider invoice or exact billed charge."
	},
	sourceModelRateCostBasis: {
		title: "Cost uses harness model rates",
		impact: "This cost was recorded by the harness using its configured model rates, not a provider invoice or exact billed charge."
	},
	providerReportedCostBasis: {
		title: "Cost was reported by the provider",
		impact: "These values may not represent an invoice total."
	},
	unknownCostBasis: {
		title: "Cost basis is not identified",
		impact: "Treat these values as source data rather than invoice amounts."
	},
	unsupportedEconomicsPolicy: {
		title: "Provider/API policy is unsupported",
		impact: "Raw usage remains visible, but no cache ratios or cost-component interpretation is derived."
	}
};
function Hl(e, t = "piModelRates", n = "pi") {
	if (!Object.prototype.hasOwnProperty.call(Vl, e)) return null;
	let r = Vl[e];
	if (e === "cacheWriteNotRetainedByPi" && !zl(n)) return {
		title: "Source did not retain cache-write detail",
		impact: "The source normalizes cache writes to zero and may drop upstream write tokens; this is not a measured zero."
	};
	if (e === "piCostComponentsIncomplete" || e === "piCostMissing" || e === "piCostTotalDiffersFromComponents") {
		let n = Rl(t), i = n.label;
		return e === "piCostComponentsIncomplete" ? {
			title: `${i} components are incomplete`,
			impact: `The available ${n.totalLabel.toLowerCase()} remains separate; no prompt-cost subtotal is inferred.`
		} : e === "piCostMissing" ? {
			title: `${i} data is missing`,
			impact: "No persisted cost components are available for this call."
		} : {
			title: `${i} total differs from its components`,
			impact: r.impact
		};
	}
	if (e === "unknownCostBasis" && n === "claude-code") return {
		title: "Claude Code records no cost",
		impact: Rl(t, n).note
	};
	if (e === "piModelRateCostBasis" || e === "sourceModelRateCostBasis" || e === "providerReportedCostBasis" || e === "unknownCostBasis") {
		let e = Rl(t);
		return {
			title: `Cost uses ${e.basisLabel.toLowerCase()}`,
			impact: t === "piModelRates" ? "This is a calculation from configured model rates, not a provider invoice or exact billed charge." : e.note
		};
	}
	return r;
}
//#endregion
//#region src/lib/session-label.ts
var Ul = new Intl.DateTimeFormat(void 0, {
	day: "numeric",
	month: "short",
	hour: "numeric",
	minute: "2-digit"
}), Wl = new Intl.DateTimeFormat(void 0, {
	day: "numeric",
	month: "short",
	year: "numeric",
	hour: "numeric",
	minute: "2-digit"
});
new Intl.NumberFormat(void 0, { maximumFractionDigits: 1 });
function Gl(e, t = /* @__PURE__ */ new Date()) {
	if (!e) return null;
	let n = new Date(e);
	return Number.isNaN(n.getTime()) ? null : (n.getFullYear() === t.getFullYear() ? Ul : Wl).format(n);
}
//#endregion
//#region src/lib/cost-assessment.ts
function Kl(e) {
	return e === "pi" ? "Pi" : e === "opencode" ? "OpenCode" : e === "claude-code" ? "Claude Code" : e === "codex" ? "Codex" : e === "vscode-copilot" ? "VS Code Copilot" : "the harness";
}
function ql(e, t) {
	return ["claude-code", "codex"].includes(t) && e.classificationRule === "billingModeTable";
}
function Jl(e, t) {
	if (e.kind === "apiEquivalent" && ql(e, t)) return "API rate";
	switch (e.kind) {
		case "recorded": return "Recorded";
		case "estimated": return "Estimated";
		case "apiEquivalent": return "API-equivalent";
		case "free": return "Free";
		default: return "Unknown";
	}
}
function Yl(e, t, n) {
	return t === null || t === e ? n(e) : `${n(e)}–${n(t)}`;
}
function Xl(e) {
	if (e.amount === null) return "Unknown";
	let t = Yl(e.amount, e.amountHigh, (e) => za(e));
	return e.kind === "estimated" || e.kind === "apiEquivalent" ? `≈ ${t}` : t;
}
function Zl(e, t) {
	if (e.low === null) return "Unknown";
	let n = Yl(e.low, e.high, (e) => Ba(e));
	return t || e.high !== e.low ? `≈ ${n}` : n;
}
var Ql = new Intl.DateTimeFormat("en-AU", {
	day: "numeric",
	month: "short",
	year: "numeric",
	timeZone: "UTC"
}), $l = {
	documented: "date from the provider",
	firstObserved: "date first seen on the provider's pricing page",
	modelsDevCommit: "date recorded by models.dev, which may lag the provider"
};
function eu(e) {
	let t = e.rate;
	if (!t) return null;
	let n = t.validFrom ? `from ${Ql.format(new Date(t.validFrom))}` : "its first listed rate";
	return `${e.kind === "apiEquivalent" ? `${t.provider} API rate` : `${t.provider} rate`} for ${t.model}, ${n} (${$l[t.startBasis]})`;
}
function tu(e, t) {
	return e.kind === "recorded" || e.recordedByHarness === null || e.amount !== null && e.amountHigh === null && e.recordedByHarness === e.amount ? null : `Recorded by ${Kl(t)}: ${za(e.recordedByHarness)}`;
}
function nu(e, t) {
	let n = Kl(t);
	switch (e.classificationRule) {
		case "recordedCost": return t === "vscode-copilot" ? "Billed per token; this is what Copilot recorded charging, in credits at $0.01 each." : `Billed per token; this is the cost ${n} recorded.`;
		case "billingModeTable": return ql(e, t) ? `At ${t === "codex" ? "OpenAI" : "Anthropic"}'s API rate.` : e.billingMode === "subscription" ? "This provider is covered by a subscription, so this is what the call would have cost at the API rate. It is not a charge." : e.kind === "free" ? "Billed per token, and the provider listed this model as free at the time." : `Billed per token. ${n} recorded no cost, so it is estimated at the provider's rate.`;
		case "opencodeZeroWithListedPrice": return "OpenCode recorded $0 although OpenAI listed a price, which happens when OpenCode signs in with a ChatGPT plan. Treated as a subscription: this is what the call would have cost at the API rate, not a charge.";
		case "perTokenDefault": return e.kind === "free" ? "The provider listed this model as free at the time." : `${n} recorded no cost, so it is estimated at the provider's rate.`;
		case "failedAttempt": return "The attempt failed; its recorded zeros are not a measurement, so no cost is shown.";
		case "missingTime": return "The call has no time to choose a price by.";
		case "noPrice": return "No price is known for this model at the time.";
		case "missingUsage": return "Token counts needed to estimate the cost were not recorded.";
	}
}
var ru = "A range because the harness did not record whether its output count already includes reasoning tokens.";
function iu(e) {
	let t = [e.billed, e.apiEquivalent].filter((e) => e.calls > 0);
	if (t.length === 0) return null;
	let n = (e) => t.some((t) => t[e] === null) ? null : t.reduce((t, n) => t + (n[e] ?? 0), 0), r = {
		low: n("low"),
		high: n("high"),
		calls: t.reduce((e, t) => e + t.calls, 0)
	};
	return {
		label: "Cost",
		value: Zl(r, !0),
		note: ((e) => `${e.toLocaleString("en-AU")} call${e === 1 ? "" : "s"}`)(r.calls),
		title: "At API rates: the cost the harness recorded, or an estimate at the provider’s rate. Calls covered by a subscription are priced at what they would have cost. Not an invoice.",
		split: t.length === 2 ? `${Zl(e.billed, !0)} billed per token · ${Zl(e.apiEquivalent, !0)} covered by a subscription` : null
	};
}
function au(e) {
	let t = [];
	return e.unknownCalls > 0 && t.push(`${e.unknownCalls.toLocaleString("en-AU")} call${e.unknownCalls === 1 ? "" : "s"} without a price`), e.failedAttemptCalls > 0 && t.push(`${e.failedAttemptCalls.toLocaleString("en-AU")} failed attempt${e.failedAttemptCalls === 1 ? "" : "s"} not counted`), t.length ? t.join(" · ") : null;
}
function ou(e, t, n = /* @__PURE__ */ new Date()) {
	if (t === "vscode-copilot") return "The credits Copilot recorded for every request, at $0.01 each, including calls whose trace record is gone";
	let r = e.sinceMs === null ? null : Gl(new Date(e.sinceMs).toISOString(), n), i = `includes subagents and ${Kl(t)}'s own calls, which are not in this transcript`;
	return r ? `Since ${r} · ${i}` : `Covers ${i.replace(/^includes /, "")}`;
}
//#endregion
//#region src/lib/recorded-usage.ts
var su = {
	includesReasoning: "Recorded output includes reasoning",
	excludesReasoning: "Recorded output excludes reasoning",
	unknown: "Output/reasoning overlap not established"
};
function cu(e) {
	return su[e];
}
function lu(e) {
	let t = [{
		label: "Recorded output",
		value: e.placeholder ? "Unavailable" : e.recordedOutput === null ? "Not recorded" : Z(e.recordedOutput)
	}];
	return (e.reasoning !== null || e.placeholder?.reasoning != null) && t.push({
		label: "Recorded reasoning",
		value: e.placeholder ? "Unavailable" : Z(e.reasoning)
	}), t;
}
function uu(e) {
	let { recordedCalls: t, failedAttemptCalls: n, missingCalls: r } = e, i = t + n + r;
	if (i === 0 || t === i) return null;
	let a = [`${Q(t)} of ${Q(i)} calls`];
	return n > 0 && a.push(`${Q(n)} failed attempt${n === 1 ? "" : "s"} not recorded`), a.join(" · ");
}
//#endregion
//#region src/lib/components/ItemContribution.svelte
var du = /* @__PURE__ */ W("<span class=\"track svelte-jx5fif\" aria-hidden=\"true\"><span class=\"fill svelte-jx5fif\"></span></span>"), fu = /* @__PURE__ */ W("<span class=\"unknown svelte-jx5fif\" aria-hidden=\"true\">Share unavailable</span>"), pu = /* @__PURE__ */ W("<span><!> <span class=\"detail svelte-jx5fif\"> </span></span>"), mu = {
	hash: "svelte-jx5fif",
	code: ".track.svelte-jx5fif {display:block;height:3px;margin-top:6px;overflow:hidden;border-radius:var(--radius-small);background:var(--separator);}.fill.svelte-jx5fif {display:block;height:100%;background:var(--secondary);}.unknown.svelte-jx5fif,\n  .detail.svelte-jx5fif {display:block;margin-top:5px;color:var(--secondary);font-size:var(--text-xs);font-weight:normal;}.detail.svelte-jx5fif {display:none;}button:focus .detail.svelte-jx5fif {display:block;}"
};
function hu(e, t) {
	Be(t, !0), li(e, mu);
	var n = pu(), r = L(n), i = (e) => {
		var n = du(), r = L(n);
		let i;
		M(n), V(() => i = vi(r, "", i, { width: `${t.value.share * 100}%` })), G(e, n);
	}, a = (e) => {
		G(e, fu());
	};
	q(r, (e) => {
		t.value.share === null ? e(a, -1) : e(i);
	});
	var o = B(r, 2), s = z(o, !0);
	M(n), V(() => {
		Y(o, "id", t.descriptionId), K(s, t.value.detail);
	}), G(e, n), Ve();
}
//#endregion
//#region src/lib/economics-policy.ts
var gu = {
	"anthropic-messages-cache-v1": {
		provider: "anthropic",
		api: "anthropic-messages",
		cacheWriteStatus: "reported",
		hasFreshRatio: !0,
		hasWriteRatio: !0,
		categories: [
			"cacheRead",
			"cacheWrite",
			"fresh"
		]
	},
	"github-copilot-messages-cache-v1": {
		provider: "github-copilot",
		api: "anthropic-messages",
		cacheWriteStatus: "reported",
		hasFreshRatio: !0,
		hasWriteRatio: !0,
		categories: [
			"cacheRead",
			"cacheWrite",
			"fresh"
		]
	},
	"github-copilot-responses-cache-v1": {
		provider: "github-copilot",
		api: "openai-responses",
		cacheWriteStatus: "reported",
		hasFreshRatio: !0,
		hasWriteRatio: !0,
		categories: [
			"cacheRead",
			"cacheWrite",
			"fresh"
		]
	},
	"openai-completions-cache-v1": {
		provider: "openai",
		api: "openai-completions",
		cacheWriteStatus: "notReported",
		hasFreshRatio: !0,
		hasWriteRatio: !1,
		categories: ["cacheRead", "uncached"]
	},
	"openai-responses-cache-read-v1": {
		provider: "openai",
		api: "openai-responses",
		cacheWriteStatus: "notRetainedByPi",
		hasFreshRatio: !1,
		hasWriteRatio: !1,
		categories: ["cacheRead", "nonRead"]
	},
	"openai-codex-responses-cache-read-v1": {
		provider: "openai-codex",
		api: "openai-codex-responses",
		cacheWriteStatus: "notRetainedByPi",
		hasFreshRatio: !1,
		hasWriteRatio: !1,
		categories: ["cacheRead", "nonRead"]
	}
}, _u = /* @__PURE__ */ new Set([
	"anthropic-messages-cache-v1",
	"github-copilot-messages-cache-v1",
	"github-copilot-responses-cache-v1"
]), vu = "openai-completions-cache-v1", yu = /* @__PURE__ */ new Set(["openai-responses-cache-read-v1", "openai-codex-responses-cache-read-v1"]), bu = Object.fromEntries(Object.entries(gu).map(([e, t]) => [e, t.categories])), xu = {
	cacheRead: {
		label: "Cache read",
		shortLabel: "Read"
	},
	cacheWrite: {
		label: "Cache write",
		shortLabel: "Write"
	},
	fresh: {
		label: "Fresh input",
		shortLabel: "Fresh"
	},
	uncached: {
		label: "Uncached input",
		shortLabel: "Uncached"
	},
	nonRead: {
		label: "Non-cache-read input",
		shortLabel: "Non-read"
	}
}, Su = [
	"cacheRead",
	"cacheWrite",
	"fresh",
	"uncached",
	"nonRead"
];
function Cu(e, t) {
	return `Cache-read share ${e.direction === "drop" ? "dropped" : "rose"} from ${Ha(e.previousRatio)} on call ${e.previousCallIndex} to ${Ha(e.currentRatio)} on call ${t}`;
}
function wu(e) {
	let t = e.modelCalls.map((t) => Eu(t, e));
	return {
		points: t,
		maximum: t.reduce((e, t) => t.status === "complete" || t.status === "zero" ? Math.max(e, t.promptTokens ?? 0) : e, 0),
		presentation: Tu(e, t)
	};
}
function Tu(e, t = e.modelCalls.map((t) => Eu(t, e))) {
	let n = [...new Set(e.modelCalls.map((e) => e.economics.policyId).filter((e) => e !== null && bu[e] !== void 0))], r = new Map(t.map((e) => [e.callIndex, e])), i = Su.flatMap((t) => {
		let i = n.filter((e) => bu[e]?.includes(t));
		if (i.length === 0) return [];
		let a = e.modelCalls.flatMap((e) => {
			if (!i.includes(e.economics.policyId ?? "")) return [];
			let t = r.get(e.index);
			return t ? [t] : [];
		}), o = a.length, s = a.filter((e) => (e.status === "complete" || e.status === "zero") && e.segments.some((e) => e.kind === t)).length, c = a.flatMap((e) => e.segments.filter((e) => e.kind === t).map((e) => e.value)), l = c.length > 0 && c.every((e) => e === 0), u = a.filter((e) => e.status === "missing").length, d = a.filter((e) => e.status === "partial").length, f = a.filter((e) => e.status === "unsupported").length, p, m = "";
		return t === "cacheWrite" && i.includes(vu) ? (p = "notReported", m = "Chat Completions does not report a separate cache-write bucket.") : p = s === 0 ? f === o ? "unsupported" : u === o ? "missing" : u > 0 || d > 0 || f > 0 ? "partial" : "missing" : u > 0 || d > 0 || f > 0 || s < o ? "partial" : l ? "measuredZero" : "available", t === "nonRead" && (m = "Read-only Responses policies cannot establish a separate fresh/write split."), t === "cacheWrite" && i.some((e) => yu.has(e)) && (p = "notRetained", m = zl(e.session.source) ? "The audited read-only policy does not establish separate cache-write detail from Pi." : "The audited read-only policy does not establish separate cache-write detail from the source."), [{
			kind: t,
			label: xu[t].label,
			shortLabel: xu[t].shortLabel,
			applicablePolicyIds: i,
			availability: p,
			completeCalls: s,
			applicableCalls: o,
			note: m
		}];
	}), a = [], o = e.modelCalls.filter((e) => e.economics.policyId === null || e.economics.usageCompleteness === "unsupported").length;
	n.length === 0 ? a.push("No supported provider/API cache policy is available for this session.") : o > 0 && a.push(`${o} call${o === 1 ? "" : "s"} lack a supported cache interpretation; raw call details remain available.`), n.includes(vu) && a.push("Chat Completions does not report cache writes separately; its input series is labeled uncached."), n.some((e) => yu.has(e)) && a.push(zl(e.session.source) ? "Read-only Responses policies: non-cache-read input may include writes; the audited Pi policy does not establish the write/fresh split." : "Read-only Responses policies: non-cache-read input may include writes; the source policy does not establish the write/fresh split.");
	let s = n.length > 1;
	return s && a.unshift("Categories vary by model/API; each call retains its exact policy semantics."), {
		categories: i,
		applicablePolicyIds: n,
		mixedPolicy: s,
		summary: n.length === 0 ? "Cache categories unavailable under the retained provider/API policy." : s ? "Categories vary by model/API." : "Categories follow the audited provider/API policy.",
		notes: a
	};
}
function Eu(e, t) {
	let n = e.economics, r = (t, n) => ({
		callIndex: e.index,
		status: t,
		promptTokens: null,
		segments: [],
		shareSegments: [],
		shareStatus: "unavailable",
		shareDenominator: null,
		note: n,
		discontinuity: null
	});
	if (n.policyId === null || n.usageCompleteness === "unsupported") return r("unsupported", "Cache policy unsupported; raw fields remain in call details.");
	if (n.usageCompleteness === "missing") return r("missing", "Prompt usage is missing; this is not a numeric zero.");
	if (n.usageCompleteness !== "complete" || n.promptTokens === null) return r("partial", "Required prompt buckets are incomplete; no complete stack is shown.");
	let { input: i, cacheRead: a, cacheWrite: o } = e.usage;
	if (i === null || a === null) return r("partial", "Required normalized prompt buckets are incomplete.");
	let s, c = "";
	if (_u.has(n.policyId)) {
		if (o === null) return r("partial", "Recorded cache-write usage is incomplete.");
		s = [
			{
				kind: "cacheRead",
				label: "Cache read",
				value: a
			},
			{
				kind: "cacheWrite",
				label: "Cache write",
				value: o
			},
			{
				kind: "fresh",
				label: "Fresh input",
				value: i
			}
		];
	} else if (n.policyId === vu) s = [{
		kind: "cacheRead",
		label: "Cache read",
		value: a
	}, {
		kind: "uncached",
		label: "Uncached input",
		value: i
	}], c = "The audited Chat Completions target does not report a separate cache-write bucket.";
	else if (yu.has(n.policyId)) s = [{
		kind: "cacheRead",
		label: "Cache read",
		value: a
	}, {
		kind: "nonRead",
		label: "Non-cache-read input",
		value: i
	}], c = zl(t.session.source) ? "Non-cache-read input may include writes; Pi does not retain the write/fresh split." : "Non-cache-read input may include writes; the source does not retain the write/fresh split.";
	else return r("unsupported", "Cache policy unsupported; raw fields remain in call details.");
	let l = n.promptTokens === 0 ? "zero" : "complete", u = n.promptTokens === 0 ? "zeroPrompt" : "complete", d = n.promptTokens > 0 ? s.map((e) => ({
		...e,
		percentage: e.value / n.promptTokens * 100
	})) : [];
	return {
		callIndex: e.index,
		status: l,
		promptTokens: n.promptTokens,
		segments: s,
		shareSegments: d,
		shareStatus: u,
		shareDenominator: n.promptTokens,
		note: c,
		discontinuity: n.cacheRatioDiscontinuity
	};
}
function Du(e) {
	let t = e.modelCalls.map(Ou);
	return {
		points: t,
		maximum: t.reduce((e, t) => t.status === "known" || t.status === "zero" ? Math.max(e, t.high ?? t.total ?? 0) : e, 0)
	};
}
function Ou(e) {
	let t = e.costAssessment, n = {
		callIndex: e.index,
		kind: t.kind,
		componentStatus: t.kind === "recorded" ? e.economics.costCompleteness : "complete"
	};
	if (t.amount !== null) return {
		...n,
		status: t.amount === 0 ? "zero" : "known",
		total: t.amount,
		high: t.amountHigh
	};
	let r = e.cost, i = r ? [
		r.input,
		r.output,
		r.cacheRead,
		r.cacheWrite
	].some((e) => e !== null) : !1;
	return {
		...n,
		status: i ? "partial" : "missing",
		total: null,
		high: null
	};
}
//#endregion
//#region src/lib/components/item-contribution.ts
function ku(e, t, n, r) {
	let i = t.map((t) => n?.tokenizationProfileId ? e.itemById.get(t)?.tokenEstimates.find((e) => e.profileId === n.tokenizationProfileId) : void 0), a = 0, o = !0, s = !1;
	for (let e of i) {
		if (e?.coverage !== "complete" || e.tokens === null || !Number.isSafeInteger(e.tokens) || e.tokens < 0) {
			o = !1;
			continue;
		}
		a += e.tokens, Number.isSafeInteger(a) || (o = !1, s = !0);
	}
	return new Map(t.map((e, t) => {
		let c = i[t], l = c?.coverage === "unavailable" ? null : c?.tokens ?? null, u = o && a > 0 && l !== null ? l / a : null, d = l === null ? "Token estimate unknown" : `${c?.coverage === "partial" ? "Partial estimate" : "Estimated"} ${Q(l)} tokens`, f = l === null ? "item estimate unavailable" : s ? `${r} token total exceeds supported numeric range` : o ? `${r} token total is zero` : `${r} token total incomplete or unavailable`;
		return [e, {
			share: u,
			detail: u === null ? `${d}; share unavailable${n ? ` for call ${n.index} (${f})` : " (no previous call)"}` : `${d}; ${Va(u)} of estimated ${r} tokens (call ${n.index})`
		}];
	}));
}
function Au(e, t, n) {
	let r = /* @__PURE__ */ new Map(), i = 0, a = !0;
	for (let o of t) {
		let t = n?.tokenizationProfileId ? e.itemById.get(o)?.tokenEstimates.find((e) => e.profileId === n.tokenizationProfileId) : void 0, s = t && t.coverage !== "unavailable" && t.tokens !== null && Number.isSafeInteger(t.tokens) && t.tokens >= 0 ? t.tokens : null, c = s === null || t?.coverage !== "complete";
		c && (a = !1), s !== null && (i += s), r.set(o, {
			tokens: s,
			partial: c
		});
	}
	return {
		items: r,
		total: i,
		complete: a
	};
}
function ju(e, t) {
	return e.map((e, n) => ({
		id: e,
		position: n,
		tokens: t.get(e)?.tokens ?? null
	})).sort((e, t) => (t.tokens ?? -1) - (e.tokens ?? -1) || e.position - t.position).map((e) => e.id);
}
//#endregion
//#region src/lib/components/call-timing.ts
var Mu = "The rate is reported output, including reasoning, over that time.";
function Nu(e, t = !1) {
	switch (e) {
		case "claude-code": return "Claude Code does not record when a request started, so the response time and output rate are unavailable.";
		case "codex": return "Codex does not record when a request started, so the response time and output rate are unavailable.";
		case "vscode-copilot": return t ? `From Copilot sending the request to the end of the response, as its trace records show. ${Mu}` : "VS Code Copilot's trace record for this call is gone (Copilot keeps them for a few days), and the session file does not record when a response started, so the response time and output rate are unavailable.";
		case "pi": return `From Pi starting the response to recording it, including waiting and retries. ${Mu}`;
		case "opencode": return `From OpenCode creating the response to completing it, including waiting and retries. ${Mu}`;
		default: return `From the recorded start of the response to its end, including waiting and retries. ${Mu}`;
	}
}
function Pu(e) {
	return e === null ? "Unavailable" : e < 1e3 ? `${e.toLocaleString()} ms` : e < 6e4 ? `${(e / 1e3).toLocaleString(void 0, { maximumFractionDigits: 2 })} s` : `${Math.floor(e / 6e4).toLocaleString()} min ${(e % 6e4 / 1e3).toLocaleString(void 0, { maximumFractionDigits: 2 })} s`;
}
function Fu(e) {
	return e === null ? "Unavailable" : e > 0 && e < .01 ? "<0.01 tok/s" : `${e.toLocaleString(void 0, { maximumFractionDigits: 2 })} tok/s`;
}
//#endregion
//#region src/lib/components/CallDetails.svelte
var Iu = 0;
function Lu(e, t, n) {
	let r = t(e);
	return e !== null && n ? `≈ ${r}` : r;
}
var Ru = /* @__PURE__ */ W("<span class=\"retry-note svelte-1d84xhe\">Copilot recorded this call as a retry after an error.</span>"), zu = /* @__PURE__ */ W("<small class=\"svelte-1d84xhe\">The total of several requests: this response ran web searches, so it is not compared\n              with the context.</small>"), Bu = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div>"), Vu = /* @__PURE__ */ W("<p class=\"svelte-1d84xhe\"> </p>"), Hu = /* @__PURE__ */ W("<div class=\"cost-explanation svelte-1d84xhe\"><p class=\"svelte-1d84xhe\"> </p> <!> <!> <!></div>"), Uu = /* @__PURE__ */ W("<small class=\"svelte-1d84xhe\"> </small>"), Wu = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\">Provider usage</dt> <dd class=\"svelte-1d84xhe\"> <!></dd></div>"), Gu = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\">Response time (approx.)</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Effective output rate</dt> <dd class=\"svelte-1d84xhe\"> </dd></div>", 1), Ku = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\">Timing</dt> <dd class=\"svelte-1d84xhe\">Not recorded<!></dd></div>"), qu = /* @__PURE__ */ W("<span class=\"timing-explanation svelte-1d84xhe\"> </span>"), Ju = /* @__PURE__ */ W("<li class=\"svelte-1d84xhe\"><button type=\"button\" class=\"svelte-1d84xhe\"> <!></button></li>"), Yu = /* @__PURE__ */ W("<div class=\"change-list svelte-1d84xhe\"><h4 class=\"svelte-1d84xhe\"> </h4> <p class=\"change-baseline svelte-1d84xhe\">Share of estimated added tokens</p> <ul role=\"list\" class=\"svelte-1d84xhe\"></ul></div>"), Xu = /* @__PURE__ */ W("<div class=\"change-list svelte-1d84xhe\"><h4 class=\"svelte-1d84xhe\"> </h4> <p class=\"change-baseline svelte-1d84xhe\"><!></p> <ul role=\"list\" class=\"svelte-1d84xhe\"></ul></div>"), Zu = /* @__PURE__ */ W("<details class=\"svelte-1d84xhe\"><summary class=\"svelte-1d84xhe\"> </summary> <div><!> <!></div></details>"), Qu = /* @__PURE__ */ W("<p> </p>"), $u = /* @__PURE__ */ W("<span> </span>"), ed = /* @__PURE__ */ W("<div class=\"tool-summary svelte-1d84xhe\"><b>Tools invoked after this response</b> <div class=\"tool-list svelte-1d84xhe\"></div></div>"), td = /* @__PURE__ */ W("<p class=\"economics-note svelte-1d84xhe\">Failed or aborted attempt: recorded zeros are placeholders, not measured usage. Actual\n          token consumption and cost are unavailable; partial output does not establish usage.</p> <h4 class=\"svelte-1d84xhe\">Raw recorded placeholders</h4> <dl class=\"detail-rows svelte-1d84xhe\" aria-label=\"Raw recorded placeholders\"><!> <!></dl>", 1), nd = /* @__PURE__ */ W("<p class=\"economics-note svelte-1d84xhe\">These dollar figures do not measure Copilot subscription charges or premium requests.</p>"), rd = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Reported total tokens</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div>", 1), id = /* @__PURE__ */ W("<div class=\"ratio-discontinuity svelte-1d84xhe\" role=\"note\"><b> </b> <p class=\"svelte-1d84xhe\"> <!></p> <button type=\"button\" class=\"svelte-1d84xhe\"> </button></div>"), ad = /* @__PURE__ */ W("<b> </b> ", 1), od = /* @__PURE__ */ W("<b>Unrecognized economics explanation</b> — see the raw code in Technical identifiers.", 1), sd = /* @__PURE__ */ W("<li><!></li>"), cd = /* @__PURE__ */ W("<h4 class=\"svelte-1d84xhe\">Economics notes</h4> <ul class=\"economics-explanations svelte-1d84xhe\"></ul>", 1), ld = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\">Known framing</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Calculated request</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Residual</dt> <dd class=\"svelte-1d84xhe\"> </dd></div>", 1), ud = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\">Reported − reconstructed (approximate)</dt> <dd class=\"svelte-1d84xhe\"> <!></dd></div>"), dd = /* @__PURE__ */ W("<b>Unrecognized diagnostic</b> — see the raw code in Technical identifiers.", 1), fd = /* @__PURE__ */ W("<h4 class=\"svelte-1d84xhe\">Diagnostic explanations</h4> <ul class=\"diagnostics svelte-1d84xhe\"></ul>", 1), pd = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\">Cache write 1h (source detail)</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Output accounting</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Completion total (including reasoning)</dt> <dd class=\"svelte-1d84xhe\"> </dd></div>", 1), md = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\">Reconciliation status</dt> <dd class=\"svelte-1d84xhe\"> </dd></div>"), hd = /* @__PURE__ */ W("<small class=\"metric-note svelte-1d84xhe\"> </small>"), gd = /* @__PURE__ */ W(" <!>", 1), _d = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\">Tokenization profile ID</dt> <dd class=\"svelte-1d84xhe\"><code class=\"svelte-1d84xhe\"> </code> <!></dd></div>"), vd = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\">Economics policy ID</dt> <dd class=\"svelte-1d84xhe\"><code class=\"svelte-1d84xhe\"> </code> <!></dd></div>"), yd = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\">Compaction before this call</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Compaction ID</dt> <dd class=\"svelte-1d84xhe\"><code class=\"svelte-1d84xhe\"> </code></dd></div>", 1), bd = /* @__PURE__ */ W("<span class=\"error-mark svelte-1d84xhe\">failed</span>"), xd = /* @__PURE__ */ W("<li class=\"svelte-1d84xhe\"> <code class=\"svelte-1d84xhe\"> </code> <!> <!></li>"), Sd = /* @__PURE__ */ W("<h4 class=\"svelte-1d84xhe\">Tool-call IDs</h4> <ul class=\"tool-identifiers svelte-1d84xhe\"></ul>", 1), Cd = /* @__PURE__ */ W("<li><code class=\"svelte-1d84xhe\"> </code></li>"), wd = /* @__PURE__ */ W("<h4 class=\"svelte-1d84xhe\">Raw diagnostic codes</h4> <ul class=\"svelte-1d84xhe\"></ul>", 1), Td = /* @__PURE__ */ W("<h4 class=\"svelte-1d84xhe\">Raw economics codes</h4> <ul class=\"svelte-1d84xhe\"></ul>", 1), Ed = /* @__PURE__ */ W("<section class=\"call-details svelte-1d84xhe\"><header class=\"svelte-1d84xhe\"><div class=\"svelte-1d84xhe\"><h3 id=\"pinned-call-summary\" tabindex=\"-1\" class=\"svelte-1d84xhe\"> </h3> <span class=\"svelte-1d84xhe\"> </span> <!></div></header> <dl class=\"essential-metrics svelte-1d84xhe\"><div><dt class=\"svelte-1d84xhe\">Input</dt> <dd class=\"svelte-1d84xhe\"> <!></dd></div> <!> <div><dt class=\"svelte-1d84xhe\">Cost</dt> <dd class=\"svelte-1d84xhe\"> <!><small class=\"svelte-1d84xhe\"> </small></dd></div> <!> <!></dl> <!> <!> <!> <!> <details class=\"usage-breakdown svelte-1d84xhe\"><summary class=\"svelte-1d84xhe\">Usage and economics</summary> <!> <!> <dl class=\"detail-rows svelte-1d84xhe\"><div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Cache-read share</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Cache-write share</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <!></dl> <!> <!></details> <details class=\"token-diagnostics svelte-1d84xhe\"><summary class=\"svelte-1d84xhe\">Token estimates</summary> <dl class=\"detail-rows svelte-1d84xhe\"><div><dt class=\"svelte-1d84xhe\">Visible context</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <!> <div><dt class=\"svelte-1d84xhe\">Added tokens</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Retained tokens</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Dropped tokens</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Oldest / median live age</dt> <dd class=\"svelte-1d84xhe\"> </dd></div></dl> <!></details> <details class=\"call-diagnostics svelte-1d84xhe\"><summary class=\"svelte-1d84xhe\">Diagnostics</summary> <dl class=\"detail-rows svelte-1d84xhe\"><!> <div><dt class=\"svelte-1d84xhe\">Cumulative prompt</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Cumulative completion (including reasoning)</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Cumulative reasoning</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Cumulative usage completeness</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Estimate coverage</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <!> <div><dt class=\"svelte-1d84xhe\">Model / tokenizer</dt> <dd class=\"svelte-1d84xhe\"><!></dd></div> <div><dt class=\"svelte-1d84xhe\">Token-weighted mean age</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Items aged ≥5 / ≥10 / ≥20 calls</dt> <dd class=\"svelte-1d84xhe\"> </dd></div></dl></details> <details class=\"technical-identifiers svelte-1d84xhe\"><summary class=\"svelte-1d84xhe\">Technical identifiers</summary> <dl class=\"identifier-list svelte-1d84xhe\"><div><dt class=\"svelte-1d84xhe\">Source record ID</dt> <dd class=\"svelte-1d84xhe\"><code class=\"svelte-1d84xhe\"> </code> <!></dd></div> <!> <!></dl> <dl class=\"technical-values svelte-1d84xhe\"><div><dt class=\"svelte-1d84xhe\">Stop reason</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <!></dl> <!> <!> <!></details></section>"), Dd = {
	hash: "svelte-1d84xhe",
	code: ".call-details.svelte-1d84xhe {color:var(--text);min-width:0;max-width:100%;}header.svelte-1d84xhe {position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;gap:16px;align-items:start;margin:-2px 0 8px;padding:4px 0 7px;background:var(--surface);}header.svelte-1d84xhe div:where(.svelte-1d84xhe) {display:flex;flex-direction:column;gap:2px;}header.svelte-1d84xhe h3:where(.svelte-1d84xhe) {margin:0;color:var(--text);font-size:var(--text-lg);}header.svelte-1d84xhe h3:where(.svelte-1d84xhe):focus {outline:2px solid var(--accent);outline-offset:2px;}header.svelte-1d84xhe span:where(.svelte-1d84xhe) {color:var(--secondary);font-size:var(--text-sm);overflow-wrap:anywhere;}header.svelte-1d84xhe .retry-note:where(.svelte-1d84xhe) {display:block;margin-top:2px;}.essential-metrics.svelte-1d84xhe,\n  .detail-rows.svelte-1d84xhe,\n  .technical-values.svelte-1d84xhe {display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:7px 14px;margin:0;}.cost-explanation.svelte-1d84xhe p:where(.svelte-1d84xhe) {margin:0;overflow-wrap:anywhere;}.cost-explanation.svelte-1d84xhe p:where(.svelte-1d84xhe) + p:where(.svelte-1d84xhe) {margin-top:6px;}.timing-explanation.svelte-1d84xhe {position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;}dt.svelte-1d84xhe {color:var(--secondary);font-size:var(--text-sm);}dd.svelte-1d84xhe {margin:1px 0 0;color:var(--text-strong);overflow-wrap:anywhere;}dd.svelte-1d84xhe small:where(.svelte-1d84xhe) {display:block;color:var(--secondary);font-size:var(--text-sm);}.change-lists.svelte-1d84xhe {display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:8px 14px;margin-top:10px;}.change-lists.single.svelte-1d84xhe {grid-template-columns:minmax(0, 1fr);}details.svelte-1d84xhe {margin-top:10px;min-width:0;}.change-list.svelte-1d84xhe {min-width:0;}.change-lists.svelte-1d84xhe h4:where(.svelte-1d84xhe) {margin-top:0;}.change-lists.svelte-1d84xhe ul:where(.svelte-1d84xhe) {list-style:none;padding-left:0;}.change-lists.svelte-1d84xhe button:where(.svelte-1d84xhe) {width:100%;text-align:left;}.change-baseline.svelte-1d84xhe {margin:0 0 6px;color:var(--secondary);font-size:var(--text-xs);}summary.svelte-1d84xhe {color:var(--text);cursor:pointer;}.tool-summary.svelte-1d84xhe {margin-top:10px;}.tool-list.svelte-1d84xhe {display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:4px;}.tool-chip.svelte-1d84xhe {display:inline;color:var(--secondary);font-size:var(--text-sm);cursor:default;}.tool-chip.failed.svelte-1d84xhe {color:var(--error);}.detail-rows.svelte-1d84xhe,\n  .technical-values.svelte-1d84xhe {margin-top:8px;}.economics-note.svelte-1d84xhe,\n  .economics-explanations.svelte-1d84xhe {color:var(--secondary);font-size:var(--text-sm);line-height:1.4;}.economics-note.svelte-1d84xhe {margin:6px 0;}.ratio-discontinuity.svelte-1d84xhe {margin-top:9px;padding:8px 10px;border-left:3px solid var(--event-warning);border-radius:4px;background:var(--surface-raised);color:var(--text);font-size:var(--text-sm);}.ratio-discontinuity.svelte-1d84xhe p:where(.svelte-1d84xhe) {margin:4px 0 7px;color:var(--text);}h4.svelte-1d84xhe {margin:11px 0 4px;color:var(--text);font-size:var(--text-sm);}ul.svelte-1d84xhe {margin:4px 0 0;padding-left:18px;overflow-wrap:anywhere;}.diagnostics.svelte-1d84xhe {font-size:var(--text-sm);}.identifier-list.svelte-1d84xhe {display:grid;gap:7px;margin:8px 0 0;}.identifier-list.svelte-1d84xhe dd:where(.svelte-1d84xhe) {display:grid;justify-items:start;gap:4px;}.tool-identifiers.svelte-1d84xhe li:where(.svelte-1d84xhe) {margin-top:5px;}code.svelte-1d84xhe {color:var(--secondary);overflow-wrap:anywhere;user-select:all;}button.svelte-1d84xhe:not(.copy-control:where(.svelte-1d84xhe) button:where(.svelte-1d84xhe)) {max-width:100%;overflow-wrap:anywhere;}.error-mark.svelte-1d84xhe {color:var(--error);margin-left:6px;}\n  @container highwater (max-width: 520px) {.essential-metrics.svelte-1d84xhe,\n    .detail-rows.svelte-1d84xhe,\n    .technical-values.svelte-1d84xhe,\n    .change-lists.svelte-1d84xhe {grid-template-columns:1fr;}\n  }"
};
function Od(e, t) {
	Be(t, !0), li(e, Dd);
	let n = `call-contribution-${Iu++}`, r = X(t, "sections", 19, Hi), i = X(t, "pinned", 3, !1), a = X(t, "onSelectItem", 3, () => {}), o = X(t, "onPinCall", 3, () => {}), s = /* @__PURE__ */ P(() => t.call?.tokenAnalysis.metricsIncludePartialEstimates ?? !1), c = /* @__PURE__ */ P(() => t.call ? gl(t.indexed, t.call) : null), l = /* @__PURE__ */ P(() => t.call?.compactionBefore ? t.indexed.compactionById.get(t.call.compactionBefore) ?? null : null), u = /* @__PURE__ */ P(() => (() => {
		let e = /* @__PURE__ */ new Map();
		for (let n of t.call?.toolCallsAfter ?? []) {
			let t = e.get(n.name) ?? {
				count: 0,
				failed: !1
			};
			e.set(n.name, {
				count: t.count + 1,
				failed: t.failed || n.failed
			});
		}
		return [...e.entries()].map(([e, t]) => ({
			name: e,
			...t
		}));
	})()), d = /* @__PURE__ */ P(() => t.call ? lu(t.call.usage) : []), f = /* @__PURE__ */ P(() => t.call?.tokenAnalysis.explanationCodes ?? []), p = /* @__PURE__ */ P(() => jl(t.indexed.analysis)), h = /* @__PURE__ */ P(() => H(f).filter((e) => !H(p).has(e))), g = /* @__PURE__ */ P(() => t.indexed.analysis.session.source === "vscode-copilot" ? t.call?.timing.durationMs != null : !["claude-code", "codex"].includes(t.indexed.analysis.session.source)), _ = /* @__PURE__ */ P(() => t.call?.economics.explanationCodes ?? []), v = /* @__PURE__ */ P(() => Rl(t.indexed.analysis.economics.costBasis, t.indexed.analysis.session.source)), y = /* @__PURE__ */ P(() => t.call?.costAssessment ?? null), b = /* @__PURE__ */ P(() => H(y) ? eu(H(y)) : null), x = /* @__PURE__ */ P(() => Nu(t.indexed.analysis.session.source, H(g))), S = /* @__PURE__ */ P(() => H(y) ? tu(H(y), t.indexed.analysis.session.source) : null), C = /* @__PURE__ */ P(() => t.call?.tokenizationProfileId ? t.indexed.analysis.tokenAnalysis.profiles.find((e) => e.id === t.call?.tokenizationProfileId) ?? null : null), w = /* @__PURE__ */ P(() => t.call ? t.indexed.analysis.modelCalls[t.indexed.analysis.modelCalls.findIndex((e) => e.index === t.call?.index) - 1] ?? null : null), ee = /* @__PURE__ */ P(() => ku(t.indexed, t.call?.addedItemIds ?? [], t.call, "added")), T = /* @__PURE__ */ P(() => ku(t.indexed, t.call?.droppedItemIds ?? [], H(w), "dropped"));
	function E(e) {
		return Ao(t.indexed.itemById.get(e), e);
	}
	function te(e) {
		return e === "anthropic-messages-cache-v1" || e === "github-copilot-messages-cache-v1" || e === "github-copilot-responses-cache-v1" ? "Fresh input" : e === "openai-completions-cache-v1" ? "Uncached input" : e === "openai-responses-cache-read-v1" || e === "openai-codex-responses-cache-read-v1" ? "Non-cache-read input (may include writes)" : "Input (raw normalized bucket)";
	}
	function D() {
		if (!t.call) return "Unknown";
		switch (t.call.economics.cacheWriteStatus) {
			case "reported": return Z(t.call.usage.cacheWrite);
			case "notReported": return "Not separately reported";
			case "notRetainedByPi": return zl(t.indexed.analysis.session.source) ? "Not retained by Pi" : "Not retained by source";
			default: return `Raw normalized value: ${Z(t.call.usage.cacheWrite)}`;
		}
	}
	function O(e) {
		return e === "anthropic-messages-cache-v1" || e === "github-copilot-messages-cache-v1" || e === "github-copilot-responses-cache-v1" ? "Fresh-input share" : e === "openai-completions-cache-v1" ? "Uncached-input share" : "Fresh / uncached input share";
	}
	function k() {
		return t.call && t.call.economics.cacheWriteStatus === "unsupported" ? "Cache write (raw field)" : "Cache write";
	}
	function ne(e) {
		return e === null ? t.call ? t.call.economics.usageCompleteness === "unsupported" ? "Unsupported policy" : t.call.economics.usageCompleteness === "missing" ? "Provider usage missing" : t.call.economics.usageCompleteness === "partial" ? "Provider usage incomplete" : t.call.economics.promptTokens === 0 ? "No prompt tokens" : "Unavailable" : "Unknown" : Va(e);
	}
	function re() {
		return t.call ? t.call.economics.cacheWriteStatus === "notReported" ? "Not separately reported" : t.call.economics.cacheWriteStatus === "notRetainedByPi" ? zl(t.indexed.analysis.session.source) ? "Not retained by Pi" : "Not retained by source" : t.call.economics.cacheWriteStatus === "unsupported" ? "Unsupported policy" : ne(t.call.economics.cacheWriteRatio) : "Unknown";
	}
	function ie() {
		return t.call ? t.call.economics.policyId === "openai-responses-cache-read-v1" || t.call.economics.policyId === "openai-codex-responses-cache-read-v1" ? "Unavailable; writes may be included in non-read input" : ne(t.call.economics.freshRatio) : "Unknown";
	}
	var ae = Br(), oe = R(ae), se = (e) => {
		var p = Ed(), y = L(p), ae = L(y), oe = L(ae), se = z(oe), ce = B(oe, 2), le = z(ce), ue = B(ce, 2), de = (e) => {
			G(e, Ru());
		};
		q(ue, (e) => {
			t.call.retried && e(de);
		}), M(ae), M(y);
		var fe = B(y, 2), pe = L(fe), me = B(L(pe), 2), he = L(me), ge = B(he), _e = (e) => {
			G(e, zu());
		};
		q(ge, (e) => {
			t.call.stopReason === "web-search-aggregate" && e(_e);
		}), M(me), M(pe);
		var A = B(pe, 2);
		J(A, 17, () => H(d), $r, (e, t) => {
			var n = Bu(), r = L(n), i = z(r, !0), a = z(B(r, 2), !0);
			M(n), V(() => {
				K(i, H(t).label), K(a, H(t).value);
			}), G(e, n);
		});
		var ve = B(A, 2), j = B(L(ve), 2), ye = L(j, !0), be = B(ye);
		{
			let e = /* @__PURE__ */ P(() => `${n}-cost`);
			_a(be, {
				get id() {
					return H(e);
				},
				label: "How this cost is worked out",
				children: (e, n) => {
					var r = Hu(), i = L(r), a = z(i, !0), o = B(i, 2), s = (e) => {
						var t = Vu(), n = z(t, !0);
						V(() => K(n, ru)), G(e, t);
					};
					q(o, (e) => {
						t.call.costAssessment.amountHigh !== null && e(s);
					});
					var c = B(o, 2), l = (e) => {
						var t = Vu(), n = z(t);
						V(() => K(n, `Rate: ${H(b) ?? ""}.`)), G(e, t);
					};
					q(c, (e) => {
						H(b) && e(l);
					});
					var u = B(c, 2), d = (e) => {
						var t = Vu(), n = z(t, !0);
						V(() => K(n, H(S))), G(e, t);
					};
					q(u, (e) => {
						H(S) && e(d);
					}), M(r), V((e) => K(a, e), [() => nu(t.call.costAssessment, t.indexed.analysis.session.source)]), G(e, r);
				},
				$$slots: { default: !0 }
			});
		}
		var Se = z(B(be), !0);
		M(j), M(ve);
		var Ce = B(ve, 2), we = (e) => {
			var n = Wu(), r = B(L(n), 2), i = L(r, !0), a = B(i), o = (e) => {
				var n = Uu(), r = z(n);
				V(() => K(r, `Audited policy: ${t.call.economics.usageCompleteness ?? ""}`)), G(e, n);
			};
			q(a, (e) => {
				t.call.economics.usageCompleteness !== t.call.reportedUsageCompleteness && e(o);
			}), M(r), M(n), V(() => K(i, t.call.usage.placeholder ? "Unavailable" : t.call.reportedUsageCompleteness)), G(e, n);
		};
		q(Ce, (e) => {
			(t.call.usage.placeholder || t.call.reportedUsageCompleteness !== "complete" || t.call.economics.usageCompleteness !== t.call.reportedUsageCompleteness) && e(we);
		});
		var Te = B(Ce, 2), Ee = (e) => {
			var r = Gu(), i = R(r), a = B(L(i), 2), o = z(a, !0);
			M(i);
			var s = B(i, 2), c = B(L(s), 2), l = z(c, !0);
			M(s), V((e, t) => {
				Y(a, "title", H(x)), Y(a, "aria-describedby", `${n}-timing`), K(o, e), Y(c, "title", H(x)), Y(c, "aria-describedby", `${n}-timing`), K(l, t);
			}, [() => Pu(t.call.timing.durationMs), () => Fu(t.call.timing.effectiveOutputTokensPerSecond)]), G(e, r);
		}, De = (e) => {
			var t = Ku(), r = B(L(t), 2), i = B(L(r));
			{
				let e = /* @__PURE__ */ P(() => `${n}-timing`);
				_a(i, {
					get id() {
						return H(e);
					},
					label: "Why timing is not recorded",
					children: (e, t) => {
						xe();
						var n = zr();
						V(() => K(n, H(x))), G(e, n);
					},
					$$slots: { default: !0 }
				});
			}
			M(r), M(t), G(e, t);
		};
		q(Te, (e) => {
			H(g) ? e(Ee) : e(De, -1);
		}), M(fe);
		var Oe = B(fe, 2), ke = (e) => {
			var t = qu(), r = z(t, !0);
			V(() => {
				Y(t, "id", `${n}-timing`), K(r, H(x));
			}), G(e, t);
		};
		q(Oe, (e) => {
			H(g) && e(ke);
		});
		var Ae = B(Oe, 2), je = (e) => {
			var i = Zu(), o = L(i), s = z(o), c = B(o, 2);
			let l;
			var u = L(c), d = (e) => {
				var r = Yu(), i = L(r), o = z(i), s = B(i, 4);
				J(s, 21, () => t.call.addedItemIds, $r, (e, t, r) => {
					let i = /* @__PURE__ */ P(() => H(ee).get(H(t)));
					var o = Ju(), s = L(o), c = L(s, !0), l = B(c);
					{
						let e = /* @__PURE__ */ P(() => `${n}-added-${r}`);
						hu(l, {
							get value() {
								return H(i);
							},
							get descriptionId() {
								return H(e);
							}
						});
					}
					M(s), M(o), V((e, t, i) => {
						Y(s, "aria-label", e), Y(s, "aria-describedby", `${n}-added-${r}`), Y(s, "title", t), K(c, i);
					}, [
						() => `Select added item ${E(H(t))}`,
						() => `${E(H(t))} — ${H(i).detail}`,
						() => E(H(t))
					]), U("click", s, () => a()(H(t))), G(e, o);
				}), M(s), M(r), V((e) => K(o, `Added items (${e ?? ""})`), [() => Q(t.call.addedItemIds.length)]), G(e, r);
			};
			q(u, (e) => {
				t.call.addedItemIds.length > 0 && e(d);
			});
			var f = B(u, 2), p = (e) => {
				var r = Xu(), i = L(r), o = z(i), s = B(i, 2), c = L(s), l = (e) => {
					var t = zr();
					V(() => K(t, `Share of estimated dropped tokens · previous call ${H(w).index ?? ""}`)), G(e, t);
				}, u = (e) => {
					G(e, zr("Previous\n                  call unavailable"));
				};
				q(c, (e) => {
					H(w) ? e(l) : e(u, -1);
				}), M(s);
				var d = B(s, 2);
				J(d, 21, () => t.call.droppedItemIds, $r, (e, t, r) => {
					let i = /* @__PURE__ */ P(() => H(T).get(H(t)));
					var o = Ju(), s = L(o), c = L(s, !0), l = B(c);
					{
						let e = /* @__PURE__ */ P(() => `${n}-dropped-${r}`);
						hu(l, {
							get value() {
								return H(i);
							},
							get descriptionId() {
								return H(e);
							}
						});
					}
					M(s), M(o), V((e, t, i) => {
						Y(s, "aria-label", e), Y(s, "aria-describedby", `${n}-dropped-${r}`), Y(s, "title", t), K(c, i);
					}, [
						() => `Select dropped item ${E(H(t))}`,
						() => `${E(H(t))} — ${H(i).detail}`,
						() => E(H(t))
					]), U("click", s, () => a()(H(t))), G(e, o);
				}), M(d), M(r), V((e) => K(o, `Dropped items (${e ?? ""})`), [() => Q(t.call.droppedItemIds.length)]), G(e, r);
			};
			q(f, (e) => {
				t.call.droppedItemIds.length > 0 && e(p);
			}), M(c), M(i), ui(i, (e, t) => Ui?.(e, t), () => ({
				state: r(),
				key: "changes"
			})), V((e, n, r) => {
				K(s, `Context changes · ${e ?? ""} added / ${n ?? ""} retained / ${r ?? ""} dropped`), l = gi(c, 1, "change-lists svelte-1d84xhe", null, l, { single: t.call.addedItemIds.length === 0 || t.call.droppedItemIds.length === 0 });
			}, [
				() => Q(t.call.transitionItemCounts.added),
				() => Q(t.call.transitionItemCounts.retained),
				() => Q(t.call.transitionItemCounts.dropped)
			]), G(e, i);
		}, Me = (e) => {
			var n = Qu(), r = z(n);
			V((e, t, n) => K(r, `Context changes · ${e ?? ""} added / ${t ?? ""} retained / ${n ?? ""} dropped`), [
				() => Q(t.call.transitionItemCounts.added),
				() => Q(t.call.transitionItemCounts.retained),
				() => Q(t.call.transitionItemCounts.dropped)
			]), G(e, n);
		};
		q(Ae, (e) => {
			t.call.addedItemIds.length > 0 || t.call.droppedItemIds.length > 0 ? e(je) : e(Me, -1);
		});
		var Ne = B(Ae, 2), Pe = (e) => {
			var t = Qu(), n = z(t);
			V((e, t) => K(n, `Compaction · ${e ?? ""} removed / ${t ?? ""} retained`), [() => Q(H(l).sourceItemIds.length), () => Q(H(l).retainedItemIds.length)]), G(e, t);
		};
		q(Ne, (e) => {
			H(l) && e(Pe);
		});
		var Fe = B(Ne, 2), N = (e) => {
			var t = ed(), n = B(L(t), 2);
			J(n, 21, () => H(u), $r, (e, t) => {
				var n = $u();
				let r;
				var i = z(n);
				V(() => {
					r = gi(n, 1, "tool-chip svelte-1d84xhe", null, r, { failed: H(t).failed }), K(i, `${H(t).name ?? ""}${H(t).count > 1 ? ` × ${H(t).count}` : ""}${H(t).failed ? " · failed" : ""}`);
				}), G(e, n);
			}), M(n), M(t), G(e, t);
		};
		q(Fe, (e) => {
			H(u).length > 0 && e(N);
		});
		var Ie = B(Fe, 2), Le = B(L(Ie), 2), Re = (e) => {
			let n = /* @__PURE__ */ P(() => t.call.usage.placeholder);
			var r = td(), i = B(R(r), 4), a = L(i);
			J(a, 17, () => [
				["Input", H(n).input],
				["Output", H(n).output],
				["Cache read", H(n).cacheRead],
				["Cache write", H(n).cacheWrite],
				["Cache write 1h", H(n).cacheWrite1h],
				["Reasoning", H(n).reasoning],
				["Total tokens", H(n).totalTokens]
			], $r, (e, t) => {
				var n = /* @__PURE__ */ P(() => m(H(t), 2));
				let r = () => H(n)[0], i = () => H(n)[1];
				var a = Bu(), o = L(a), s = z(o), c = z(B(o, 2), !0);
				M(a), V((e) => {
					K(s, `${r() ?? ""} (raw placeholder)`), K(c, e);
				}, [() => Z(i())]), G(e, a);
			}), J(B(a, 2), 17, () => [
				["Input", H(n).cost?.input],
				["Output", H(n).cost?.output],
				["Cache read", H(n).cost?.cacheRead],
				["Cache write", H(n).cost?.cacheWrite],
				["Total", H(n).cost?.total]
			], $r, (e, t) => {
				var n = /* @__PURE__ */ P(() => m(H(t), 2));
				let r = () => H(n)[0], i = () => H(n)[1];
				var a = Bu(), o = L(a), s = z(o), c = z(B(o, 2), !0);
				M(a), V((e) => {
					K(s, `${r() ?? ""} cost (raw placeholder)`), K(c, e);
				}, [() => za(i())]), G(e, a);
			}), M(i), G(e, r);
		};
		q(Le, (e) => {
			t.call.usage.placeholder && e(Re);
		});
		var ze = B(Le, 2), Be = (e) => {
			G(e, nd());
		};
		q(ze, (e) => {
			t.call.provider === "github-copilot" && e(Be);
		});
		var Ve = B(ze, 2), He = L(Ve), Ue = L(He), We = z(Ue, !0), Ge = z(B(Ue, 2), !0);
		M(He);
		var Ke = B(He, 2), qe = L(Ke), Je = z(qe, !0), Ye = z(B(qe, 2), !0);
		M(Ke);
		var Xe = B(Ke, 2), Ze = L(Xe), Qe = z(Ze, !0), $e = z(B(Ze, 2), !0);
		M(Xe);
		var et = B(Xe, 2), tt = z(B(L(et), 2), !0);
		M(et);
		var nt = B(et, 2), rt = z(B(L(nt), 2), !0);
		M(nt);
		var it = B(nt, 2), at = L(it), ot = z(at, !0), st = z(B(at, 2), !0);
		M(it);
		var ct = B(it, 2), lt = (e) => {
			var n = rd(), r = R(n), i = L(r), a = z(i), o = z(B(i, 2), !0);
			M(r);
			var s = B(r, 2), c = L(s), l = z(c, !0), u = z(B(c, 2), !0);
			M(s);
			var d = B(s, 2), f = z(B(L(d), 2), !0);
			M(d);
			var p = B(d, 2), m = L(p), h = z(m), g = z(B(m, 2), !0);
			M(p);
			var _ = B(p, 2), y = L(_), b = z(y), x = z(B(y, 2), !0);
			M(_);
			var S = B(_, 2), C = L(S), w = z(C), ee = z(B(C, 2), !0);
			M(S);
			var T = B(S, 2), E = L(T), te = z(E), D = z(B(E, 2), !0);
			M(T);
			var O = B(T, 2), k = L(O), ne = z(k, !0), re = z(B(k, 2), !0);
			M(O), V((e, n, r, i, s, c, d) => {
				K(a, `${H(v).label ?? ""} component completeness`), K(o, t.call.economics.costCompleteness), K(l, H(v).promptLabel), K(u, e), K(f, n), K(h, `${H(v).componentPrefix ?? ""} input cost`), K(g, r), K(b, `${H(v).componentPrefix ?? ""} output cost`), K(x, i), K(w, `${H(v).componentPrefix ?? ""} cache-read cost`), K(ee, s), K(te, `${H(v).componentPrefix ?? ""} cache-write cost`), K(D, c), K(ne, H(v).totalLabel), K(re, d);
			}, [
				() => za(t.call.economics.piPromptCost),
				() => Z(t.call.reportedTotalTokens),
				() => za(t.call.cost?.input),
				() => za(t.call.cost?.output),
				() => za(t.call.cost?.cacheRead),
				() => za(t.call.cost?.cacheWrite),
				() => za(t.call.cost?.total)
			]), G(e, n);
		}, ut = /* @__PURE__ */ P(() => ![
			"claude-code",
			"codex",
			"vscode-copilot"
		].includes(t.indexed.analysis.session.source));
		q(ct, (e) => {
			H(ut) && e(lt);
		}), M(Ve);
		var dt = B(Ve, 2), ft = (e) => {
			let n = /* @__PURE__ */ P(() => t.call.economics.cacheRatioDiscontinuity);
			var r = id(), i = L(r), a = z(i, !0), s = B(i, 2), c = L(s), l = B(c), u = (e) => {
				var t = zr();
				V(() => K(t, `Compaction ${H(n).compactionBefore ?? ""} is nearby context.`)), G(e, t);
			};
			q(l, (e) => {
				H(n).compactionBefore && e(u);
			}), M(s);
			var d = B(s, 2), f = z(d);
			M(r), V((e, t, r, i) => {
				K(a, e), K(c, `Adjacent-call change: ${t ?? ""} to
            ${r ?? ""} prompt tokens; change of
            ${i ?? ""} percentage points (${H(n).magnitude ?? ""}). Method:
            ${H(n).method ?? ""}. `), K(f, `Inspect previous call ${H(n).previousCallIndex ?? ""}`);
			}, [
				() => Cu(H(n), t.call.index),
				() => Q(H(n).previousPromptTokens),
				() => Q(H(n).currentPromptTokens),
				() => (H(n).delta * 100).toFixed(1)
			]), U("click", d, () => o()(H(n).previousCallIndex)), G(e, r);
		};
		q(dt, (e) => {
			t.call.economics.cacheRatioDiscontinuity && e(ft);
		});
		var pt = B(dt, 2), mt = (e) => {
			var n = cd(), r = B(R(n), 2);
			J(r, 20, () => H(_), (e) => e, (e, n) => {
				let r = /* @__PURE__ */ P(() => Hl(n, t.indexed.analysis.economics.costBasis, t.indexed.analysis.session.source));
				var i = sd(), a = L(i), o = (e) => {
					var t = ad(), n = R(t), i = z(n, !0), a = B(n);
					V(() => {
						K(i, H(r).title), K(a, ` — ${H(r).impact ?? ""}`);
					}), G(e, t);
				}, s = (e) => {
					var t = od();
					xe(), G(e, t);
				};
				q(a, (e) => {
					H(r) ? e(o) : e(s, -1);
				}), M(i), G(e, i);
			}), M(r), G(e, n);
		};
		q(pt, (e) => {
			H(_).length > 0 && e(mt);
		}), M(Ie), ui(Ie, (e, t) => Ui?.(e, t), () => ({
			state: r(),
			key: "usage"
		}));
		var ht = B(Ie, 2), gt = B(L(ht), 2), _t = L(gt), vt = z(B(L(_t), 2), !0);
		M(_t);
		var yt = B(_t, 2), bt = (e) => {
			var n = ld(), r = R(n), i = z(B(L(r), 2), !0);
			M(r);
			var a = B(r, 2), o = z(B(L(a), 2), !0);
			M(a);
			var s = B(a, 2), c = z(B(L(s), 2));
			M(s), V((e, t, n, r) => {
				K(i, e), K(o, t), K(c, `${n ?? ""} (${r ?? ""})`);
			}, [
				() => Z(t.call.tokenAnalysis.knownFramingOverheadTokens),
				() => Z(t.call.tokenAnalysis.calculatedRequestTokens),
				() => Z(t.call.tokenAnalysis.residualTokens),
				() => Va(t.call.tokenAnalysis.residualPercent)
			]), G(e, n);
		}, xt = (e) => {
			var t = ud(), n = B(L(t), 2), r = L(n), i = B(r), a = (e) => {
				var t = zr();
				V((e) => K(t, `(${e ?? ""} of reported input)`), [() => Va((H(c).reported - H(c).reconstructed) / H(c).reported)]), G(e, t);
			};
			q(i, (e) => {
				H(c).reported > 0 && e(a);
			}), M(n), M(t), V((e) => K(r, `${e ?? ""} tokens `), [() => Z(H(c).reported - H(c).reconstructed)]), G(e, t);
		};
		q(yt, (e) => {
			t.call.tokenAnalysis.calculatedRequestTokens === null ? H(c) && e(xt, 1) : e(bt);
		});
		var St = B(yt, 2), Ct = z(B(L(St), 2), !0);
		M(St);
		var wt = B(St, 2), Tt = z(B(L(wt), 2), !0);
		M(wt);
		var Et = B(wt, 2), Dt = z(B(L(Et), 2), !0);
		M(Et);
		var Ot = B(Et, 2), kt = z(B(L(Ot), 2));
		M(Ot), M(gt);
		var At = B(gt, 2), jt = (e) => {
			var t = fd(), n = B(R(t), 2);
			J(n, 20, () => H(h), (e) => e, (e, t) => {
				let n = /* @__PURE__ */ P(() => Ro(t));
				var r = sd(), i = L(r), a = (e) => {
					var t = ad(), r = R(t), i = z(r, !0), a = B(r);
					V(() => {
						K(i, H(n).title), K(a, ` — ${H(n).impact ?? ""}`);
					}), G(e, t);
				}, o = (e) => {
					var t = dd();
					xe(), G(e, t);
				};
				q(i, (e) => {
					H(n) ? e(a) : e(o, -1);
				}), M(r), G(e, r);
			}), M(n), G(e, t);
		};
		q(At, (e) => {
			H(h).length > 0 && e(jt);
		}), M(ht), ui(ht, (e, t) => Ui?.(e, t), () => ({
			state: r(),
			key: "diagnostics"
		}));
		var Mt = B(ht, 2), Nt = B(L(Mt), 2), Pt = L(Nt), Ft = (e) => {
			var n = pd(), r = R(n), i = z(B(L(r), 2), !0);
			M(r);
			var a = B(r, 2), o = z(B(L(a), 2), !0);
			M(a);
			var s = B(a, 2), c = z(B(L(s), 2), !0);
			M(s), V((e, t, n) => {
				K(i, e), K(o, t), K(c, n);
			}, [
				() => Z(t.call.usage.cacheWrite1h),
				() => cu(t.call.usage.outputReasoningRelationship),
				() => Z(t.call.reportedCompletionTokens)
			]), G(e, n);
		};
		q(Pt, (e) => {
			t.call.usage.placeholder || e(Ft);
		});
		var It = B(Pt, 2), Lt = z(B(L(It), 2), !0);
		M(It);
		var Rt = B(It, 2), zt = z(B(L(Rt), 2), !0);
		M(Rt);
		var Bt = B(Rt, 2), Vt = z(B(L(Bt), 2), !0);
		M(Bt);
		var Ht = B(Bt, 2), Ut = z(B(L(Ht), 2), !0);
		M(Ht);
		var Wt = B(Ht, 2), Gt = z(B(L(Wt), 2));
		M(Wt);
		var Kt = B(Wt, 2), qt = (e) => {
			var n = md(), r = z(B(L(n), 2), !0);
			M(n), V(() => K(r, t.call.tokenAnalysis.status)), G(e, n);
		};
		q(Kt, (e) => {
			t.call.tokenAnalysis.status !== "unavailable" && e(qt);
		});
		var Jt = B(Kt, 2), F = B(L(Jt), 2), Yt = L(F), I = (e) => {
			var t = gd(), n = R(t), r = B(n), i = (e) => {
				var t = hd(), n = z(t, !0);
				V((e) => K(n, e), [() => fa(H(C))]), G(e, t);
			}, a = /* @__PURE__ */ P(() => fa(H(C)));
			q(r, (e) => {
				H(a) && e(i);
			}), V((e) => K(n, `${H(C).provider ?? ""} / ${H(C).model ?? ""} · ${e ?? ""} `), [() => ma(H(C).method)]), G(e, t);
		}, Xt = (e) => {
			var n = zr();
			V(() => K(n, `Tokenizer profile unavailable · ${t.call.tokenizationProfileId ?? ""}`)), G(e, n);
		}, Zt = (e) => {
			G(e, zr("Unavailable"));
		};
		q(Yt, (e) => {
			H(C) ? e(I) : t.call.tokenizationProfileId ? e(Xt, 1) : e(Zt, -1);
		}), M(F), M(Jt);
		var Qt = B(Jt, 2), $t = z(B(L(Qt), 2));
		M(Qt);
		var en = B(Qt, 2), tn = z(B(L(en), 2));
		M(en), M(Nt), M(Mt), ui(Mt, (e, t) => Ui?.(e, t), () => ({
			state: r(),
			key: "estimator"
		}));
		var nn = B(Mt, 2), rn = B(L(nn), 2), an = L(rn), on = B(L(an), 2), sn = L(on), cn = z(sn, !0);
		Ya(B(sn, 2), {
			get value() {
				return t.call.sourceRecordId;
			},
			label: "source record ID"
		}), M(on), M(an);
		var ln = B(an, 2), un = (e) => {
			var n = _d(), r = B(L(n), 2), i = L(r), a = z(i, !0);
			Ya(B(i, 2), {
				get value() {
					return t.call.tokenizationProfileId;
				},
				label: "tokenization profile ID"
			}), M(r), M(n), V(() => K(a, t.call.tokenizationProfileId)), G(e, n);
		};
		q(ln, (e) => {
			t.call.tokenizationProfileId && e(un);
		});
		var dn = B(ln, 2), fn = (e) => {
			var n = vd(), r = B(L(n), 2), i = L(r), a = z(i, !0);
			Ya(B(i, 2), {
				get value() {
					return t.call.economics.policyId;
				},
				label: "economics policy ID"
			}), M(r), M(n), V(() => K(a, t.call.economics.policyId)), G(e, n);
		};
		q(dn, (e) => {
			t.call.economics.policyId && e(fn);
		}), M(rn);
		var pn = B(rn, 2), mn = L(pn), hn = z(B(L(mn), 2), !0);
		M(mn);
		var gn = B(mn, 2), _n = (e) => {
			var t = yd(), n = R(t), r = z(B(L(n), 2));
			M(n);
			var i = B(n, 2), a = B(L(i), 2), o = z(L(a), !0);
			M(a), M(i), V((e, t) => {
				K(r, `${e ?? ""} removed ·
              ${t ?? ""} retained`), K(o, H(l).id);
			}, [() => Q(H(l).sourceItemIds.length), () => Q(H(l).retainedItemIds.length)]), G(e, t);
		};
		q(gn, (e) => {
			H(l) && e(_n);
		}), M(pn);
		var vn = B(pn, 2), yn = (e) => {
			var n = Sd(), r = B(R(n), 2);
			J(r, 21, () => t.call.toolCallsAfter, (e) => e.id, (e, t) => {
				var n = xd(), r = L(n), i = B(r), a = z(i, !0), o = B(i, 2);
				{
					let e = /* @__PURE__ */ P(() => `${H(t).name} tool-call ID`);
					Ya(o, {
						get value() {
							return H(t).id;
						},
						get label() {
							return H(e);
						}
					});
				}
				var s = B(o, 2), c = (e) => {
					G(e, bd());
				};
				q(s, (e) => {
					H(t).failed && e(c);
				}), M(n), V(() => {
					K(r, `${H(t).name ?? ""} `), K(a, H(t).id);
				}), G(e, n);
			}), M(r), G(e, n);
		};
		q(vn, (e) => {
			H(u).length > 0 && e(yn);
		});
		var bn = B(vn, 2), xn = (e) => {
			var t = wd(), n = B(R(t), 2);
			J(n, 20, () => H(f), (e) => e, (e, t) => {
				var n = Cd(), r = z(L(n), !0);
				M(n), V(() => K(r, t)), G(e, n);
			}), M(n), G(e, t);
		};
		q(bn, (e) => {
			H(f).length > 0 && e(xn);
		});
		var Sn = B(bn, 2), Cn = (e) => {
			var t = Td(), n = B(R(t), 2);
			J(n, 20, () => H(_), (e) => e, (e, t) => {
				var n = Cd(), r = z(L(n), !0);
				M(n), V(() => K(r, t)), G(e, n);
			}), M(n), G(e, t);
		};
		q(Sn, (e) => {
			H(_).length > 0 && e(Cn);
		}), M(nn), ui(nn, (e, t) => Ui?.(e, t), () => ({
			state: r(),
			key: "identifiers"
		})), M(p), V((e, r, a, o, s, c, l, u, d, f, m, h, g, _, v, y, b, x, S, C, w, ee, T, E, te, D, O, k) => {
			Y(p, "aria-label", `${i() ? "Pinned" : "Model"} call ${t.call.index}`), K(se, `${i() ? "Pinned call" : "Call"}
          ${t.call.index ?? ""}`), K(le, `${t.call.provider ?? "Unknown provider" ?? ""} / ${t.call.model ?? "Unknown model" ?? ""}`), K(he, `${e ?? ""} `), Y(j, "aria-describedby", `${n}-cost`), K(ye, r), K(Se, a), K(We, o), K(Ge, s), K(Je, t.call.economics.policyId ? "Cache read" : "Cache read (raw field)"), K(Ye, c), K(Qe, l), K($e, u), K(tt, d), K(rt, f), K(ot, m), K(st, h), K(vt, g), K(Ct, _), K(Tt, v), K(Dt, y), K(kt, `${b ?? ""} /
            ${x ?? ""} calls`), K(Lt, S), K(zt, C), K(Vt, w), K(Ut, t.call.cumulativeReportedUsageCompleteness), K(Gt, `${ee ?? ""}
            items complete · ${T ?? ""} partial
            · ${E ?? ""} unavailable`), K($t, `${te ?? ""} calls`), K(tn, `${D ?? ""} /
            ${O ?? ""} /
            ${k ?? ""}`), K(cn, t.call.sourceRecordId), K(hn, t.call.stopReason ?? "Unknown");
		}, [
			() => t.call.usage.placeholder ? "Unavailable" : Z(t.call.reportedPromptTokens),
			() => t.call.usage.placeholder ? "Unavailable" : Xl(t.call.costAssessment),
			() => Jl(t.call.costAssessment, t.indexed.analysis.session.source),
			() => te(t.call.economics.policyId),
			() => Z(t.call.usage.input),
			() => Z(t.call.usage.cacheRead),
			() => k(),
			() => D(),
			() => ne(t.call.economics.cacheReadRatio),
			() => re(),
			() => O(t.call.economics.policyId),
			() => ie(),
			() => Z(t.call.tokenAnalysis.calculatedVisibleTokens),
			() => Lu(t.call.tokenAnalysis.addedTokens, Z, H(s)),
			() => Lu(t.call.tokenAnalysis.retainedTokens, Z, H(s)),
			() => Lu(t.call.tokenAnalysis.droppedTokens, Z, H(s)),
			() => Z(t.call.tokenAnalysis.age.oldestLiveItemAgeCalls),
			() => Z(t.call.tokenAnalysis.age.medianLiveItemAgeCalls),
			() => Z(t.call.cumulativeReportedPromptTokens),
			() => Z(t.call.cumulativeReportedCompletionTokens),
			() => Z(t.call.cumulativeReportedReasoningTokens),
			() => Ka(t.call.tokenAnalysis.estimateCoverage.completeItems, t.call.tokenAnalysis.estimateCoverage.totalItems),
			() => Q(t.call.tokenAnalysis.estimateCoverage.partialItems),
			() => Q(t.call.tokenAnalysis.estimateCoverage.unavailableItems),
			() => Lu(t.call.tokenAnalysis.age.tokenWeightedMeanAgeCalls, Z, H(s)),
			() => Q(t.call.tokenAnalysis.age.itemsAtLeast5CallsOld),
			() => Q(t.call.tokenAnalysis.age.itemsAtLeast10CallsOld),
			() => Q(t.call.tokenAnalysis.age.itemsAtLeast20CallsOld)
		]), G(e, p);
	};
	q(oe, (e) => {
		t.call && e(se);
	}), G(e, ae), Ve();
}
kr(["click"]);
//#endregion
//#region src/lib/session-links.ts
function kd(e) {
	return e.metadata.childSession || null;
}
function Ad(e, t = null) {
	let n = new URLSearchParams({ session: e });
	return t !== null && n.set("child", t), `#${n}`;
}
function jd(e, t) {
	return e.filter((e) => e.parentReference === t);
}
//#endregion
//#region src/lib/components/ItemDetails.svelte
var Md = /* @__PURE__ */ W("<p class=\"presence-note svelte-bb734v\">This item has no model-call presence, so it has no location to reveal in Context River.</p>"), Nd = /* @__PURE__ */ W("<p class=\"presence-note svelte-bb734v\"> </p>"), Pd = /* @__PURE__ */ W("<button type=\"button\">Reveal in River</button>"), Fd = /* @__PURE__ */ W("<button type=\"button\"> </button>"), Id = /* @__PURE__ */ W("<p class=\"preview-note svelte-bb734v\">Expanded preview truncated.</p>"), Ld = /* @__PURE__ */ W("<pre class=\"svelte-bb734v\"> </pre> <!>", 1), Rd = /* @__PURE__ */ W("<p class=\"content-preview svelte-bb734v\"><b>Content preview</b> </p>"), zd = /* @__PURE__ */ W("<p class=\"preview-note svelte-bb734v\">No content preview is available.</p>"), Bd = /* @__PURE__ */ W("<button type=\"button\" class=\"preview-toggle svelte-bb734v\"> </button>"), Vd = /* @__PURE__ */ W("<small class=\"svelte-bb734v\">Latest actual presence; not a newly pinned call.</small>"), Hd = /* @__PURE__ */ W("<small class=\"svelte-bb734v\"> </small>"), Ud = /* @__PURE__ */ W("<small class=\"svelte-bb734v\">Includes partial, heuristic or unavailable profile estimates.</small>"), Wd = /* @__PURE__ */ W("Started <a class=\"svelte-bb734v\"> </a>", 1), Gd = /* @__PURE__ */ W("<h4 class=\"svelte-bb734v\">Child session</h4> <p class=\"svelte-bb734v\"><!></p>", 1), Kd = /* @__PURE__ */ W("<p class=\"svelte-bb734v\"> </p>"), qd = /* @__PURE__ */ W("<h4 class=\"svelte-bb734v\">Compaction</h4> <!> <!> <!>", 1), Jd = /* @__PURE__ */ W("<b class=\"svelte-bb734v\"> </b>"), Yd = /* @__PURE__ */ W("<li class=\"svelte-bb734v\"><!> <!></li>"), Xd = /* @__PURE__ */ W("<h4 class=\"svelte-bb734v\">Versions</h4> <ol class=\"versions svelte-bb734v\"></ol>", 1), Zd = /* @__PURE__ */ W("<button type=\"button\" class=\"svelte-bb734v\"> </button>"), Qd = /* @__PURE__ */ W("<div class=\"relations svelte-bb734v\"><span class=\"svelte-bb734v\">Predecessors</span> <!></div>"), $d = /* @__PURE__ */ W("<div class=\"relations svelte-bb734v\"><span class=\"svelte-bb734v\">Successors</span> <!></div>"), ef = /* @__PURE__ */ W("<div class=\"lineage-actions svelte-bb734v\"><b>Lineage actions</b> <!> <!></div>"), tf = /* @__PURE__ */ W("<small class=\"metric-note\"> </small>"), nf = /* @__PURE__ */ W(" <!>", 1), rf = /* @__PURE__ */ W("<div><dt class=\"svelte-bb734v\">Selected estimate method</dt> <dd class=\"svelte-bb734v\"> </dd></div> <div><dt class=\"svelte-bb734v\">Selected estimate coverage</dt> <dd class=\"svelte-bb734v\"> </dd></div>", 1), af = /* @__PURE__ */ W("<p class=\"svelte-bb734v\">Unavailable</p>"), of = /* @__PURE__ */ W("<li><b> </b> </li>"), sf = /* @__PURE__ */ W("<ul class=\"svelte-bb734v\"></ul>"), cf = /* @__PURE__ */ W("<b> </b> ", 1), lf = /* @__PURE__ */ W("<b>Unrecognized diagnostic</b> — see the raw code in Technical identifiers.", 1), uf = /* @__PURE__ */ W("<li><!></li>"), df = /* @__PURE__ */ W("<h4 class=\"svelte-bb734v\">Diagnostic explanations</h4> <ul class=\"diagnostics svelte-bb734v\"></ul>", 1), ff = /* @__PURE__ */ W("<div><dt class=\"svelte-bb734v\">Estimate profile ID</dt> <dd class=\"svelte-bb734v\"><code class=\"svelte-bb734v\"> </code> <!></dd></div>"), pf = /* @__PURE__ */ W("<div><dt class=\"svelte-bb734v\">Source record ID</dt> <dd class=\"svelte-bb734v\"><code class=\"svelte-bb734v\"> </code> <!></dd></div>"), mf = /* @__PURE__ */ W("<div><dt class=\"svelte-bb734v\">Source tool-call ID</dt> <dd class=\"svelte-bb734v\"><code class=\"svelte-bb734v\"> </code> <!></dd></div>"), hf = /* @__PURE__ */ W("<h4 class=\"svelte-bb734v\">Source metadata</h4> <ul class=\"svelte-bb734v\"></ul>", 1), gf = /* @__PURE__ */ W("<li><code class=\"svelte-bb734v\"> </code></li>"), _f = /* @__PURE__ */ W("<h4 class=\"svelte-bb734v\">Raw diagnostic codes</h4> <ul class=\"svelte-bb734v\"></ul>", 1), vf = /* @__PURE__ */ W("<header class=\"item-identity svelte-bb734v\"><div class=\"svelte-bb734v\"><span class=\"svelte-bb734v\"> </span> <h3 id=\"selected-item-summary\" class=\"selected-item-summary svelte-bb734v\" tabindex=\"-1\"> </h3></div></header> <!> <!> <!> <!> <details class=\"svelte-bb734v\"><summary class=\"svelte-bb734v\">Content preview</summary> <div class=\"preview-details svelte-bb734v\"><!> <!></div></details> <dl class=\"essential-metrics svelte-bb734v\"><div><dt class=\"svelte-bb734v\">Lifetime</dt> <dd class=\"svelte-bb734v\"><!></dd></div> <div><dt class=\"svelte-bb734v\"><!></dt> <dd class=\"svelte-bb734v\"> <!></dd></div> <div><dt class=\"svelte-bb734v\">Whole-session exposure<!></dt> <dd class=\"svelte-bb734v\"> <!> <!></dd></div></dl> <!> <!> <!> <!> <details class=\"item-diagnostics svelte-bb734v\"><summary class=\"svelte-bb734v\">Diagnostics</summary> <dl class=\"detail-rows svelte-bb734v\"><div><dt class=\"svelte-bb734v\">Estimate basis</dt> <dd class=\"svelte-bb734v\"><!> </dd></div> <div><dt class=\"svelte-bb734v\">Token coverage</dt> <dd class=\"svelte-bb734v\"> </dd></div> <div><dt class=\"svelte-bb734v\">Serialized diagnostic size</dt> <dd class=\"svelte-bb734v\"> </dd></div> <!></dl> <h4 class=\"svelte-bb734v\">Profile estimates</h4> <!> <!></details> <details class=\"technical-identifiers svelte-bb734v\"><summary class=\"svelte-bb734v\">Technical identifiers</summary> <dl class=\"identifier-list svelte-bb734v\"><!> <div><dt class=\"svelte-bb734v\">Context ID</dt> <dd class=\"svelte-bb734v\"><code class=\"svelte-bb734v\"> </code><!></dd></div> <!> <!></dl> <!> <!></details>", 1), yf = /* @__PURE__ */ W("<p class=\"svelte-bb734v\">Select an item to inspect its context.</p>"), bf = /* @__PURE__ */ W("<section class=\"item-details svelte-bb734v\" aria-live=\"polite\"><!></section>"), xf = {
	hash: "svelte-bb734v",
	code: ".item-details.svelte-bb734v {color:var(--text);min-width:0;}.item-identity.svelte-bb734v {position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:4px 0 7px;background:var(--surface);}.item-identity.svelte-bb734v > div:where(.svelte-bb734v) {display:grid;min-width:0;gap:5px;}.item-identity.svelte-bb734v span:where(.svelte-bb734v) {display:inline-block;color:var(--text);border:1px solid var(--separator);border-radius:999px;padding:2px 7px;font-size:var(--text-sm);}h3.svelte-bb734v {color:var(--text-strong);font-size:var(--text-lg);margin:0 0 6px;overflow-wrap:anywhere;}h3.svelte-bb734v:focus {outline:2px solid var(--accent);outline-offset:2px;}a.svelte-bb734v {color:var(--accent);}h4.svelte-bb734v {margin:11px 0 4px;color:var(--text);font-size:var(--text-sm);}.content-preview.svelte-bb734v {color:var(--text);white-space:pre-wrap;overflow-wrap:anywhere;}.preview-note.svelte-bb734v,\n  .presence-note.svelte-bb734v {color:var(--secondary);font-size:var(--text-sm);}details.svelte-bb734v {margin-top:10px;}summary.svelte-bb734v {color:var(--text);cursor:pointer;}.preview-toggle.svelte-bb734v {display:block;width:fit-content;margin:7px 0 0 auto;min-height:28px;padding:4px 8px;font-size:var(--text-xs);color:var(--secondary);background:transparent;border:1px solid transparent;}.preview-toggle.svelte-bb734v:hover {text-decoration:underline;background:var(--plot);}.preview-details.svelte-bb734v pre:where(.svelte-bb734v) {color:var(--text);background:var(--plot);border-radius:var(--control-radius);margin:7px 0 0;padding:8px;white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;}.essential-metrics.svelte-bb734v,\n  .detail-rows.svelte-bb734v {display:grid;grid-template-columns:minmax(0, 1fr);gap:7px 14px;margin:10px 0 0;}dt.svelte-bb734v {color:var(--secondary);font-size:var(--text-sm);}dd.svelte-bb734v {margin:1px 0 0;overflow-wrap:anywhere;color:var(--text);}.essential-metrics.svelte-bb734v dd:where(.svelte-bb734v) small:where(.svelte-bb734v) {display:block;margin-top:2px;color:var(--secondary);font-size:var(--text-sm);}.versions.svelte-bb734v {display:grid;gap:6px;margin:0;padding:0;list-style:none;font-size:var(--text-sm);}.versions.svelte-bb734v li:where(.svelte-bb734v) {display:grid;justify-items:start;gap:2px;}.versions.svelte-bb734v b:where(.svelte-bb734v) {font-weight:600;}.versions.svelte-bb734v small:where(.svelte-bb734v) {color:var(--secondary);overflow-wrap:anywhere;}.lineage-actions.svelte-bb734v {display:grid;gap:7px;margin-top:10px;}.relations.svelte-bb734v {display:flex;flex-wrap:wrap;align-items:center;gap:5px;}.relations.svelte-bb734v span:where(.svelte-bb734v) {color:var(--secondary);font-size:var(--text-sm);}.relations.svelte-bb734v button:where(.svelte-bb734v) {max-width:100%;overflow-wrap:anywhere;text-align:left;}.diagnostics.svelte-bb734v,\n  .item-diagnostics.svelte-bb734v ul:where(.svelte-bb734v),\n  .technical-identifiers.svelte-bb734v ul:where(.svelte-bb734v) {margin:4px 0 0;padding-left:18px;overflow-wrap:anywhere;font-size:var(--text-sm);}.identifier-list.svelte-bb734v {display:grid;gap:7px;margin:8px 0 0;}.identifier-list.svelte-bb734v dd:where(.svelte-bb734v) {display:grid;justify-items:start;gap:4px;}code.svelte-bb734v {color:var(--secondary);overflow-wrap:anywhere;user-select:all;}.technical-identifiers.svelte-bb734v code:where(.svelte-bb734v) {display:block;}p.svelte-bb734v {margin:8px 0 0;}\n  @container highwater (max-width: 520px) {.essential-metrics.svelte-bb734v,\n    .detail-rows.svelte-bb734v {grid-template-columns:1fr;}\n  }"
};
function Sf(e, t) {
	Be(t, !0), li(e, xf);
	let n = X(t, "sections", 23, Hi), r = X(t, "onInspectCall", 3, () => {}), i = X(t, "callIndex", 3, null), a = X(t, "pinnedCallIndex", 3, null), o = X(t, "onSelectItem", 3, () => {}), s = X(t, "onRevealInRiver", 3, () => {}), c = X(t, "sessions", 19, () => []), l = /* @__PURE__ */ P(() => t.item ? kd(t.item) : null), u = /* @__PURE__ */ P(() => H(l) ? c().find((e) => e.id === H(l)) : void 0), d = /* @__PURE__ */ P(() => t.item ? t.indexed.compactionBySourceId.get(t.item.id) ?? [] : []), f = /* @__PURE__ */ P(() => t.item ? t.indexed.compactionBySummaryId.get(t.item.id) ?? null : null), p = /* @__PURE__ */ P(() => t.item ? t.indexed.compactionsByRetainedId.get(t.item.id) ?? [] : []), h = /* @__PURE__ */ P(() => t.item ? (t.indexed.incomingLineage.get(t.item.id) ?? []).map((e) => e.from) : []), g = /* @__PURE__ */ P(() => t.item ? (t.indexed.outgoingLineage.get(t.item.id) ?? []).map((e) => e.to) : []), _ = /* @__PURE__ */ P(() => t.item ? t.indexed.versionByItemId.get(t.item.id) ?? null : null), v = /* @__PURE__ */ P(() => t.item && H(_) ? hc(t.indexed.itemById, t.indexed.versionByItemId, t.item.id) : []), y = /* @__PURE__ */ P(() => t.indexed.analysis.modelCalls.length), b = /* @__PURE__ */ P(() => i() === null ? null : t.indexed.callByIndex.get(i()) ?? null), x = /* @__PURE__ */ P(() => a() === null ? null : t.indexed.callByIndex.get(a()) ?? null), S = /* @__PURE__ */ P(() => t.item !== null && H(x) !== null && !H(x).contextItemIds.includes(t.item.id)), C = /* @__PURE__ */ P(() => t.item?.presence.length ? t.indexed.callByIndex.get(t.item.presence[0].startCall) ?? null : null), w = /* @__PURE__ */ P(() => t.item && t.item.presence.length > 0 ? t.indexed.callByIndex.get(t.item.lastModelCall) ?? null : null), ee = /* @__PURE__ */ P(() => H(b) && H(b).contextItemIds.includes(t.item?.id ?? "") ? H(b) : a() === null ? H(w) : null), T = /* @__PURE__ */ P(() => H(b) === null && H(ee) !== null), E = /* @__PURE__ */ P(() => t.item && H(ee) ? t.item.tokenEstimates.find((e) => e.profileId === H(ee)?.tokenizationProfileId) : void 0), te = /* @__PURE__ */ P(() => H(E) ? t.indexed.analysis.tokenAnalysis.profiles.find((e) => e.id === H(E).profileId) ?? null : null), D = /* @__PURE__ */ P(() => n().expandedPreview);
	function O() {
		I(D, !H(D)), n().expandedPreview = H(D);
	}
	let k = /* @__PURE__ */ P(() => t.item?.preview !== null && t.item?.preview !== void 0 && (t.item.preview.expandedText !== t.item.preview.text || t.item.preview.expandedTruncated)), ne = /* @__PURE__ */ P(() => [...new Set(t.item?.tokenEstimates.flatMap((e) => e.noteCodes) ?? [])]);
	function re(e) {
		return Ao(t.indexed.itemById.get(e), e);
	}
	function ie(e) {
		let n = t.indexed.callByIndex.get(e.firstModelCall)?.tokenizationProfileId ?? "";
		return t.indexed.itemEstimateByProfile.get(e.id)?.get(n)?.tokens ?? null;
	}
	function ae(e, t) {
		return `Version ${t} · ${oe(e)} · ${Z(ie(e))} tokens`;
	}
	function oe(e) {
		return e.presence.map((e) => e.startCall === e.endCall ? `call ${e.startCall}` : `calls ${e.startCall}–${e.endCall}`).join(", ");
	}
	function se() {
		return !t.item || t.item.presence.length === 0 ? "No model-call presence" : t.item.presence.map((e) => e.startCall === e.endCall ? `call ${e.startCall}` : `calls ${e.startCall}–${e.endCall}`).join(", ");
	}
	var ce = bf(), le = L(ce), ue = (e) => {
		var i = vf(), c = R(i), b = L(c), w = L(b), ie = z(w), oe = z(B(w, 2), !0);
		M(b), M(c);
		var ce = B(c, 2), le = (e) => {
			G(e, Md());
		}, ue = (e) => {
			var t = Nd(), n = z(t);
			V(() => K(n, `This item is not present at pinned call ${H(x).index ?? ""}. Its inspector remains selected.`)), G(e, t);
		};
		q(ce, (e) => {
			t.item.presence.length === 0 ? e(le) : H(S) && H(x) && e(ue, 1);
		});
		var de = B(ce, 2), fe = (e) => {
			var n = Pd();
			U("click", n, () => s()(t.item.id)), G(e, n);
		};
		q(de, (e) => {
			t.item.presence.length > 0 && e(fe);
		});
		var pe = B(de, 2), me = (e) => {
			var t = Fd(), n = z(t);
			V(() => K(n, `Inspect first included call · ${H(C).index ?? ""}`)), U("click", t, () => r()(H(C).index)), G(e, t);
		};
		q(pe, (e) => {
			H(C) && H(C).index !== a() && e(me);
		});
		var he = B(pe, 2), ge = (e) => {
			var t = Nd(), n = z(t);
			V((e) => K(n, `Estimate: ${H(E).coverage ?? ""} · ${e ?? ""}`), [() => ma(H(E).method)]), G(e, t);
		};
		q(he, (e) => {
			H(E) && (H(E).coverage !== "complete" || H(E).method === "characterHeuristic") && e(ge);
		});
		var _e = B(he, 2), A = B(L(_e), 2), ve = L(A), j = (e) => {
			var n = Ld(), r = R(n), i = z(r, !0), a = B(r, 2), o = (e) => {
				G(e, Id());
			};
			q(a, (e) => {
				t.item.preview.expandedTruncated && e(o);
			}), V(() => K(i, t.item.preview.expandedText)), G(e, n);
		}, ye = (e) => {
			var n = Br(), r = R(n), i = (e) => {
				var n = Rd(), r = B(L(n));
				M(n), V(() => K(r, ` ${t.item.preview.text ?? ""}`)), G(e, n);
			}, a = (e) => {
				G(e, zd());
			};
			q(r, (e) => {
				t.item.preview?.text ? e(i) : e(a, -1);
			}), G(e, n);
		};
		q(ve, (e) => {
			H(k) && H(D) && t.item.preview ? e(j) : e(ye, -1);
		});
		var be = B(ve, 2), Se = (e) => {
			var t = Bd(), n = z(t, !0);
			V(() => {
				Y(t, "aria-expanded", H(D)), K(n, H(D) ? "Show less" : "Show more");
			}), U("click", t, O), G(e, t);
		};
		q(be, (e) => {
			H(k) && e(Se);
		}), M(A), M(_e), ui(_e, (e, t) => Ui?.(e, t), () => ({
			state: n(),
			key: "preview"
		}));
		var Ce = B(_e, 2), we = L(Ce), Te = B(L(we), 2), Ee = L(Te), De = (e) => {
			G(e, zr("No model-call presence"));
		}, Oe = (e) => {
			var n = zr();
			V((e, t, r, i) => K(n, `${e ?? ""} · present in ${t ?? ""} of ${r ?? ""} calls (${i ?? ""} ranges)`), [
				() => se(),
				() => Z(tc(t.item)),
				() => Z(H(y)),
				() => Z(t.item.presence.length)
			]), G(e, n);
		};
		q(Ee, (e) => {
			t.item.presence.length === 0 ? e(De) : e(Oe, -1);
		}), M(Te), M(we);
		var ke = B(we, 2), Ae = L(ke), je = L(Ae), Me = (e) => {
			var t = zr();
			V(() => K(t, a() === null ? H(T) ? "Tokens at last included call" : "Tokens at call" : "Tokens at pinned call")), G(e, t);
		}, Ne = (e) => {
			G(e, zr("Tokens at pinned call · unavailable"));
		}, Pe = (e) => {
			G(e, zr("Tokens at last included call · unavailable"));
		};
		q(je, (e) => {
			H(ee) && H(E) ? e(Me) : a() === null ? e(Pe, -1) : e(Ne, 1);
		}), M(Ae);
		var Fe = B(Ae, 2), N = L(Fe), Ie = B(N), Le = (e) => {
			G(e, Vd());
		};
		q(Ie, (e) => {
			H(T) && e(Le);
		}), M(Fe), M(ke);
		var Re = B(ke, 2), ze = L(Re), Be = B(L(ze));
		{
			let e = /* @__PURE__ */ P(() => `item-exposure-note-${t.item.id}`);
			_a(Be, {
				get id() {
					return H(e);
				},
				label: "About whole-session exposure",
				children: (e, t) => {
					xe(), G(e, zr("The item's estimated tokens added up over every call it appears in, in estimated\n            token-turns. It shows how much context the item took up across the session; it is not\n            usage or cost."));
				},
				$$slots: { default: !0 }
			});
		}
		M(ze);
		var Ve = B(ze, 2), He = L(Ve), Ue = B(He), We = (e) => {
			var n = Hd(), r = z(n);
			V((e) => K(r, `Partial exposure · ${e ?? ""} calls covered`), [() => Ka(t.item.tokenTurnsCoverage.coveredCalls, t.item.tokenTurnsCoverage.totalCalls)]), G(e, n);
		};
		q(Ue, (e) => {
			t.item.tokenTurnsCoverage.coveredCalls < t.item.tokenTurnsCoverage.totalCalls && e(We);
		});
		var Ge = B(Ue, 2), Ke = (e) => {
			G(e, Ud());
		}, qe = /* @__PURE__ */ P(() => t.item.tokenEstimates.some((e) => e.coverage !== "complete" || e.method === "characterHeuristic"));
		q(Ge, (e) => {
			H(qe) && e(Ke);
		}), M(Ve), M(Re), M(Ce);
		var Je = B(Ce, 2), Ye = (e) => {
			var t = Gd(), n = B(R(t), 2), r = L(n), i = (e) => {
				var t = Wd(), n = B(R(t)), r = z(n, !0);
				V((e) => {
					Y(n, "href", e), K(r, H(u).displayName);
				}, [() => Ad(H(u).id)]), G(e, t);
			}, a = (e) => {
				G(e, zr("Started a child session that is not listed."));
			};
			q(r, (e) => {
				H(u) ? e(i) : e(a, -1);
			}), M(n), G(e, t);
		};
		q(Je, (e) => {
			H(l) && e(Ye);
		});
		var Xe = B(Je, 2), Ze = (e) => {
			var t = qd(), n = B(R(t), 2), r = (e) => {
				var t = Kd(), n = z(t);
				V((e) => K(n, `Removed at the compaction before call ${e ?? ""}.`), [() => H(d).map((e) => e.beforeModelCall).join(", ")]), G(e, t);
			};
			q(n, (e) => {
				H(d).length > 0 && e(r);
			});
			var i = B(n, 2), a = (e) => {
				var t = Kd(), n = z(t);
				V((e) => K(n, `Retained unchanged through compaction before call ${e ?? ""}.`), [() => H(p).map((e) => e.beforeModelCall).join(", ")]), G(e, t);
			};
			q(i, (e) => {
				H(p).length > 0 && e(a);
			});
			var o = B(i, 2), s = (e) => {
				var t = Kd(), n = z(t);
				V((e) => K(n, `Replaces ${e ?? ""} items removed at the compaction
          before call ${H(f).beforeModelCall ?? ""}.`), [() => Z(H(f).sourceItemIds.length)]), G(e, t);
			};
			q(o, (e) => {
				H(f) && e(s);
			}), G(e, t);
		};
		q(Xe, (e) => {
			(H(d).length > 0 || H(p).length > 0 || H(f)) && e(Ze);
		});
		var Qe = B(Xe, 2), $e = (e) => {
			var n = Xd(), r = B(R(n), 2);
			J(r, 23, () => H(v), (e) => e.id, (e, n, r) => {
				var i = Yd(), a = L(i), s = (e) => {
					var t = Jd(), i = z(t);
					V((e) => K(i, `${e ?? ""} · this version`), [() => ae(H(n), H(r) + 1)]), G(e, t);
				}, c = (e) => {
					var t = Fd(), i = z(t, !0);
					V((e) => K(i, e), [() => ae(H(n), H(r) + 1)]), U("click", t, () => o()(H(n).id)), G(e, t);
				};
				q(a, (e) => {
					H(n).id === t.item.id ? e(s) : e(c, -1);
				});
				var l = B(a, 2), u = (e) => {
					var r = Hd(), i = z(r);
					V((e) => K(i, `Call ${H(n).firstModelCall ?? ""}: ${e ?? ""}`), [() => _c(t.indexed.analysis.contextItems, t.indexed.versionByItemId, H(n).firstModelCall)]), G(e, r);
				};
				q(l, (e) => {
					H(r) > 0 && t.item.kind === "system" && e(u);
				}), M(i), G(e, i);
			}), M(r), G(e, n);
		};
		q(Qe, (e) => {
			H(_) && e($e);
		});
		var et = B(Qe, 2), tt = (e) => {
			var t = ef(), n = B(L(t), 2), r = (e) => {
				var t = Qd();
				J(B(L(t), 2), 17, () => H(h), $r, (e, t) => {
					var n = Zd(), r = z(n, !0);
					V((e, t) => {
						Y(n, "aria-label", e), K(r, t);
					}, [() => `Select predecessor ${re(H(t))}`, () => re(H(t))]), U("click", n, () => o()(H(t))), G(e, n);
				}), M(t), G(e, t);
			};
			q(n, (e) => {
				H(h).length > 0 && e(r);
			});
			var i = B(n, 2), a = (e) => {
				var t = $d();
				J(B(L(t), 2), 17, () => H(g), $r, (e, t) => {
					var n = Zd(), r = z(n, !0);
					V((e, t) => {
						Y(n, "aria-label", e), K(r, t);
					}, [() => `Select successor ${re(H(t))}`, () => re(H(t))]), U("click", n, () => o()(H(t))), G(e, n);
				}), M(t), G(e, t);
			};
			q(i, (e) => {
				H(g).length > 0 && e(a);
			}), M(t), G(e, t);
		};
		q(et, (e) => {
			(H(h).length > 0 || H(g).length > 0) && e(tt);
		});
		var nt = B(et, 2), rt = B(L(nt), 2), it = L(rt), at = B(L(it), 2), ot = L(at), st = (e) => {
			var t = nf(), n = R(t), r = B(n), i = (e) => {
				var t = tf(), n = z(t, !0);
				V((e) => K(n, e), [() => fa(H(te))]), G(e, t);
			}, a = /* @__PURE__ */ P(() => fa(H(te)));
			q(r, (e) => {
				H(a) && e(i);
			}), V((e) => K(n, `${e ?? ""} · call ${H(ee).index ?? ""} `), [() => H(te) ? `${H(te).provider} / ${H(te).model} · ${ma(H(E).method)}` : ma(H(E).method)]), G(e, t);
		}, ct = (e) => {
			var t = zr();
			V(() => K(t, `No applicable estimate at pinned call ${a() ?? ""}`)), G(e, t);
		}, lt = (e) => {
			G(e, zr("No applicable model-call estimate"));
		};
		q(ot, (e) => {
			H(ee) && H(E) ? e(st) : a() === null ? e(lt, -1) : e(ct, 1);
		});
		var ut = B(ot);
		M(at), M(it);
		var dt = B(it, 2), ft = z(B(L(dt), 2));
		M(dt);
		var pt = B(dt, 2), mt = z(B(L(pt), 2), !0);
		M(pt);
		var ht = B(pt, 2), gt = (e) => {
			var t = rf(), n = R(t), r = z(B(L(n), 2), !0);
			M(n);
			var i = B(n, 2), a = z(B(L(i), 2), !0);
			M(i), V(() => {
				K(r, H(E).method), K(a, H(E).coverage);
			}), G(e, t);
		};
		q(ht, (e) => {
			H(E) && e(gt);
		}), M(rt);
		var _t = B(rt, 4), vt = (e) => {
			G(e, af());
		}, yt = (e) => {
			var n = sf();
			J(n, 21, () => t.item.tokenEstimates, (e) => e.profileId, (e, t) => {
				var n = of(), r = L(n), i = z(r, !0), a = B(r);
				M(n), V((e) => {
					K(i, H(t).profileId), K(a, ` · ${e ?? ""} tokens ·
              ${H(t).method ?? ""} · ${H(t).coverage ?? ""}`);
				}, [() => Z(H(t).tokens)]), G(e, n);
			}), M(n), G(e, n);
		};
		q(_t, (e) => {
			t.item.tokenEstimates.length === 0 ? e(vt) : e(yt, -1);
		});
		var bt = B(_t, 2), xt = (e) => {
			var t = df(), n = B(R(t), 2);
			J(n, 20, () => H(ne), (e) => e, (e, t) => {
				let n = /* @__PURE__ */ P(() => Ro(t));
				var r = uf(), i = L(r), a = (e) => {
					var t = cf(), r = R(t), i = z(r, !0), a = B(r);
					V(() => {
						K(i, H(n).title), K(a, ` — ${H(n).impact ?? ""}`);
					}), G(e, t);
				}, o = (e) => {
					var t = lf();
					xe(), G(e, t);
				};
				q(i, (e) => {
					H(n) ? e(a) : e(o, -1);
				}), M(r), G(e, r);
			}), M(n), G(e, t);
		};
		q(bt, (e) => {
			H(ne).length > 0 && e(xt);
		}), M(nt), ui(nt, (e, t) => Ui?.(e, t), () => ({
			state: n(),
			key: "diagnostics"
		}));
		var St = B(nt, 2), Ct = B(L(St), 2), wt = L(Ct), Tt = (e) => {
			var t = ff(), n = B(L(t), 2), r = L(n), i = z(r, !0);
			Ya(B(r, 2), {
				get value() {
					return H(E).profileId;
				},
				label: "estimate profile ID"
			}), M(n), M(t), V(() => K(i, H(E).profileId)), G(e, t);
		};
		q(wt, (e) => {
			H(E) && e(Tt);
		});
		var Et = B(wt, 2), Dt = B(L(Et), 2), Ot = L(Dt), kt = z(Ot, !0);
		Ya(B(Ot), {
			get value() {
				return t.item.id;
			},
			label: "context ID"
		}), M(Dt), M(Et);
		var At = B(Et, 2), jt = (e) => {
			var n = pf(), r = B(L(n), 2), i = L(r), a = z(i, !0);
			Ya(B(i, 2), {
				get value() {
					return t.item.sourceRecordId;
				},
				label: "source record ID"
			}), M(r), M(n), V(() => K(a, t.item.sourceRecordId)), G(e, n);
		};
		q(At, (e) => {
			t.item.sourceRecordId && e(jt);
		});
		var Mt = B(At, 2), Nt = (e) => {
			var n = mf(), r = B(L(n), 2), i = L(r), a = z(i, !0);
			Ya(B(i, 2), {
				get value() {
					return t.item.sourceToolCallId;
				},
				label: "source tool-call ID"
			}), M(r), M(n), V(() => K(a, t.item.sourceToolCallId)), G(e, n);
		};
		q(Mt, (e) => {
			t.item.sourceToolCallId && e(Nt);
		}), M(Ct);
		var Pt = B(Ct, 2), Ft = (e) => {
			var n = hf(), r = B(R(n), 2);
			J(r, 21, () => Object.entries(t.item.metadata), $r, (e, t) => {
				var n = /* @__PURE__ */ P(() => m(H(t), 2));
				let r = () => H(n)[0], i = () => H(n)[1];
				var a = of(), o = L(a), s = z(o, !0), c = B(o);
				M(a), V(() => {
					K(s, r()), K(c, `: ${i() ?? ""}`);
				}), G(e, a);
			}), M(r), G(e, n);
		}, It = /* @__PURE__ */ P(() => Object.keys(t.item.metadata).length > 0);
		q(Pt, (e) => {
			H(It) && e(Ft);
		});
		var Lt = B(Pt, 2), Rt = (e) => {
			var t = _f(), n = B(R(t), 2);
			J(n, 20, () => H(ne), (e) => e, (e, t) => {
				var n = gf(), r = z(L(n), !0);
				M(n), V(() => K(r, t)), G(e, n);
			}), M(n), G(e, t);
		};
		q(Lt, (e) => {
			H(ne).length > 0 && e(Rt);
		}), M(St), ui(St, (e, t) => Ui?.(e, t), () => ({
			state: n(),
			key: "identifiers"
		})), V((e, n, r, i, a, o) => {
			K(ie, `${e ?? ""}${H(_) ? ` · version ${H(_).number} of ${H(_).count}` : ""}`), K(oe, n), K(N, `${r ?? ""} `), K(He, `${i ?? ""} `), K(ut, ` · ${H(E)?.coverage ?? "unavailable" ?? ""}`), K(ft, `${a ?? ""}
            calls covered`), K(mt, o), K(kt, t.item.id);
		}, [
			() => Fo(t.item.kind),
			() => Ao(t.item),
			() => H(E) ? `${Z(H(E).tokens)} · call ${H(ee)?.index}` : "Unavailable",
			() => Ga(t.item.tokenTurns, "calculatedTokens"),
			() => Ka(t.item.tokenTurnsCoverage.coveredCalls, t.item.tokenTurnsCoverage.totalCalls),
			() => Ua(t.item.displayWeight, "serializedBytes")
		]), G(e, i);
	}, de = (e) => {
		G(e, yf());
	};
	q(le, (e) => {
		t.item ? e(ue) : e(de, -1);
	}), M(ce), G(e, ce), Ve();
}
kr(["click"]);
//#endregion
//#region src/lib/components/Inspector.svelte
var Cf = /* @__PURE__ */ W("<section class=\"panel inspector-empty-prompt svelte-gu3dqx\"><div class=\"panel-head svelte-gu3dqx\"><div class=\"svelte-gu3dqx\"><h2 class=\"svelte-gu3dqx\">Inspect workspace details</h2></div></div> <p class=\"muted svelte-gu3dqx\">Select a call to inspect usage.</p> <p class=\"muted svelte-gu3dqx\">Select an item to inspect its context.</p></section>"), wf = /* @__PURE__ */ W("<section class=\"panel svelte-gu3dqx\"><div class=\"panel-head svelte-gu3dqx\"><div class=\"svelte-gu3dqx\"><h2 class=\"svelte-gu3dqx\">Model call</h2></div> <button type=\"button\" class=\"panel-close svelte-gu3dqx\" aria-label=\"Close pinned call\">×</button></div> <!></section>"), Tf = /* @__PURE__ */ W("<section class=\"panel svelte-gu3dqx\"><div class=\"panel-head svelte-gu3dqx\"><div class=\"svelte-gu3dqx\"><h2 class=\"svelte-gu3dqx\">Context item</h2> <p class=\"svelte-gu3dqx\">Selected item</p></div> <button type=\"button\" class=\"panel-close svelte-gu3dqx\" aria-label=\"Close context item\">×</button></div> <!></section>"), Ef = /* @__PURE__ */ W("<p class=\"inspector-secondary-prompt muted svelte-gu3dqx\"> </p>"), Df = /* @__PURE__ */ W("<p class=\"inspector-secondary-prompt muted svelte-gu3dqx\">Select an item to inspect its context.</p>"), Of = /* @__PURE__ */ W("<!> <!> <!> <!>", 1), kf = {
	hash: "svelte-gu3dqx",
	code: ".panel.svelte-gu3dqx {background:var(--surface);border:0;border-radius:var(--radius);padding:var(--panel-padding);margin-top:0;min-width:0;}.panel-head.svelte-gu3dqx {display:flex;justify-content:space-between;gap:16px;align-items:start;margin-bottom:10px;min-width:0;}.panel-head.svelte-gu3dqx > :where(.svelte-gu3dqx) {min-width:0;}.panel-head.svelte-gu3dqx p:where(.svelte-gu3dqx) {color:var(--secondary);margin:4px 0 0;font-size:var(--text-sm);}h2.svelte-gu3dqx {font-size:var(--text-lg);margin:0;}.inspector-empty-prompt.svelte-gu3dqx {display:flex;flex-wrap:wrap;gap:4px 0;padding:0;background:transparent;}.inspector-empty-prompt.svelte-gu3dqx .panel-head:where(.svelte-gu3dqx) {display:none;}.inspector-empty-prompt.svelte-gu3dqx p:where(.svelte-gu3dqx) {margin:0;color:var(--secondary);font-size:var(--text-sm);}.inspector-empty-prompt.svelte-gu3dqx p:where(.svelte-gu3dqx) + p:where(.svelte-gu3dqx)::before {content:'·';margin:0 10px;}.panel-close.svelte-gu3dqx {flex-shrink:0;align-self:flex-start;font-size:18px;padding:1px 7px;}.inspector-secondary-prompt.svelte-gu3dqx {margin:0;padding:9px 11px;border:1px solid var(--separator);border-radius:var(--radius);background:var(--plot);font-size:var(--text-sm);}.muted.svelte-gu3dqx {color:var(--secondary);}"
};
function Af(e, t) {
	li(e, kf);
	let n = X(t, "sessions", 19, () => []);
	var r = Br(), i = R(r), a = (e) => {
		G(e, Cf());
	}, o = (e) => {
		var r = Of(), i = R(r), a = (e) => {
			var n = wf(), r = L(n), i = B(L(r), 2);
			M(r), Od(B(r, 2), {
				get sections() {
					return t.callSections;
				},
				get call() {
					return t.pinnedCall;
				},
				get indexed() {
					return t.indexed;
				},
				pinned: !0,
				get onSelectItem() {
					return t.onSelectItem;
				},
				get onPinCall() {
					return t.onPinCall;
				}
			}), M(n), U("click", i, function(...e) {
				t.onClosePinnedCall?.apply(this, e);
			}), G(e, n);
		};
		q(i, (e) => {
			t.pinnedCall && e(a);
		});
		var o = B(i, 2), s = (e) => {
			var r = Tf(), i = L(r), a = B(L(i), 2);
			M(i);
			var o = B(i, 2);
			{
				let e = /* @__PURE__ */ P(() => t.pinnedCallIndex ?? t.hoveredCallIndex);
				Sf(o, {
					get item() {
						return t.selectedItem;
					},
					get sections() {
						return t.itemSections;
					},
					get onInspectCall() {
						return t.onInspectCall;
					},
					get indexed() {
						return t.indexed;
					},
					get callIndex() {
						return H(e);
					},
					get pinnedCallIndex() {
						return t.pinnedCallIndex;
					},
					get onSelectItem() {
						return t.onSelectItem;
					},
					get onRevealInRiver() {
						return t.onRevealInRiver;
					},
					get sessions() {
						return n();
					}
				});
			}
			M(r), U("click", a, function(...e) {
				t.onCloseItem?.apply(this, e);
			}), G(e, r);
		};
		q(o, (e) => {
			t.selectedItem && e(s);
		});
		var c = B(o, 2), l = (e) => {
			var n = Ef(), r = z(n, !0);
			V(() => K(r, t.hasCalls ? "Select a call to inspect usage." : "No call usage is available in this session.")), G(e, n);
		};
		q(c, (e) => {
			t.pinnedCall || e(l);
		});
		var u = B(c, 2), d = (e) => {
			G(e, Df());
		};
		q(u, (e) => {
			t.selectedItem || e(d);
		}), G(e, r);
	};
	q(i, (e) => {
		!t.pinnedCall && !t.selectedItem ? e(a) : e(o, -1);
	}), G(e, r);
}
kr(["click"]);
//#endregion
//#region src/lib/components/ItemHoverCard.svelte
var jf = /* @__PURE__ */ W("<p class=\"content-preview svelte-c2davt\"> </p>"), Mf = /* @__PURE__ */ W("<p class=\"preview-note svelte-c2davt\">Preview truncated</p>"), Nf = /* @__PURE__ */ W("<p class=\"lineage svelte-c2davt\"> </p>"), Pf = /* @__PURE__ */ W("<section class=\"item-hover-card svelte-c2davt\"><header class=\"svelte-c2davt\"><span class=\"svelte-c2davt\"> </span><strong class=\"svelte-c2davt\"> </strong></header> <!> <!> <dl class=\"svelte-c2davt\"><div class=\"svelte-c2davt\"><dt class=\"svelte-c2davt\">Present</dt> <dd class=\"svelte-c2davt\"> </dd></div> <div class=\"svelte-c2davt\"><dt class=\"svelte-c2davt\">Lifetime</dt> <dd class=\"svelte-c2davt\"> </dd></div> <div class=\"svelte-c2davt\"><dt class=\"svelte-c2davt\">Serialized size</dt> <dd class=\"svelte-c2davt\"> </dd></div> <div class=\"svelte-c2davt\"><dt class=\"svelte-c2davt\">Calculated token-turns</dt> <dd class=\"svelte-c2davt\"> </dd></div> <div class=\"svelte-c2davt\"><dt class=\"svelte-c2davt\">Token coverage</dt> <dd class=\"svelte-c2davt\"> </dd></div></dl> <!></section>"), Ff = {
	hash: "svelte-c2davt",
	code: ".item-hover-card.svelte-c2davt {min-width:300px;max-width:360px;padding:10px;color:var(--text);background:var(--surface);border:1px solid var(--control-border);border-radius:var(--radius);box-shadow:0 10px 30px var(--shadow);}header.svelte-c2davt {display:flex;flex-direction:column;gap:4px;margin-bottom:10px;}header.svelte-c2davt span:where(.svelte-c2davt) {width:fit-content;color:var(--text);border:1px solid var(--separator);border-radius:999px;padding:2px 7px;font-size:var(--text-sm);}header.svelte-c2davt strong:where(.svelte-c2davt) {color:var(--text-strong);overflow-wrap:anywhere;}dl.svelte-c2davt {display:grid;grid-template-columns:repeat(2, minmax(120px, 1fr));gap:7px;margin:0;}dl.svelte-c2davt div:where(.svelte-c2davt) {background:var(--plot);border-radius:var(--control-radius);padding:6px 8px;}dt.svelte-c2davt {color:var(--secondary);font-size:var(--text-sm);}dd.svelte-c2davt {margin:1px 0 0;color:var(--text-strong);}p.svelte-c2davt {margin:9px 0 0;}.content-preview.svelte-c2davt {margin:0 0 9px;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--text);}.preview-note.svelte-c2davt {color:var(--secondary);font-size:var(--text-sm);}.lineage.svelte-c2davt {border-left:3px dashed var(--compaction);padding-left:8px;color:var(--compaction-text);}"
};
function If(e, t) {
	Be(t, !0), li(e, Ff);
	let n = /* @__PURE__ */ P(() => t.item ? t.indexed.compactionBySourceId.get(t.item.id) ?? [] : []), r = /* @__PURE__ */ P(() => t.item ? t.indexed.compactionBySummaryId.get(t.item.id) ?? null : null), i = /* @__PURE__ */ P(() => H(n).length > 0 ? `Removed at the compaction before call ${H(n).map((e) => e.beforeModelCall).join(", ")}` : H(r) ? `Replaces ${Q(H(r).sourceItemIds.length)} items removed at the compaction before call ${H(r).beforeModelCall}` : null);
	var a = Br(), o = R(a), s = (e) => {
		var n = Pf(), r = L(n), a = L(r), o = z(a, !0), s = z(B(a), !0);
		M(r);
		var c = B(r, 2), l = (e) => {
			var n = jf(), r = z(n, !0);
			V(() => K(r, t.item.preview.text)), G(e, n);
		};
		q(c, (e) => {
			t.item.preview?.text && e(l);
		});
		var u = B(c, 2), d = (e) => {
			G(e, Mf());
		};
		q(u, (e) => {
			t.item.preview?.truncated && e(d);
		});
		var f = B(u, 2), p = L(f), m = z(B(L(p), 2));
		M(p);
		var h = B(p, 2), g = z(B(L(h), 2));
		M(h);
		var _ = B(h, 2), v = z(B(L(_), 2), !0);
		M(_);
		var y = B(_, 2), b = z(B(L(y), 2), !0);
		M(y);
		var x = B(y, 2), S = z(B(L(x), 2), !0);
		M(x), M(f);
		var C = B(f, 2), w = (e) => {
			var t = Nf(), n = z(t, !0);
			V(() => K(n, H(i))), G(e, t);
		};
		q(C, (e) => {
			H(i) && e(w);
		}), M(n), V((e, r, i, a, c, l, u) => {
			Y(n, "aria-label", e), K(o, r), K(s, i), K(m, `Calls ${t.item.firstModelCall ?? ""}–${t.item.lastModelCall ?? ""}`), K(g, `${a ?? ""} calls · ${t.item.presence.length ?? ""} range${t.item.presence.length === 1 ? "" : "s"}`), K(v, c), K(b, l), K(S, u);
		}, [
			() => `Context item ${Ao(t.item)}`,
			() => Fo(t.item.kind),
			() => Ao(t.item),
			() => tc(t.item),
			() => Ua(t.item.displayWeight, "serializedBytes"),
			() => Ga(nc(t.item), "calculatedTokens"),
			() => Ka(t.item.tokenTurnsCoverage.coveredCalls, t.item.tokenTurnsCoverage.totalCalls)
		]), G(e, n);
	};
	q(o, (e) => {
		t.item && e(s);
	}), G(e, a), Ve();
}
//#endregion
//#region src/lib/components/SessionSummary.svelte
var Lf = /* @__PURE__ */ W("<p class=\"compact-metrics svelte-m8zdew\"><span class=\"svelte-m8zdew\"> </span> <span class=\"svelte-m8zdew\"> </span> <span class=\"svelte-m8zdew\"> </span> <span class=\"svelte-m8zdew\"> </span></p>"), Rf = /* @__PURE__ */ W(" <span class=\"price-source svelte-m8zdew\"> <!>.</span>", 1), zf = /* @__PURE__ */ W("<small class=\"metric-note svelte-m8zdew\"> </small>"), Bf = /* @__PURE__ */ W("<span class=\"svelte-m8zdew\"> <!></span> <b class=\"svelte-m8zdew\"> </b> <small class=\"metric-note svelte-m8zdew\"> </small> <!>", 1), Vf = /* @__PURE__ */ W("<span class=\"svelte-m8zdew\">Cost</span> <b title=\"No call in this session has a known or estimated cost.\" class=\"svelte-m8zdew\">Unknown</b> <!>", 1), Hf = /* @__PURE__ */ W("<div class=\"primary-metrics svelte-m8zdew\"><div class=\"svelte-m8zdew\"><span class=\"svelte-m8zdew\">Model calls</span><b class=\"svelte-m8zdew\"> </b></div> <div class=\"svelte-m8zdew\"><span class=\"svelte-m8zdew\">Context items</span><b class=\"svelte-m8zdew\"> </b></div> <div class=\"svelte-m8zdew\"><span class=\"svelte-m8zdew\">Peak calculated context</span> <b class=\"svelte-m8zdew\"> </b></div> <div class=\"cost-metric svelte-m8zdew\"><!></div></div>"), Uf = /* @__PURE__ */ W("<li class=\"svelte-m8zdew\"> </li>"), Wf = /* @__PURE__ */ W("<ul class=\"estimate-reasons svelte-m8zdew\"></ul>"), Gf = /* @__PURE__ */ W("<p class=\"estimate-lead svelte-m8zdew\"> </p> <!>", 1), Kf = /* @__PURE__ */ W("Not recorded<!>", 1), qf = /* @__PURE__ */ W("<div><dt class=\"svelte-m8zdew\">Billed cost (USD)</dt> <dd class=\"svelte-m8zdew\"> </dd></div>"), Jf = /* @__PURE__ */ W("<div><dt class=\"svelte-m8zdew\"> </dt> <dd class=\"svelte-m8zdew\"> <small class=\"metric-note svelte-m8zdew\"> </small></dd></div>"), Yf = /* @__PURE__ */ W("<div><dt class=\"svelte-m8zdew\">Title</dt> <dd class=\"svelte-m8zdew\"> </dd></div>"), Xf = /* @__PURE__ */ W("<div><dt class=\"svelte-m8zdew\"> </dt> <dd class=\"svelte-m8zdew\"> </dd></div>"), Zf = /* @__PURE__ */ W("<div><dt class=\"svelte-m8zdew\">Cache-write limits</dt> <dd class=\"svelte-m8zdew\">Anthropic writes are aggregated across TTLs. Copilot Responses uses separately\n                recorded writes; older direct OpenAI adapter zeros do not establish measured zero\n                writes. See each call's audited policy.</dd></div>"), Qf = /* @__PURE__ */ W("<div><dt class=\"svelte-m8zdew\">Fallback code</dt> <dd class=\"svelte-m8zdew\"><code class=\"svelte-m8zdew\"> </code></dd></div>"), $f = /* @__PURE__ */ W("<div><dt class=\"svelte-m8zdew\">Reconciliation (complete / comparable calls)</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <div><dt class=\"svelte-m8zdew\">Residual median / maximum</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <div><dt class=\"svelte-m8zdew\">Negative residual calls</dt> <dd class=\"svelte-m8zdew\"> </dd></div>", 1), ep = /* @__PURE__ */ W("<div><dt class=\"svelte-m8zdew\">Calls where the estimate exceeds reported input</dt> <dd class=\"svelte-m8zdew\"> </dd></div>"), tp = /* @__PURE__ */ W("<li> <!></li>"), np = /* @__PURE__ */ W("<h4 class=\"svelte-m8zdew\">Tokenization profiles</h4> <ul class=\"profiles svelte-m8zdew\"></ul>", 1), rp = /* @__PURE__ */ W("<p class=\"svelte-m8zdew\">Child session of <a class=\"svelte-m8zdew\"> </a></p>"), ip = /* @__PURE__ */ W("<li><a class=\"svelte-m8zdew\"> </a></li>"), ap = /* @__PURE__ */ W("<details><summary class=\"disclosure svelte-m8zdew\"> </summary> <ul class=\"svelte-m8zdew\"></ul></details>"), op = /* @__PURE__ */ W("<div class=\"session-relations svelte-m8zdew\"><!> <!></div>"), sp = /* @__PURE__ */ W("<section class=\"summary svelte-m8zdew\" aria-label=\"Session summary\"><!> <div class=\"session-status svelte-m8zdew\"><div> <!></div> <details class=\"session-details svelte-m8zdew\" id=\"session-details\"><summary class=\"disclosure svelte-m8zdew\" id=\"session-details-summary\">Session details</summary> <div class=\"detail-columns svelte-m8zdew\"><section><h3 class=\"svelte-m8zdew\">Usage breakdown</h3> <dl class=\"svelte-m8zdew\"><div><dt class=\"svelte-m8zdew\">Input tokens, all calls<!></dt> <dd class=\"svelte-m8zdew\"> <!></dd></div> <div><dt class=\"svelte-m8zdew\">Output tokens, all calls</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <div><dt class=\"svelte-m8zdew\">Reasoning tokens, all calls</dt> <dd class=\"svelte-m8zdew\"><!></dd></div> <div><dt class=\"svelte-m8zdew\">Cache-read share<!></dt> <dd class=\"svelte-m8zdew\"> </dd></div> <div><dt class=\"svelte-m8zdew\">Compactions</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <!> <div><dt class=\"svelte-m8zdew\"> <!></dt> <dd class=\"svelte-m8zdew\"><!> <!></dd></div> <!></dl></section> <section><h3 class=\"svelte-m8zdew\">Session metadata</h3> <dl class=\"svelte-m8zdew\"><div><dt class=\"svelte-m8zdew\">Provider</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <div><dt class=\"svelte-m8zdew\">Model</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <!> <div><dt class=\"svelte-m8zdew\">Working directory</dt> <dd class=\"svelte-m8zdew\"> </dd></div></dl></section></div> <details class=\"diagnostics svelte-m8zdew\"><summary class=\"disclosure svelte-m8zdew\">Diagnostics</summary> <dl class=\"svelte-m8zdew\"><div><dt class=\"svelte-m8zdew\">Reported usage completeness</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <div><dt class=\"svelte-m8zdew\">Usage policy coverage (complete / partial / missing / unsupported)</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <!> <!> <!> <div><dt class=\"svelte-m8zdew\">Estimate coverage (complete / partial / unavailable)</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <div><dt class=\"svelte-m8zdew\">Calculated token-turns</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <div><dt class=\"svelte-m8zdew\">Token-turn exposure coverage</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <!> <div><dt class=\"svelte-m8zdew\">Tokenizer methods</dt> <dd class=\"svelte-m8zdew\"> </dd></div></dl> <!></details></details></div> <!></section>"), cp = {
	hash: "svelte-m8zdew",
	code: ".session-relations.svelte-m8zdew {margin-top:8px;color:var(--secondary);font-size:13px;}.session-relations.svelte-m8zdew p:where(.svelte-m8zdew) {margin:0 0 4px;}.session-relations.svelte-m8zdew ul:where(.svelte-m8zdew) {margin:6px 0 0;padding-left:20px;}.session-relations.svelte-m8zdew a:where(.svelte-m8zdew) {color:var(--accent);}.summary.svelte-m8zdew {margin-top:16px;min-width:0;}.compact-metrics.svelte-m8zdew {display:flex;flex-wrap:wrap;gap:2px 0;margin:0 0 4px;color:var(--text-strong);font-weight:600;font-variant-numeric:tabular-nums;}.compact-metrics.svelte-m8zdew span:where(.svelte-m8zdew):not(:last-child)::after {content:'·';margin:0 6px;color:var(--secondary);font-weight:400;}.primary-metrics.svelte-m8zdew {display:grid;grid-template-columns:repeat(4, minmax(0, 1fr));gap:9px;}.primary-metrics.svelte-m8zdew > div:where(.svelte-m8zdew) {min-width:0;padding:8px 12px 8px 0;}.primary-metrics.svelte-m8zdew span:where(.svelte-m8zdew) {display:block;color:var(--secondary);font-size:var(--text-sm);}.primary-metrics.svelte-m8zdew b:where(.svelte-m8zdew) {display:block;color:var(--text-strong);margin-top:2px;overflow-wrap:anywhere;font-variant-numeric:tabular-nums;}.metric-note.svelte-m8zdew {display:block;color:var(--secondary);font-size:var(--text-sm);font-weight:normal;}\n  /* Keep status and trigger inline; the full-width body clears both in either state. */.session-status.svelte-m8zdew {margin-top:8px;}.session-status.svelte-m8zdew::after {content:'';display:block;clear:both;}.estimate-level.svelte-m8zdew {float:left;display:inline-flex;align-items:center;margin:0 16px 0 0;color:var(--secondary);font-size:var(--text-md);}.estimate-level.good.svelte-m8zdew {color:var(--accent);}.estimate-level.partial.svelte-m8zdew {color:var(--warning);}.estimate-level.rough.svelte-m8zdew {color:var(--error);}.price-source.svelte-m8zdew {display:block;margin-top:6px;color:var(--secondary);}.estimate-lead.svelte-m8zdew {margin:0;}.estimate-reasons.svelte-m8zdew {margin:8px 0 0;padding-left:18px;}.estimate-reasons.svelte-m8zdew li:where(.svelte-m8zdew) + li:where(.svelte-m8zdew) {margin-top:4px;}.session-details.svelte-m8zdew {max-width:100%;color:var(--text);}.session-details.svelte-m8zdew > summary:where(.svelte-m8zdew) {float:left;}.profiles.svelte-m8zdew {color:var(--secondary);}summary.svelte-m8zdew {cursor:pointer;width:fit-content;}.detail-columns.svelte-m8zdew {clear:both;display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));align-items:start;gap:14px 24px;margin-top:10px;padding:12px;background:var(--surface);border:1px solid var(--separator);border-radius:var(--radius);}h3.svelte-m8zdew {margin:0 0 7px;color:var(--text);font-size:var(--text-md);}h4.svelte-m8zdew {margin:10px 0 4px;font-size:var(--text-sm);}dl.svelte-m8zdew {display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:6px 14px;margin:0;}dt.svelte-m8zdew {color:var(--secondary);font-size:var(--text-sm);}dd.svelte-m8zdew {margin:1px 0 0;overflow-wrap:anywhere;color:var(--text);}.diagnostics.svelte-m8zdew {margin-top:10px;padding:0 12px;}.diagnostics.svelte-m8zdew > dl:where(.svelte-m8zdew) {margin-top:8px;}.profiles.svelte-m8zdew {margin:0;padding-left:18px;font-size:var(--text-sm);overflow-wrap:anywhere;}code.svelte-m8zdew {overflow-wrap:anywhere;color:var(--secondary);}\n  /* Narrower views show the figures on one line instead (see SessionView), so the four\n     figures stay in one row whenever they are shown separately. */\n  @container highwater (max-width: 800px) {.detail-columns.svelte-m8zdew {grid-template-columns:1fr;}\n  }"
};
function lp(e, t) {
	Be(t, !0), li(e, cp);
	let n = X(t, "sessionId", 3, null), r = X(t, "sessions", 19, () => []), i = X(t, "compact", 3, !1), a = /* @__PURE__ */ P(() => r().find((e) => e.id === n())), o = /* @__PURE__ */ P(() => H(a)?.parentReference ? r().find((e) => e.id === H(a).parentReference) : void 0), s = /* @__PURE__ */ P(() => n() ? jd(r(), n()) : []), c = (e) => [
		e.displayName,
		e.subagentType,
		Gl(e.startedAt)
	].filter(Boolean).join(" · "), l = /* @__PURE__ */ P(() => t.indexed.analysis), u = /* @__PURE__ */ P(() => H(l).session), d = /* @__PURE__ */ P(() => H(l).tokenAnalysis), f = /* @__PURE__ */ P(() => H(l).economics), p = /* @__PURE__ */ P(() => [...new Set(H(l).modelCalls.map((e) => e.provider).filter(Boolean))].join(", ") || "Unknown"), m = /* @__PURE__ */ P(() => [...new Set(H(l).modelCalls.filter((e) => !e.usage.placeholder).map((e) => e.model).filter(Boolean))].join(", ") || "Unknown"), h = /* @__PURE__ */ P(() => H(d).itemEstimateCoverage), g = /* @__PURE__ */ P(() => Nl(t.indexed)), _ = /* @__PURE__ */ P(() => Rl(H(f).costBasis, H(u).source)), v = /* @__PURE__ */ P(() => H(u).reconciliationComparableCalls > 0), y = /* @__PURE__ */ P(() => H(v) ? null : vl(t.indexed)), b = /* @__PURE__ */ P(() => H(u).costSummary), x = /* @__PURE__ */ P(() => iu(H(b))), S = /* @__PURE__ */ P(() => au(H(b))), C = /* @__PURE__ */ P(() => H(b).priceData), w = /* @__PURE__ */ P(() => H(u).reportedCostTotal === null ? null : uu(H(u).reportedCostCoverage)), ee = /* @__PURE__ */ P(() => H(u).reportedPromptTokens === null ? null : uu(H(u).reportedUsageCoverage)), T = /* @__PURE__ */ P(() => H(u).harnessSessionCost !== null && !(H(u).source === "vscode-copilot" && H(u).reportedCostTotal !== null && Math.abs(H(u).reportedCostTotal - H(u).harnessSessionCost.totalUsd) < 1e-9));
	var E = sp(), te = L(E), D = (e) => {
		var t = Lf(), n = L(t), r = z(n), i = B(n, 2), a = z(i), o = B(i, 2), s = z(o, !0), c = z(B(o, 2), !0);
		M(t), V((e, n, i) => {
			Y(t, "title", H(x) ? `${H(x).label}: ${H(x).note}` : void 0), K(r, `${e ?? ""} calls`), K(a, `${n ?? ""} items`), K(s, i), K(c, H(x) ? H(x).value : "Cost unknown");
		}, [
			() => Q(H(l).modelCalls.length),
			() => Q(H(l).contextItems.length),
			() => H(u).peakCalculatedVisibleTokens === null ? "Peak unknown" : `${Z(H(u).peakCalculatedVisibleTokens)} peak`
		]), G(e, t);
	}, O = (e) => {
		var t = Hf(), n = L(t), r = z(B(L(n)), !0);
		M(n);
		var i = B(n, 2), a = z(B(L(i)), !0);
		M(i);
		var o = B(i, 2), s = z(B(L(o), 2), !0);
		M(o);
		var c = B(o, 2), d = L(c), f = (e) => {
			var t = Bf(), n = R(t), r = L(n, !0);
			_a(B(r), {
				id: "session-cost-note",
				label: "How the cost is worked out",
				children: (e, t) => {
					xe();
					var n = Rf(), r = R(n), i = B(r), a = L(i), o = B(a), s = (e) => {
						var t = zr();
						V((e) => K(t, `, with corrections from model-prices ${e ?? ""}`), [() => H(C).amendmentsImportedFrom.slice(0, 7)]), G(e, t);
					};
					q(o, (e) => {
						H(C).amendmentsImportedFrom && e(s);
					}), xe(), M(i), V((e, t) => {
						K(r, `${H(x).title ?? ""} `), K(a, `Prices from models.dev ${e ?? ""} (${t ?? ""})`);
					}, [() => H(C).modelsDevCommit.slice(0, 7), () => H(C).modelsDevCommittedAt.slice(0, 10)]), G(e, n);
				},
				$$slots: { default: !0 }
			}), M(n);
			var i = B(n, 2), a = z(i, !0), o = B(i, 2), s = z(o), c = B(o, 2), l = (e) => {
				var t = zf(), n = z(t, !0);
				V(() => K(n, H(x).split)), G(e, t);
			};
			q(c, (e) => {
				H(x).split && e(l);
			}), V(() => {
				K(r, H(x).label), K(a, H(x).value), K(s, `${H(x).note ?? ""}${H(S) ? ` · ${H(S)}` : ""}`);
			}), G(e, t);
		}, p = (e) => {
			var t = Vf(), n = B(R(t), 4), r = (e) => {
				var t = zf(), n = z(t, !0);
				V(() => K(n, H(S))), G(e, t);
			};
			q(n, (e) => {
				H(S) && e(r);
			}), G(e, t);
		};
		q(d, (e) => {
			H(x) ? e(f) : e(p, -1);
		}), M(c), M(t), V((e, t, n) => {
			K(r, e), K(a, t), K(s, n);
		}, [
			() => Q(H(l).modelCalls.length),
			() => Q(H(l).contextItems.length),
			() => H(u).peakCalculatedVisibleTokens === null ? "Unknown" : Ua(H(u).peakCalculatedVisibleTokens, "calculatedTokens")
		]), G(e, t);
	};
	q(te, (e) => {
		i() ? e(D) : e(O, -1);
	});
	var k = B(te, 2), ne = L(k), re = L(ne, !0), ie = B(re);
	{
		let e = /* @__PURE__ */ P(() => `Why are estimates ${H(g).level}?`);
		_a(ie, {
			id: "estimate-quality-note",
			get label() {
				return H(e);
			},
			children: (e, t) => {
				var n = Gf(), r = R(n), i = z(r, !0), a = B(r, 2), o = (e) => {
					var t = Wf();
					J(t, 20, () => H(g).reasons, (e) => e, (e, t) => {
						var n = Uf(), r = z(n, !0);
						V(() => K(r, t)), G(e, n);
					}), M(t), G(e, t);
				};
				q(a, (e) => {
					H(g).reasons.length > 0 && e(o);
				}), V(() => K(i, H(g).lead)), G(e, n);
			},
			$$slots: { default: !0 }
		});
	}
	M(ne);
	var ae = B(ne, 2), oe = B(L(ae), 2), se = L(oe), ce = B(L(se), 2), le = L(ce), ue = L(le);
	_a(B(L(ue)), {
		id: "input-tokens-note",
		label: "About input tokens",
		children: (e, t) => {
			xe(), G(e, zr("Input tokens summed over every call. Each call sends the whole context again, so\n                  most of these are cache reads."));
		},
		$$slots: { default: !0 }
	}), M(ue);
	var de = B(ue, 2), fe = L(de), pe = B(fe), me = (e) => {
		var t = zf(), n = z(t, !0);
		V(() => K(n, H(ee))), G(e, t);
	};
	q(pe, (e) => {
		H(ee) && e(me);
	}), M(de), M(le);
	var he = B(le, 2), ge = z(B(L(he), 2), !0);
	M(he);
	var _e = B(he, 2), A = B(L(_e), 2), ve = L(A), j = (e) => {
		var t = Kf();
		_a(B(R(t)), {
			id: "reasoning-tokens-note",
			label: "Why reasoning tokens are not recorded",
			children: (e, t) => {
				xe();
				var n = zr();
				V((e) => K(n, `${e ?? ""} does not record reasoning tokens separately for these
                    calls. Any reasoning is included in the output tokens.`), [() => Kl(H(u).source)]), G(e, n);
			},
			$$slots: { default: !0 }
		}), G(e, t);
	}, ye = (e) => {
		var t = zr();
		V((e) => K(t, e), [() => Z(H(u).reportedReasoningTokens)]), G(e, t);
	};
	q(ve, (e) => {
		H(u).reportedReasoningTokens === null ? e(j) : e(ye, -1);
	}), M(A), M(_e);
	var be = B(_e, 2), Se = L(be);
	_a(B(L(Se)), {
		id: "cache-read-share-note",
		label: "About cache-read share",
		children: (e, t) => {
			xe();
			var n = zr();
			V((e) => K(n, `The share of input tokens read from the provider's cache, over the ${e ?? ""} calls with complete usage.`), [() => Ka(H(f).cacheReadEligibleCalls, H(l).modelCalls.length)]), G(e, n);
		},
		$$slots: { default: !0 }
	}), M(Se);
	var Ce = z(B(Se, 2), !0);
	M(be);
	var we = B(be, 2), Te = z(B(L(we), 2), !0);
	M(we);
	var Ee = B(we, 2), De = (e) => {
		var t = qf(), n = z(B(L(t), 2), !0);
		M(t), V((e) => K(n, e), [() => H(b).billed.calls > 0 ? Zl(H(b).billed, !0) : "None"]), G(e, t);
	}, Oe = /* @__PURE__ */ P(() => !["claude-code", "codex"].includes(H(u).source));
	q(Ee, (e) => {
		H(Oe) && e(De);
	});
	var ke = B(Ee, 2), Ae = L(ke), je = L(Ae);
	_a(B(je), {
		id: "recorded-cost-note",
		label: "About the recorded cost",
		children: (e, t) => {
			xe();
			var n = zr();
			V(() => K(n, H(_).note)), G(e, n);
		},
		$$slots: { default: !0 }
	}), M(Ae);
	var Me = B(Ae, 2), Ne = L(Me), Pe = (e) => {
		G(e, zr("Not recorded"));
	}, Fe = (e) => {
		var t = zr();
		V((e) => K(t, e), [() => za(H(u).reportedCostTotal)]), G(e, t);
	};
	q(Ne, (e) => {
		H(u).reportedCostTotal === null ? e(Pe) : e(Fe, -1);
	});
	var N = B(Ne, 2), Ie = (e) => {
		var t = zf(), n = z(t, !0);
		V(() => K(n, H(w))), G(e, t);
	};
	q(N, (e) => {
		H(w) && e(Ie);
	}), M(Me), M(ke);
	var Le = B(ke, 2), Re = (e) => {
		var t = Jf(), n = L(t), r = z(n), i = B(n, 2), a = L(i), o = z(B(a), !0);
		M(i), M(t), V((e, t, n) => {
			K(r, `${e ?? ""}'s own total (USD)`), K(a, `${t ?? ""} `), K(o, n);
		}, [
			() => Kl(H(u).source),
			() => Ba(H(u).harnessSessionCost.totalUsd),
			() => ou(H(u).harnessSessionCost, H(u).source)
		]), G(e, t);
	};
	q(Le, (e) => {
		H(T) && H(u).harnessSessionCost && e(Re);
	}), M(ce), M(se);
	var ze = B(se, 2), He = B(L(ze), 2), Ue = L(He), We = z(B(L(Ue), 2));
	M(Ue);
	var Ge = B(Ue, 2), Ke = z(B(L(Ge), 2), !0);
	M(Ge);
	var qe = B(Ge, 2), Je = (e) => {
		var t = Yf(), n = z(B(L(t), 2), !0);
		M(t), V(() => K(n, H(u).title)), G(e, t);
	};
	q(qe, (e) => {
		H(u).title && e(Je);
	});
	var Ye = B(qe, 2), Xe = z(B(L(Ye), 2), !0);
	M(Ye), M(He), M(ze), M(oe);
	var Ze = B(oe, 2), Qe = B(L(Ze), 2), $e = L(Qe), et = z(B(L($e), 2), !0);
	M($e);
	var tt = B($e, 2), nt = z(B(L(tt), 2));
	M(tt);
	var rt = B(tt, 2), it = (e) => {
		var t = Xf(), n = L(t), r = z(n), i = z(B(n, 2));
		M(t), V((e, t, n, a) => {
			K(r, `${H(_).label ?? ""} component coverage (complete / partial / missing / unsupported)`), K(i, `${e ?? ""} complete ·
                ${t ?? ""} partial ·
                ${n ?? ""} missing ·
                ${a ?? ""} unsupported`);
		}, [
			() => Q(H(f).costCompleteness.complete),
			() => Q(H(f).costCompleteness.partial),
			() => Q(H(f).costCompleteness.missing),
			() => Q(H(f).costCompleteness.unsupported)
		]), G(e, t);
	}, at = /* @__PURE__ */ P(() => ![
		"claude-code",
		"codex",
		"vscode-copilot"
	].includes(H(u).source));
	q(rt, (e) => {
		H(at) && e(it);
	});
	var ot = B(rt, 2), st = (e) => {
		G(e, Zf());
	}, ct = /* @__PURE__ */ P(() => zl(H(u).source));
	q(ot, (e) => {
		H(ct) && e(st);
	});
	var lt = B(ot, 2), ut = (e) => {
		var t = Qf(), n = B(L(t), 2), r = z(L(n), !0);
		M(n), M(t), V(() => K(r, H(d).fallbackReason)), G(e, t);
	};
	q(lt, (e) => {
		H(d).fallbackReason && e(ut);
	});
	var dt = B(lt, 2), ft = z(B(L(dt), 2));
	M(dt);
	var pt = B(dt, 2), mt = z(B(L(pt), 2), !0);
	M(pt);
	var ht = B(pt, 2), gt = z(B(L(ht), 2), !0);
	M(ht);
	var _t = B(ht, 2), vt = (e) => {
		var t = $f(), n = R(t), r = z(B(L(n), 2));
		M(n);
		var i = B(n, 2), a = z(B(L(i), 2));
		M(i);
		var o = B(i, 2), s = z(B(L(o), 2), !0);
		M(o), V((e, t, n, i, o) => {
			K(r, `${e ?? ""} /
                ${t ?? ""}`), K(a, `${n ?? ""} /
                ${i ?? ""}`), K(s, o);
		}, [
			() => Q(H(u).reconciliationCompleteCalls),
			() => Q(H(u).reconciliationComparableCalls),
			() => Va(H(u).medianAbsoluteResidualPercent),
			() => Va(H(u).maximumAbsoluteResidualPercent),
			() => Q(H(u).negativeResidualCalls)
		]), G(e, t);
	}, yt = (e) => {
		var t = ep(), n = z(B(L(t), 2), !0);
		M(t), V((e) => K(n, e), [() => Q(H(y).estimateAboveReportedCalls)]), G(e, t);
	};
	q(_t, (e) => {
		H(v) ? e(vt) : H(y) && e(yt, 1);
	});
	var bt = B(_t, 2), xt = z(B(L(bt), 2), !0);
	M(bt), M(Qe);
	var St = B(Qe, 2), Ct = (e) => {
		var t = np(), n = B(R(t), 2);
		J(n, 21, () => H(d).profiles, (e) => e.id, (e, t) => {
			var n = tp(), r = L(n), i = B(r), a = (e) => {
				var n = zr();
				V(() => K(n, `· ${H(t).api ?? ""}`)), G(e, n);
			};
			q(i, (e) => {
				H(t).api && e(a);
			}), M(n), V(() => K(r, `${H(t).provider ?? ""} / ${H(t).model ?? ""} · ${H(t).method ?? ""} · ${H(t).tokenizerFamily ?? ""}
                (v${H(t).version ?? ""})`)), G(e, n);
		}), M(n), G(e, t);
	};
	q(St, (e) => {
		H(d).profiles.length > 0 && e(Ct);
	}), M(Ze), M(ae), M(k);
	var wt = B(k, 2), Tt = (e) => {
		var t = op(), r = L(t), i = (e) => {
			var t = rp(), r = B(L(t)), i = z(r, !0);
			M(t), V((e) => {
				Y(r, "href", e), K(i, H(o).displayName);
			}, [() => Ad(H(o).id, n())]), G(e, t);
		};
		q(r, (e) => {
			H(o) && n() && e(i);
		});
		var a = B(r, 2), l = (e) => {
			var t = ap(), n = L(t), r = z(n), i = B(n, 2);
			J(i, 21, () => H(s), (e) => e.id, (e, t) => {
				var n = ip(), r = L(n), i = z(r, !0);
				M(n), V((e, t) => {
					Y(r, "href", e), K(i, t);
				}, [() => Ad(H(t).id), () => c(H(t))]), G(e, n);
			}), M(i), M(t), V((e) => K(r, `${e ?? ""}
            ${H(s).length === 1 ? "child session" : "child sessions"}`), [() => Q(H(s).length)]), G(e, t);
		};
		q(a, (e) => {
			H(s).length > 0 && e(l);
		}), M(t), G(e, t);
	};
	q(wt, (e) => {
		(H(o) || H(s).length > 0) && e(Tt);
	}), M(E), V((e, t, n, r, i, a, o, s, c, l, d, f, h, _, v, y) => {
		gi(ne, 1, `estimate-level ${H(g).level}`, "svelte-m8zdew"), K(re, H(g).label), K(fe, `${e ?? ""} `), K(ge, t), K(Ce, n), K(Te, r), K(je, `Recorded by ${i ?? ""} (USD)`), K(We, `${H(p) ?? ""} · recorded by ${a ?? ""}`), K(Ke, H(m)), K(Xe, H(u).workingDirectory ?? "Unknown"), K(et, H(u).reportedUsageCompleteness), K(nt, `${o ?? ""} complete ·
              ${s ?? ""} partial ·
              ${c ?? ""} missing ·
              ${l ?? ""} unsupported`), K(ft, `${d ?? ""} complete ·
              ${f ?? ""} partial ·
              ${h ?? ""} unavailable`), K(mt, _), K(gt, v), K(xt, y);
	}, [
		() => Z(H(u).reportedPromptTokens),
		() => Z(H(u).reportedCompletionTokens),
		() => Va(H(f).cacheReadRatio),
		() => Q(H(l).compactions.length),
		() => Kl(H(u).source),
		() => Kl(H(u).source),
		() => Q(H(f).usageCompleteness.complete),
		() => Q(H(f).usageCompleteness.partial),
		() => Q(H(f).usageCompleteness.missing),
		() => Q(H(f).usageCompleteness.unsupported),
		() => Ka(H(h).completeItems, H(h).totalItems),
		() => Q(H(h).partialItems),
		() => Q(H(h).unavailableItems),
		() => Z(H(u).calculatedTokenTurns),
		() => Ka(H(u).calculatedTokenTurnsCoverage.coveredCalls, H(u).calculatedTokenTurnsCoverage.totalCalls),
		() => Object.entries(H(d).tokenizerMethods).map(([e, t]) => `${e}: ${Q(t)}`).join(" · ") || "None"
	]), G(e, E), Ve();
}
//#endregion
//#region src/lib/components/ChartHelp.svelte
var up = /* @__PURE__ */ W("<h4 class=\"svelte-1f7lrk7\">System and tools</h4> <p class=\"svelte-1f7lrk7\">Recorded Pi instructions and tool declarations are replayed into per-call revisions. Their\n        token sizes estimate logical context, not exact provider wire framing. Older logs may lack\n        this material; missing does not mean zero. Provider-reported input and cost remain\n        independent totals.</p>", 1), dp = /* @__PURE__ */ W("<div class=\"chart-help svelte-1f7lrk7\"><button type=\"button\" aria-label=\"Chart help\" aria-controls=\"chart-help-popover\" title=\"Chart help\"> </button> <div id=\"chart-help-popover\" class=\"help-popover svelte-1f7lrk7\" role=\"group\" aria-labelledby=\"chart-help-title\"><div class=\"help-heading svelte-1f7lrk7\"><h3 id=\"chart-help-title\" class=\"svelte-1f7lrk7\">Chart help</h3> <button type=\"button\" class=\"help-close svelte-1f7lrk7\" aria-label=\"Close help\" title=\"Close (Esc)\">×</button></div> <h4 class=\"svelte-1f7lrk7\">Navigate the river</h4> <ul class=\"svelte-1f7lrk7\"><li class=\"svelte-1f7lrk7\">Drag across a range to zoom; scroll horizontally or Shift-drag to pan.</li> <li class=\"svelte-1f7lrk7\">Use pinch or modifier-wheel zoom; ordinary page scrolling remains available.</li> <li class=\"svelte-1f7lrk7\">Use Go to call beside the zoom controls to pin a call without changing zoom. Drag an area to\n        zoom to a range.</li> <li class=\"svelte-1f7lrk7\">The lifespan list spans the full session; filter or search it to locate an item.</li> <li class=\"svelte-1f7lrk7\">Use Find in lifespans from Composition to open and focus a selected item's row.</li> <li class=\"svelte-1f7lrk7\">Escape closes this help first, then clears the selected item, the pin, and Fit all.</li></ul> <!> <h4 class=\"svelte-1f7lrk7\">Read the scale</h4> <p class=\"svelte-1f7lrk7\">Session scale keeps ribbon heights comparable across calls. Visible calls mode rescales to\n      visible columns and interpolated viewport edges, so heights can change while panning or\n      zooming. Cached tokens still occupy context capacity.</p></div></div>"), fp = {
	hash: "svelte-1f7lrk7",
	code: ".chart-help.svelte-1f7lrk7 {display:flex;align-items:center;gap:6px 12px;min-height:var(--toggle-height);color:var(--secondary);font-size:var(--text-sm);}.help-trigger.svelte-1f7lrk7 {cursor:pointer;padding:5px 8px;white-space:nowrap;border:1px solid var(--separator);border-radius:var(--control-radius);color:var(--text);background:var(--surface);font:inherit;}.help-trigger.svelte-1f7lrk7:hover {background:var(--surface-raised);}.help-heading.svelte-1f7lrk7 {display:flex;align-items:center;justify-content:space-between;gap:12px;}.help-heading.svelte-1f7lrk7 h3:where(.svelte-1f7lrk7) {margin:0;}.help-close.svelte-1f7lrk7 {display:inline-flex;align-items:center;justify-content:center;width:var(--control-size);height:var(--control-size);padding:0;font-size:18px;line-height:1;}.help-popover.svelte-1f7lrk7 {position:fixed;z-index:20;left:12px;top:12px;width:min(30rem, calc(100vw - 24px));max-height:min(70vh, calc(100vh - 24px));overflow:auto;overscroll-behavior:contain;padding:14px 16px;border:1px solid var(--control-border);border-radius:var(--radius);background:var(--surface);color:var(--text);box-shadow:0 12px 32px var(--shadow-strong);font-size:var(--text-md);}h3.svelte-1f7lrk7,\n  h4.svelte-1f7lrk7 {margin:0 0 6px;color:var(--text-strong);}h3.svelte-1f7lrk7 {font-size:var(--text-lg);}h4.svelte-1f7lrk7 {margin-top:12px;font-size:var(--text-sm);}p.svelte-1f7lrk7 {margin:5px 0;}ul.svelte-1f7lrk7 {margin:5px 0;padding-left:20px;}li.svelte-1f7lrk7 + li:where(.svelte-1f7lrk7) {margin-top:4px;}"
};
function pp(e, t) {
	Be(t, !0), li(e, fp);
	let n = X(t, "isVisible", 3, !0), r = X(t, "compact", 3, !1), i = null, a = /* @__PURE__ */ F(null), o = /* @__PURE__ */ F(null), s = /* @__PURE__ */ F(null), c = /* @__PURE__ */ F(""), l = /* @__PURE__ */ F(!1);
	Cn(() => {
		n() || yr(() => d(!1));
	}), Cn(() => {
		t.source, u();
	});
	function u() {
		if (!H(l) || !H(a) || !H(o)) return;
		let e = H(a).closest(".session-view")?.getBoundingClientRect(), t = Math.max(0, e?.left ?? 0) + 12, n = Math.min(window.innerWidth, e?.right ?? window.innerWidth) - 12, r = Math.min(480, Math.max(0, n - t)), i = Math.min(H(o).scrollHeight, Math.max(0, window.innerHeight - 24)), s = H(a).getBoundingClientRect(), u = Math.max(t, Math.min(s.right - r, n - r)), d = s.bottom + 8, f = d + i <= window.innerHeight - 12 ? d : Math.max(12, s.top - i - 8);
		I(c, `left:${Math.round(u)}px;top:${Math.round(f)}px;width:${Math.round(r)}px;max-height:${Math.round(i)}px`);
	}
	function d(e = !0) {
		H(l) && (I(l, !1), e && H(a)?.focus());
	}
	function f() {
		H(l) ? d() : (I(l, !0), gr().then(() => H(s)?.focus({ preventScroll: !0 })));
	}
	Cn(() => {
		if (!H(l)) return;
		let e = (e) => {
			e.key !== "Escape" || e.defaultPrevented || (e.preventDefault(), e.stopPropagation(), d());
		}, t = (e) => {
			i && !e.composedPath().includes(i) && d(!1);
		};
		return window.addEventListener("keydown", e, !0), document.addEventListener("pointerdown", t, !0), () => {
			window.removeEventListener("keydown", e, !0), document.removeEventListener("pointerdown", t, !0);
		};
	});
	var p = dp();
	Or("resize", rn, u), Or("scroll", rn, u);
	var m = L(p);
	let h;
	var g = z(m, !0);
	Li(m, (e) => I(a, e), () => H(a));
	var _ = B(m, 2), v = L(_), y = B(L(v), 2);
	Li(y, (e) => I(s, e), () => H(s)), M(v);
	var b = B(v, 6), x = (e) => {
		var t = up();
		xe(2), G(e, t);
	};
	q(b, (e) => {
		t.source === "pi" && e(x);
	}), xe(4), M(_), Li(_, (e) => I(o, e), () => H(o)), M(p), Li(p, (e) => i = e, () => i), V(() => {
		h = gi(m, 1, "help-trigger svelte-1f7lrk7", null, h, { compact: r() }), Y(m, "aria-expanded", H(l)), K(g, r() ? "?" : "Chart help"), Y(_, "aria-hidden", !H(l)), Y(_, "hidden", !H(l)), vi(_, H(c));
	}), U("click", m, f), U("click", y, () => d()), G(e, p), Ve();
}
kr(["click"]);
//#endregion
//#region src/lib/context-river/navigation.ts
function mp(e, t, n) {
	let r = e.find((e) => e.callIndex === t);
	return r ? {
		callIndex: t,
		sourceRecordId: r.sourceRecordId ?? null,
		offsetFromViewportLeft: n
	} : null;
}
function hp(e, t, n, r) {
	let i = e.findIndex((e) => e.callIndex === t), a = e.findIndex((e) => e.callIndex === n);
	if (i < 0 || a < 0) return null;
	if (i === a) {
		let n = mp(e, t, r);
		return n ? {
			intervalCount: 0,
			anchor: n
		} : null;
	}
	let o = e[Math.min(i, a)], s = e[Math.max(i, a)];
	return {
		intervalCount: Math.abs(a - i),
		anchor: {
			callIndex: o.callIndex,
			sourceRecordId: o.sourceRecordId ?? null,
			nextCallIndex: s.callIndex,
			nextSourceRecordId: s.sourceRecordId ?? null,
			fractionToNext: .5,
			offsetFromViewportLeft: r
		}
	};
}
function gp(e, t, n) {
	if (e.length === 0) return null;
	let r = e.findIndex((e) => e.x >= t), i = r < 0 ? e[e.length - 1] : r === 0 ? e[0] : e[r - 1], a = r > 0 ? e[r] : void 0;
	return {
		callIndex: i.callIndex,
		sourceRecordId: i.sourceRecordId ?? null,
		...a ? {
			nextCallIndex: a.callIndex,
			nextSourceRecordId: a.sourceRecordId ?? null,
			fractionToNext: Math.min(1, Math.max(0, (t - i.x) / (a.x - i.x)))
		} : {},
		offsetFromViewportLeft: n
	};
}
function _p(e, t, n) {
	return e === 0 ? t / (Math.min(15, n) - 1) : t / e;
}
function vp(e, t, n, r, i) {
	let a = t === null || n <= 0 || t <= n * 1.005 ? null : Math.min(r, Math.max(n, t));
	return {
		spacing: a,
		adjustment: a === null ? "fit" : i && e !== a ? {
			kind: "anchor",
			anchor: i
		} : null,
		immediateAnchor: a !== null && e === a ? i : null
	};
}
//#endregion
//#region src/lib/context-river/dom-interaction.ts
function yp(e, t) {
	let n = !1, r = Vi(e), i = () => {
		!n && e.clientWidth > 0 && t.onResize(e.clientWidth, "element");
	};
	e.addEventListener("scroll", t.onScroll, { passive: !0 }), e.addEventListener("wheel", t.onWheel, { passive: !1 }), window.addEventListener("pointermove", t.onPointerMove), window.addEventListener("pointerup", t.onPointerUp), window.addEventListener("pointercancel", t.onPointerCancel), window.addEventListener("lostpointercapture", t.onPointerCancel), window.addEventListener("keyup", t.onKeyUp), window.addEventListener("blur", t.onBlur), document.addEventListener("scroll", t.onDocumentScroll, !0), r !== document && r.addEventListener("scroll", t.onDocumentScroll, !0), window.addEventListener("resize", i), i();
	let a = typeof ResizeObserver > "u" ? null : new ResizeObserver((e) => {
		if (n) return;
		let r = e[0]?.contentRect.width;
		r && r > 0 && t.onResize(r, "observer");
	});
	return a?.observe(e), () => {
		n || (n = !0, a?.disconnect(), e.removeEventListener("scroll", t.onScroll), e.removeEventListener("wheel", t.onWheel), window.removeEventListener("pointermove", t.onPointerMove), window.removeEventListener("pointerup", t.onPointerUp), window.removeEventListener("pointercancel", t.onPointerCancel), window.removeEventListener("lostpointercapture", t.onPointerCancel), window.removeEventListener("keyup", t.onKeyUp), window.removeEventListener("blur", t.onBlur), document.removeEventListener("scroll", t.onDocumentScroll, !0), r !== document && r.removeEventListener("scroll", t.onDocumentScroll, !0), window.removeEventListener("resize", i));
	};
}
function bp(e) {
	return {
		pointerId: e.pointerId,
		pointerType: e.pointerType,
		button: e.button,
		x: e.clientX,
		y: e.clientY,
		shiftKey: e.shiftKey
	};
}
function xp(e, t) {
	try {
		e.setPointerCapture(t);
	} catch {}
}
function Sp(e, t) {
	try {
		e.hasPointerCapture?.(t) && e.releasePointerCapture(t);
	} catch {}
}
//#endregion
//#region src/lib/context-river/overlay-focus.ts
function Cp(e = gr) {
	let t = 0, n = !1, r = null;
	return {
		observeIdentity(e) {
			n || r !== e && (r = e, t += 1);
		},
		focusAfterUpdate(r, i = () => !0, a) {
			if (n) return;
			let o = ++t;
			e().then(() => {
				if (n || o !== t || !i()) return;
				let e = r();
				e?.isConnected && !e.closest("[hidden]") && (a ? e.focus(a) : e.focus());
			});
		},
		cancel() {
			t += 1;
		},
		dispose() {
			n = !0, r = null, t += 1;
		}
	};
}
//#endregion
//#region node_modules/d3-array/src/ascending.js
function wp(e, t) {
	return e == null || t == null ? NaN : e < t ? -1 : e > t ? 1 : e >= t ? 0 : NaN;
}
//#endregion
//#region node_modules/d3-array/src/descending.js
function Tp(e, t) {
	return e == null || t == null ? NaN : t < e ? -1 : t > e ? 1 : t >= e ? 0 : NaN;
}
//#endregion
//#region node_modules/d3-array/src/bisector.js
function Ep(e) {
	let t, n, r;
	e.length === 2 ? (t = e === wp || e === Tp ? e : Dp, n = e, r = e) : (t = wp, n = (t, n) => wp(e(t), n), r = (t, n) => e(t) - n);
	function i(e, r, i = 0, a = e.length) {
		if (i < a) {
			if (t(r, r) !== 0) return a;
			do {
				let t = i + a >>> 1;
				n(e[t], r) < 0 ? i = t + 1 : a = t;
			} while (i < a);
		}
		return i;
	}
	function a(e, r, i = 0, a = e.length) {
		if (i < a) {
			if (t(r, r) !== 0) return a;
			do {
				let t = i + a >>> 1;
				n(e[t], r) <= 0 ? i = t + 1 : a = t;
			} while (i < a);
		}
		return i;
	}
	function o(e, t, n = 0, a = e.length) {
		let o = i(e, t, n, a - 1);
		return o > n && r(e[o - 1], t) > -r(e[o], t) ? o - 1 : o;
	}
	return {
		left: i,
		center: o,
		right: a
	};
}
function Dp() {
	return 0;
}
//#endregion
//#region node_modules/d3-array/src/number.js
function Op(e) {
	return e === null ? NaN : +e;
}
//#endregion
//#region node_modules/d3-array/src/bisect.js
var kp = Ep(wp), Ap = kp.right;
kp.left, Ep(Op).center;
//#endregion
//#region node_modules/d3-array/src/ticks.js
var jp = Math.sqrt(50), Mp = Math.sqrt(10), Np = Math.sqrt(2);
function Pp(e, t, n) {
	let r = (t - e) / Math.max(0, n), i = Math.floor(Math.log10(r)), a = r / 10 ** i, o = a >= jp ? 10 : a >= Mp ? 5 : a >= Np ? 2 : 1, s, c, l;
	return i < 0 ? (l = 10 ** -i / o, s = Math.round(e * l), c = Math.round(t * l), s / l < e && ++s, c / l > t && --c, l = -l) : (l = 10 ** i * o, s = Math.round(e / l), c = Math.round(t / l), s * l < e && ++s, c * l > t && --c), c < s && .5 <= n && n < 2 ? Pp(e, t, n * 2) : [
		s,
		c,
		l
	];
}
function Fp(e, t, n) {
	if (t = +t, e = +e, n = +n, !(n > 0)) return [];
	if (e === t) return [e];
	let r = t < e, [i, a, o] = r ? Pp(t, e, n) : Pp(e, t, n);
	if (!(a >= i)) return [];
	let s = a - i + 1, c = Array(s);
	if (r) {
		if (o < 0) for (let e = 0; e < s; ++e) c[e] = (a - e) / -o;
		else for (let e = 0; e < s; ++e) c[e] = (a - e) * o;
	} else if (o < 0) for (let e = 0; e < s; ++e) c[e] = (i + e) / -o;
	else for (let e = 0; e < s; ++e) c[e] = (i + e) * o;
	return c;
}
function Ip(e, t, n) {
	return t = +t, e = +e, n = +n, Pp(e, t, n)[2];
}
function Lp(e, t, n) {
	t = +t, e = +e, n = +n;
	let r = t < e, i = r ? Ip(t, e, n) : Ip(e, t, n);
	return (r ? -1 : 1) * (i < 0 ? 1 / -i : i);
}
//#endregion
//#region src/lib/context-river/vertical-scale.ts
function Rp(e, t, n) {
	if (e.length === 0 || !Number.isFinite(t) || !Number.isFinite(n)) return {
		maxWeight: 0,
		visibleCallCount: 0,
		usesInterpolatedEdge: !1
	};
	let r = e, i = Math.min(t, n), a = Math.max(t, n), o = Wp(r, i), s = Gp(r, a), c = Kp(r, i), l = Kp(r, a), u = Math.max(0, c.weight, l.weight);
	for (let e = o; e < s; e += 1) u = Math.max(u, r[e].totalDisplayWeight);
	return {
		maxWeight: u,
		visibleCallCount: Math.max(0, s - o),
		usesInterpolatedEdge: c.interpolated || l.interpolated
	};
}
function zp(e, t = 4, n = .06) {
	if (!Number.isFinite(e) || e <= 0) return [0];
	let r = e * (1 - n);
	return [
		0,
		...Fp(0, e, Math.max(1, Math.floor(t))).filter((e) => e > 0 && e < r),
		e
	];
}
var Bp = new Intl.NumberFormat(void 0, {
	notation: "compact",
	maximumFractionDigits: 1
}), Vp = new Intl.NumberFormat(void 0, { maximumFractionDigits: 1 }), Hp = new Intl.NumberFormat(void 0, { maximumFractionDigits: 0 });
function Up(e) {
	return Number.isFinite(e) ? Math.abs(e) >= 1e3 ? Bp.format(e) : Number.isInteger(e) ? Hp.format(e) : Vp.format(e) : "—";
}
function Wp(e, t) {
	let n = 0, r = e.length;
	for (; n < r;) {
		let i = Math.floor((n + r) / 2);
		e[i].x < t ? n = i + 1 : r = i;
	}
	return n;
}
function Gp(e, t) {
	let n = 0, r = e.length;
	for (; n < r;) {
		let i = Math.floor((n + r) / 2);
		e[i].x <= t ? n = i + 1 : r = i;
	}
	return n;
}
function Kp(e, t) {
	let n = e[0], r = e[e.length - 1];
	if (t <= n.x) return {
		weight: Math.max(0, n.totalDisplayWeight),
		interpolated: !1
	};
	if (t >= r.x) return {
		weight: Math.max(0, r.totalDisplayWeight),
		interpolated: !1
	};
	let i = Wp(e, t), a = e[i];
	if (Math.abs(a.x - t) < 1e-8) return {
		weight: Math.max(0, a.totalDisplayWeight),
		interpolated: !1
	};
	let o = e[i - 1], s = a.x - o.x;
	if (s <= 0) return {
		weight: Math.max(0, a.totalDisplayWeight),
		interpolated: !1
	};
	let c = Math.min(1, Math.max(0, (t - o.x) / s));
	return {
		weight: Math.max(0, o.totalDisplayWeight + (a.totalDisplayWeight - o.totalDisplayWeight) * c),
		interpolated: !0
	};
}
//#endregion
//#region src/lib/context-river/EventGlyph.svelte
var qp = /* @__PURE__ */ Rr("<rect x=\"1\" y=\"1\" rx=\"4\" class=\"glyph-compaction svelte-1kmdkag\"></rect><text text-anchor=\"middle\" class=\"svelte-1kmdkag\">C</text>", 1), Jp = /* @__PURE__ */ Rr("<path class=\"glyph-target svelte-1kmdkag\"></path><text text-anchor=\"middle\" class=\"svelte-1kmdkag\">M</text>", 1), Yp = /* @__PURE__ */ Rr("<circle class=\"glyph-ratio svelte-1kmdkag\"></circle><text text-anchor=\"middle\" class=\"svelte-1kmdkag\"> </text>", 1), Xp = /* @__PURE__ */ Rr("<g><!></g>"), Zp = /* @__PURE__ */ Rr("<svg><!></svg>"), Qp = {
	hash: "svelte-1kmdkag",
	code: ".event-glyph-svg.svelte-1kmdkag {display:inline-block;flex:0 0 auto;overflow:visible;vertical-align:middle;}.event-glyph-svg.svelte-1kmdkag text:where(.svelte-1kmdkag) {fill:var(--active-text);font:750 9px ui-sans-serif,\n      system-ui,\n      sans-serif;pointer-events:none;}.event-glyph-svg-compaction.svelte-1kmdkag text:where(.svelte-1kmdkag) {fill:var(--event-compaction-text);}.event-glyph-svg-ratioChange.svelte-1kmdkag text:where(.svelte-1kmdkag) {fill:var(--event-warning-text);}.event-glyph-svg.rise.svelte-1kmdkag text:where(.svelte-1kmdkag) {fill:var(--event-success-text);}.glyph-compaction.svelte-1kmdkag {fill:var(--event-compaction-fill);stroke:var(--compaction);stroke-width:1.25;}.glyph-target.svelte-1kmdkag {fill:var(--action);stroke:var(--event-target);stroke-width:1.25;}.glyph-ratio.svelte-1kmdkag {fill:var(--event-warning);stroke:var(--page);stroke-width:1.25;}.event-glyph-svg.rise.svelte-1kmdkag .glyph-ratio:where(.svelte-1kmdkag) {fill:var(--event-success);}"
};
function $p(e, t) {
	li(e, Qp);
	let n = X(t, "direction", 3, void 0), r = X(t, "size", 3, 22), i = X(t, "label", 3, void 0), a = X(t, "svg", 3, !1), o = X(t, "x", 3, void 0), s = X(t, "y", 3, void 0);
	var c = Br(), l = R(c), u = (e) => {
		var a = Xp(), c = L(a), l = (e) => {
			var t = qp(), n = R(t), i = B(n);
			V(() => {
				Y(n, "width", r() - 2), Y(n, "height", r() - 2), Y(i, "x", r() / 2), Y(i, "y", r() / 2 + 4);
			}), G(e, t);
		}, u = (e) => {
			var t = Jp(), n = R(t), i = B(n);
			V(() => {
				Y(n, "d", `M ${r() / 2} 1 l ${r() / 2 - 1} ${r() / 2 - 1} l -${r() / 2 - 1} ${r() / 2 - 1} l -${r() / 2 - 1} -${r() / 2 - 1} Z`), Y(i, "x", r() / 2), Y(i, "y", r() / 2 + 4);
			}), G(e, t);
		}, d = (e) => {
			var t = Yp(), i = R(t), a = B(i), o = z(a, !0);
			V(() => {
				Y(i, "cx", r() / 2), Y(i, "cy", r() / 2), Y(i, "r", r() / 2 - 2), Y(a, "x", r() / 2), Y(a, "y", r() / 2 + 4), K(o, n() === "drop" ? "↓" : "↑");
			}), G(e, t);
		};
		q(c, (e) => {
			t.kind === "compaction" ? e(l) : t.kind === "targetChange" ? e(u, 1) : e(d, -1);
		}), M(a), V(() => {
			gi(a, 0, `event-glyph-svg event-glyph-svg-${t.kind} ${n() ?? ""}`, "svelte-1kmdkag"), Y(a, "transform", `translate(${o() ?? 0} ${s() ?? 0})`), Y(a, "aria-label", i());
		}), G(e, a);
	}, d = (e) => {
		var a = Zp(), o = L(a), s = (e) => {
			var t = qp(), n = R(t), i = B(n);
			V(() => {
				Y(n, "width", r() - 2), Y(n, "height", r() - 2), Y(i, "x", r() / 2), Y(i, "y", r() / 2 + 4);
			}), G(e, t);
		}, c = (e) => {
			var t = Jp(), n = R(t), i = B(n);
			V(() => {
				Y(n, "d", `M ${r() / 2} 1 l ${r() / 2 - 1} ${r() / 2 - 1} l -${r() / 2 - 1} ${r() / 2 - 1} l -${r() / 2 - 1} -${r() / 2 - 1} Z`), Y(i, "x", r() / 2), Y(i, "y", r() / 2 + 4);
			}), G(e, t);
		}, l = (e) => {
			var t = Yp(), i = R(t), a = B(i), o = z(a, !0);
			V(() => {
				Y(i, "cx", r() / 2), Y(i, "cy", r() / 2), Y(i, "r", r() / 2 - 2), Y(a, "x", r() / 2), Y(a, "y", r() / 2 + 4), K(o, n() === "drop" ? "↓" : "↑");
			}), G(e, t);
		};
		q(o, (e) => {
			t.kind === "compaction" ? e(s) : t.kind === "targetChange" ? e(c, 1) : e(l, -1);
		}), M(a), V(() => {
			gi(a, 0, `event-glyph-svg event-glyph-svg-${t.kind} ${n() ?? ""}`, "svelte-1kmdkag"), Y(a, "width", r()), Y(a, "height", r()), Y(a, "viewBox", `0 0 ${r()} ${r()}`), Y(a, "aria-label", i()), Y(a, "aria-hidden", i() ? void 0 : "true"), Y(a, "role", i() ? "img" : void 0);
		}), G(e, a);
	};
	q(l, (e) => {
		a() ? e(u) : e(d, -1);
	}), G(e, c);
}
//#endregion
//#region src/lib/context-river/event-clustering.ts
var em = {
	compaction: "compaction",
	targetChange: "model/provider change",
	ratioChange: "cache-share change"
};
function tm(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e) {
		let e = em[n.kind];
		t.set(e, (t.get(e) ?? 0) + 1);
	}
	let n = [...t.entries()].sort(([e], [t]) => e.localeCompare(t)).map(([e, t]) => `${t} ${e}${t === 1 ? "" : "s"}`).join(" · ");
	return `${e.length} economics event${e.length === 1 ? "" : "s"} · ${n}`;
}
function nm(e) {
	let t = {
		compaction: "C",
		targetChange: "M",
		ratioChange: "Δ"
	}, n = /* @__PURE__ */ new Map();
	for (let r of e) {
		let e = t[r.kind];
		n.set(e, (n.get(e) ?? 0) + 1);
	}
	return `${e.length} · ${[...n.entries()].sort(([e], [t]) => e.localeCompare(t)).map(([e, t]) => `${e}${t}`).join(" ")}`;
}
function rm(e) {
	let t = [...new Set(e.map((e) => e.callIndex))].sort((e, t) => e - t), n = [];
	for (let e of t) {
		let t = n[n.length - 1];
		if (!t) {
			n.push(String(e));
			continue;
		}
		let [r, i = r] = t.split("-").map(Number);
		e === i + 1 ? n[n.length - 1] = `${r}-${e}` : n.push(String(e));
	}
	return n.join(", ");
}
function im(e, t) {
	return e.length === 1 ? t : Math.max(46, 14 + nm(e).length * 7.2);
}
function am(e, t) {
	let n = im(e, t.markerSize), r = Math.max(1, t.chartWidth - t.left - t.right), i = Math.min(n + 16, r), a = Math.min(n, i), o = e.reduce((e, t) => e + t.x, 0) / e.length, s = Math.max(t.left + i / 2, Math.min(t.chartWidth - t.right - i / 2, o));
	return {
		id: `event-cluster-${e[0]?.id ?? "empty"}`,
		x: s,
		anchorX: o,
		events: e,
		badgeWidth: a,
		hitWidth: i,
		left: s - i / 2,
		right: s + i / 2,
		compositionLabel: tm(e),
		badgeLabel: nm(e),
		callRanges: rm(e)
	};
}
function om(e, t) {
	let n = {
		chartWidth: Math.max(0, t.chartWidth),
		left: Math.max(0, t.left),
		right: Math.max(0, t.right),
		markerSize: t.markerSize ?? 22,
		collisionGap: t.collisionGap ?? 6
	}, r = [...e].sort((e, t) => e.x - t.x || e.id.localeCompare(t.id)), i = [];
	for (let e of r) {
		let t = am([e], n), r = i[i.length - 1];
		r && t.left < r.right + n.collisionGap ? i[i.length - 1] = am([...r.events, e], n) : i.push(t);
	}
	for (let e = 1; e < i.length;) {
		let t = i[e - 1], r = i[e];
		t && r && r.left < t.right + n.collisionGap ? (i.splice(e - 1, 2, am([...t.events, ...r.events], n)), e = Math.max(1, e - 1)) : e += 1;
	}
	return i;
}
//#endregion
//#region src/lib/context-river/EconomicsTrack.svelte
var sm = /* @__PURE__ */ Rr("<line class=\"track-gridline svelte-18b1ucv\"></line><text class=\"track-y-label svelte-18b1ucv\" text-anchor=\"end\"> </text>", 1), cm = /* @__PURE__ */ Rr("<rect class=\"event-count-badge svelte-18b1ucv\" rx=\"5\"></rect><text class=\"event-count svelte-18b1ucv\" text-anchor=\"middle\"> </text>", 1), lm = /* @__PURE__ */ Rr("<g role=\"button\" tabindex=\"0\"><title> </title><rect class=\"event-hit svelte-18b1ucv\" rx=\"5\"></rect><!></g>"), um = /* @__PURE__ */ Rr("<rect></rect>"), dm = /* @__PURE__ */ Rr("<circle class=\"zero-mark svelte-18b1ucv\" r=\"3\"></circle>"), fm = /* @__PURE__ */ Rr("<rect class=\"missing-mark svelte-18b1ucv\" width=\"8\" height=\"8\"></rect>"), pm = /* @__PURE__ */ Rr("<path class=\"uncertain-mark svelte-18b1ucv\"></path>"), mm = /* @__PURE__ */ Rr("<line class=\"track-pin svelte-18b1ucv\"></line>"), hm = /* @__PURE__ */ Rr("<line class=\"track-hover svelte-18b1ucv\"></line>"), gm = /* @__PURE__ */ Rr("<g role=\"button\"><title> </title><!><!><!></g>"), _m = /* @__PURE__ */ Rr("<line class=\"cost-range svelte-18b1ucv\"></line>"), vm = /* @__PURE__ */ Rr("<line></line><circle r=\"3.5\"></circle>", 1), ym = /* @__PURE__ */ Rr("<circle r=\"3.5\"></circle>"), bm = /* @__PURE__ */ Rr("<g role=\"button\"><title> </title><!><!><!><!></g>"), xm = /* @__PURE__ */ W("<div class=\"track-shell svelte-18b1ucv\" role=\"presentation\"><svg class=\"economics-track-svg svelte-18b1ucv\" role=\"group\"><defs><pattern id=\"economics-write-pattern\" width=\"6\" height=\"6\" patternUnits=\"userSpaceOnUse\" patternTransform=\"rotate(45)\"><rect width=\"6\" height=\"6\" fill=\"var(--cache-write)\"></rect><path d=\"M0 0V6\" stroke=\"var(--cache-write-mark)\" stroke-width=\"1.5\" opacity=\".7\"></path></pattern><pattern id=\"economics-fresh-pattern\" width=\"6\" height=\"6\" patternUnits=\"userSpaceOnUse\"><rect width=\"6\" height=\"6\" fill=\"var(--cache-fresh)\"></rect><circle cx=\"2\" cy=\"2\" r=\"1\" fill=\"var(--cache-fresh-mark)\"></circle></pattern><pattern id=\"economics-nonread-pattern\" width=\"7\" height=\"7\" patternUnits=\"userSpaceOnUse\" patternTransform=\"rotate(45)\"><rect width=\"7\" height=\"7\" fill=\"var(--cache-nonread)\"></rect><path d=\"M0 0V7\" stroke=\"var(--cache-nonread-mark)\" stroke-width=\"1.5\" opacity=\".8\"></path></pattern></defs><rect class=\"track-background svelte-18b1ucv\" x=\"0\" y=\"0\"></rect><rect class=\"track-plot svelte-18b1ucv\"></rect><!><g class=\"track-event-header svelte-18b1ucv\" aria-label=\"Economics event annotations\"><text class=\"svelte-18b1ucv\">Events</text></g><g class=\"track-event-lane svelte-18b1ucv\" aria-label=\"Economics event lane\"><rect class=\"svelte-18b1ucv\"></rect><!></g><!></svg></div>"), Sm = {
	hash: "svelte-18b1ucv",
	code: ".track-shell.svelte-18b1ucv {position:relative;min-width:0;}.economics-track-svg.svelte-18b1ucv {display:block;max-width:none;background:var(--plot);touch-action:pan-y;}.track-background.svelte-18b1ucv {fill:var(--plot);pointer-events:none;}.track-plot.svelte-18b1ucv {fill:var(--plot);pointer-events:none;}.track-gridline.svelte-18b1ucv {stroke:var(--separator);stroke-width:0.75;opacity:0.7;pointer-events:none;}.track-event-header.svelte-18b1ucv {fill:var(--muted);font-size:var(--text-xs);pointer-events:none;}.track-event-header.svelte-18b1ucv text:where(.svelte-18b1ucv):first-child {fill:var(--text);font-weight:750;}.track-event-lane.svelte-18b1ucv {pointer-events:all;}.track-event-lane.svelte-18b1ucv > rect:where(.svelte-18b1ucv) {fill:none;stroke:none;pointer-events:none;}.track-event-trigger.svelte-18b1ucv {cursor:pointer;pointer-events:all;outline:none;}.event-hit.svelte-18b1ucv {fill:transparent;stroke:transparent;stroke-width:2;pointer-events:all;}.event-count-badge.svelte-18b1ucv {stroke-width:1.25;fill:var(--action);stroke:var(--text);}.event-count.svelte-18b1ucv {fill:var(--active-text);font-size:var(--text-xs);font-weight:750;pointer-events:none;}.track-event-trigger.svelte-18b1ucv:focus-visible .event-hit:where(.svelte-18b1ucv) {fill:var(--action);fill-opacity:0.35;stroke:var(--selection);stroke-width:2.5;}.track-y-label.svelte-18b1ucv {fill:var(--text);font-size:9px;pointer-events:none;}.economics-mark.svelte-18b1ucv {cursor:pointer;outline:none;}.cache-segment.svelte-18b1ucv {stroke:var(--plot);stroke-width:0.6;}.cache-segment.cacheRead.svelte-18b1ucv {fill:var(--cache-read);}.cache-segment.cacheWrite.svelte-18b1ucv {fill:url(#economics-write-pattern);}.cache-segment.fresh.svelte-18b1ucv,\n  .cache-segment.uncached.svelte-18b1ucv {fill:url(#economics-fresh-pattern);}.cache-segment.nonRead.svelte-18b1ucv {fill:url(#economics-nonread-pattern);}.economics-mark.zero.svelte-18b1ucv .zero-mark:where(.svelte-18b1ucv) {fill:var(--plot);stroke:var(--text);stroke-width:1.5;}.uncertain-mark.svelte-18b1ucv {fill:var(--surface-raised);stroke:var(--warning);stroke-width:1.5;}.economics-mark.partial.svelte-18b1ucv .uncertain-mark:where(.svelte-18b1ucv) {fill:var(--surface-raised);stroke:var(--warning);}.economics-mark.unsupported.svelte-18b1ucv .uncertain-mark:where(.svelte-18b1ucv) {fill:var(--error-surface);stroke:var(--error);stroke-dasharray:2 1;}.missing-mark.svelte-18b1ucv {fill:none;stroke:var(--cache-nonread-mark);stroke-dasharray:2 1;stroke-width:1.5;}.cost-stem.svelte-18b1ucv {stroke:var(--cost);stroke-width:1.5;}.cost-stem.partial.svelte-18b1ucv {stroke:var(--warning);stroke-dasharray:3 2;}.cost-dot.svelte-18b1ucv {fill:var(--cost);stroke:var(--plot);stroke-width:1;}.cost-dot.partial.svelte-18b1ucv {stroke:var(--warning);stroke-width:2;}.cost-zero.svelte-18b1ucv {fill:var(--plot);stroke:var(--cost);stroke-width:1.5;}.cost-zero.partial.svelte-18b1ucv {stroke:var(--warning);stroke-dasharray:2 1;}\n  /* API-equivalent costs are not charges: hollow marks in a separate colour. */.api-equivalent.svelte-18b1ucv .cost-stem:where(.svelte-18b1ucv) {stroke:var(--api-cost);stroke-dasharray:3 2;}.api-equivalent.svelte-18b1ucv .cost-dot:where(.svelte-18b1ucv) {fill:var(--plot);stroke:var(--api-cost);stroke-width:1.5;}.api-equivalent.svelte-18b1ucv .cost-zero:where(.svelte-18b1ucv) {stroke:var(--api-cost);}.cost-range.svelte-18b1ucv {stroke:var(--cost);stroke-width:4;stroke-linecap:round;opacity:0.45;}.api-equivalent.svelte-18b1ucv .cost-range:where(.svelte-18b1ucv) {stroke:var(--api-cost);}.track-pin.svelte-18b1ucv {stroke:var(--selection);stroke-width:1.5;pointer-events:none;}.track-hover.svelte-18b1ucv {stroke:var(--secondary);stroke-width:1;stroke-dasharray:3 3;pointer-events:none;}.economics-mark.svelte-18b1ucv:focus-visible .cache-segment:where(.svelte-18b1ucv),\n  .economics-mark.svelte-18b1ucv:focus-visible .cost-dot:where(.svelte-18b1ucv),\n  .economics-mark.svelte-18b1ucv:focus-visible .cost-zero:where(.svelte-18b1ucv),\n  .economics-mark.svelte-18b1ucv:focus-visible .zero-mark:where(.svelte-18b1ucv),\n  .economics-mark.svelte-18b1ucv:focus-visible .uncertain-mark:where(.svelte-18b1ucv) {stroke:var(--selection);stroke-width:2.5;}"
};
function Cm(e, t) {
	Be(t, !0), li(e, Sm);
	let n, r = X(t, "cacheView", 3, "tokens"), i = X(t, "onReadoutChange", 3, () => {}), a = X(t, "onEventBreakdownChange", 3, () => {}), o = Cp();
	Tn(() => o.observeIdentity(t.indexed)), Bi(() => o.dispose());
	let s = /* @__PURE__ */ P(() => t.mode === "cost" ? 190 : 262), c = /* @__PURE__ */ P(() => t.mode === "cost" ? 116 : 188), l = /* @__PURE__ */ P(() => H(c) + 16 + 2), u = /* @__PURE__ */ P(() => Math.max(44, H(s) - H(l) - 10)), d = /* @__PURE__ */ P(() => H(l) + H(u) / 2), f = {
		top: 14,
		right: 24,
		bottom: 62,
		left: 42
	}, p = /* @__PURE__ */ P(() => t.mode === "cache" ? 180 : 108), m = /* @__PURE__ */ P(() => H(p) - f.top), h = /* @__PURE__ */ F(null), g = "", _ = "", v = /* @__PURE__ */ P(() => Bl(t.indexed.analysis.session.source)), y = /* @__PURE__ */ P(() => t.mode === "cache" ? wu(t.indexed.analysis) : null), b = /* @__PURE__ */ P(() => t.mode === "cost" ? Du(t.indexed.analysis) : null), x = /* @__PURE__ */ P(() => new Map(H(y)?.points.map((e) => [e.callIndex, e]) ?? [])), S = /* @__PURE__ */ P(() => H(y)?.maximum ?? H(b)?.maximum ?? 0), C = /* @__PURE__ */ P(() => t.mode === "cost" ? H(S) > 0 ? H(S) : 1 : r() === "share" ? 100 : Math.max(1, H(S))), w = /* @__PURE__ */ P(() => new Map(t.columns.map((e) => [e.callIndex, e]))), ee = /* @__PURE__ */ P(() => le(t.indexed.analysis.compactions, t.columns, t.width)), T = /* @__PURE__ */ P(() => ue(t.indexed.analysis.modelCalls, t.columns)), E = /* @__PURE__ */ P(() => new Map(H(T).map((e) => [e.callIndex, e]))), te = /* @__PURE__ */ P(() => t.columns.length < 2 ? 14 : t.columns.reduce((e, n, r) => r === 0 ? e : Math.min(e, n.x - t.columns[r - 1].x), Infinity)), D = /* @__PURE__ */ P(() => Math.max(1.5, Math.min(12, H(te) * .68))), O = /* @__PURE__ */ P(() => zp(t.mode === "cache" && r() === "share" ? 100 : H(S), 3, .25)), k = /* @__PURE__ */ P(() => H(O).map((e) => ({
		value: e,
		y: f.top + H(m) * (1 - e / H(C))
	}))), ne = /* @__PURE__ */ P(() => H(y) ? A(H(y), H(w), {
		cacheView: r(),
		domainMaximum: H(C),
		baseline: H(p),
		innerHeight: H(m),
		targetChangesByCall: H(E),
		usageMappingLabel: H(v)
	}) : []), re = /* @__PURE__ */ P(() => H(b) ? ve(H(b), H(w), {
		domainMaximum: H(C),
		baseline: H(p),
		innerHeight: H(m),
		targetChangesByCall: H(E)
	}) : []), ie = /* @__PURE__ */ P(() => de(H(ee), H(T), H(y), H(w))), ae = /* @__PURE__ */ P(() => om(H(ie), {
		chartWidth: t.width,
		left: f.left,
		right: f.right,
		markerSize: 22,
		collisionGap: 6
	})), oe = /* @__PURE__ */ P(() => H(ae).find((e) => e.id === H(h)) ?? null);
	Tn(() => {
		if (H(oe)) {
			let e = JSON.stringify({
				id: H(oe).id,
				x: H(oe).x,
				events: H(oe).events.map((e) => ({
					id: e.id,
					kind: e.kind,
					callIndex: e.callIndex,
					x: e.x,
					label: e.label,
					direction: e.direction,
					magnitude: e.magnitude
				}))
			});
			if (e === _) return;
			_ = e;
			let t = {
				id: H(oe).id,
				events: H(oe).events,
				callIndices: [...new Set(H(oe).events.map((e) => e.callIndex))].sort((e, t) => e - t),
				anchorX: H(oe).x,
				anchorY: H(d),
				laneTop: H(l),
				laneHeight: H(u)
			};
			yr(() => a()(t));
		} else _ !== "" && (_ = "", yr(() => a()(null)));
	});
	let se = /* @__PURE__ */ P(() => t.hoveredCallIndex ?? t.pinnedCallIndex), ce = /* @__PURE__ */ P(() => H(se) === null ? "" : _e(H(se)));
	Tn(() => {
		if (H(ce) === g) return;
		g = H(ce);
		let e = H(ce);
		yr(() => i()(e));
	});
	function le(e, t, n) {
		let r = new Map(t.map((e) => [e.callIndex, e.x])), i = t.slice(1).map((e, n) => e.x - t[n].x), a = i.length > 0 ? i.reduce((e, t) => Math.min(e, t), Infinity) : Math.max(0, n - f.left - f.right), o = Math.max(0, n - f.left - f.right);
		return e.map((e) => {
			let t = r.get(e.beforeModelCall), n = r.get(e.beforeModelCall - 1), i = t !== void 0 && n !== void 0 ? (n + t) / 2 : t === void 0 ? f.left + o : t - Math.min(a / 2, 16);
			return {
				callIndex: e.beforeModelCall,
				x: i,
				label: `Compaction before call ${e.beforeModelCall}`
			};
		});
	}
	function ue(e, t) {
		let n = new Map(t.map((e) => [e.callIndex, e.x]));
		return e.flatMap((t, r) => {
			let i = e[r - 1], a = n.get(t.index);
			if (!i || a === void 0 || i.provider === t.provider && i.model === t.model && i.api === t.api) return [];
			let o = `${i.provider ?? "Unknown"} / ${i.model ?? "Unknown"} / ${i.api ?? "Unknown API"}`, s = `${t.provider ?? "Unknown"} / ${t.model ?? "Unknown"} / ${t.api ?? "Unknown API"}`;
			return [{
				callIndex: t.index,
				x: a,
				label: `Model / provider change (Target changes from ${o} to ${s})`
			}];
		});
	}
	function de(e, t, n, r) {
		let i = [];
		for (let t of e) i.push({
			id: `compaction-${t.callIndex}`,
			kind: "compaction",
			callIndex: t.callIndex,
			x: t.x,
			label: t.label
		});
		for (let e of t) i.push({
			id: `target-${e.callIndex}`,
			kind: "targetChange",
			callIndex: e.callIndex,
			x: e.x,
			label: `${e.label} at call ${e.callIndex}`
		});
		if (n) for (let e of n.points) {
			let t = e.discontinuity, n = r.get(e.callIndex)?.x;
			t && n !== void 0 && i.push({
				id: `ratio-${e.callIndex}`,
				kind: "ratioChange",
				callIndex: e.callIndex,
				x: n,
				direction: t.direction,
				magnitude: t.magnitude,
				label: Cu(t, e.callIndex)
			});
		}
		return i.sort((e, t) => e.x - t.x || e.id.localeCompare(t.id));
	}
	function fe(e) {
		return `${e.label} · call ${e.callIndex}`;
	}
	Cn(() => {
		if (H(h) !== null && !H(ae).some((e) => e.id === H(h))) {
			let e = H(h);
			I(h, null), o.focusAfterUpdate(() => he(e), () => H(h) === null);
		}
	});
	function pe(e) {
		let t = e.id;
		I(h, t, !0), o.focusAfterUpdate(() => Vi(n).getElementById(`${t}-close`), () => H(h) === t);
	}
	function me(e = !0) {
		let t = H(h);
		I(h, null), o.cancel(), e && t && o.focusAfterUpdate(() => he(t), () => H(h) === null);
	}
	function he(e) {
		return Vi(n).getElementById(e) ?? Vi(n).querySelector(".economics-track-header button");
	}
	function ge(e, t) {
		(e.key === "Enter" || e.key === " ") && (e.preventDefault(), pe(t));
	}
	function _e(e) {
		let n = t.indexed.callByIndex.get(e);
		if (!n) return "";
		if (t.mode === "cache") {
			let i = H(x).get(e);
			if (!i || i.status !== "complete" && i.status !== "zero") return `Call ${e} · ${i?.note ?? "Cache data unavailable"}`;
			let a = i.segments.map((e) => `${e.label} ${Q(e.value)}`).join(" · "), o = i.shareStatus === "complete" ? `${Ce(i)} · ${H(v)} denominator of ${Q(i.shareDenominator ?? 0)} prompt tokens` : Ce(i), s = n.economics.promptTokens, c = n.economics.cacheReadRatio, l = s === null || s <= 0 ? "cache-read share unavailable; prompt-token denominator is zero or unavailable" : c === null ? `cache-read share unavailable of ${Q(s)} prompt tokens` : `cache-read share ${Ha(c)} of ${Q(s)} prompt tokens`, u = n.costAssessment.amount === null ? "" : ` · ${Jl(n.costAssessment, t.indexed.analysis.session.source)} cost ${Xl(n.costAssessment)} USD`;
			return `Call ${e}${t.pinnedCallIndex === e && t.hoveredCallIndex !== e ? " · pinned" : ""} · ${a} · ${t.mode === "cache" && r() === "share" ? `${o} · ` : ""}${l}${u}`;
		}
		return n.costAssessment.amount === null ? `Call ${e} · cost unavailable` : `Call ${e} · ${Jl(n.costAssessment, t.indexed.analysis.session.source)} cost ${Xl(n.costAssessment)} USD`;
	}
	function A(e, t, n) {
		return e.points.flatMap((e) => {
			let r = t.get(e.callIndex)?.x;
			return r === void 0 ? [] : [j(e, r, n)];
		});
	}
	function ve(e, t, n) {
		return e.points.flatMap((e) => {
			let r = t.get(e.callIndex)?.x;
			return r === void 0 ? [] : [be(e, r, n)];
		});
	}
	function j(e, n, { cacheView: r, domainMaximum: i, baseline: a, innerHeight: o, targetChangesByCall: s, usageMappingLabel: c }) {
		let l = a, u = (r === "share" ? e.shareSegments : e.segments).map((e) => {
			let t = r === "share" && "percentage" in e ? e.percentage : e.value, n = t / i * o, a = l - n;
			return l = a, {
				...e,
				displayValue: t,
				y: a,
				height: n
			};
		}), d = t.indexed.callByIndex.get(e.callIndex), f = e.segments.map((e) => `${e.label} ${Q(e.value)}`).join(" · "), p = Ce(e), m = d ? Va(d.economics.cacheReadRatio) : "Unknown", h = d?.economics.promptTokens === null || d?.economics.promptTokens === void 0 ? `${c} prompt-token denominator unavailable` : `${c} denominator of ${Q(d.economics.promptTokens)} prompt tokens`, g = e.discontinuity, _ = s.get(e.callIndex)?.label, v = _ ? ` · ${_}.` : "", y = g ? ` · ${Cu(g, e.callIndex)} (${(g.delta * 100).toFixed(1)} percentage points, ${g.magnitude})` : "", b = r === "share" ? ` · ${p} · ${h}` : "", x = e.status === "complete" || e.status === "zero";
		return {
			point: e,
			x: n,
			segments: u,
			labelDetail: x ? ` · prompt ${Q(e.promptTokens ?? 0)} tokens · ${f}${b} · cache-read share ${m} ${h}${e.note ? ` · ${e.note}` : ""}${v}${y}` : ` · ${e.note}`,
			showsPin: x
		};
	}
	function ye(e, t, n) {
		let r = e.point.callIndex;
		return `Call ${r}${e.showsPin && t === r && n !== r ? " · pinned" : ""}${e.labelDetail}`;
	}
	function be(e, n, { domainMaximum: r, baseline: i, innerHeight: a, targetChangesByCall: o }) {
		let s = (e) => e === null ? i : i - e / r * a, c = s(e.total), l = e.high === null ? null : s(e.high), u = o.get(e.callIndex)?.label, d = u ? ` · ${u}.` : "", f = t.indexed.callByIndex.get(e.callIndex)?.costAssessment, p = e.kind === "recorded" ? ` · cost components ${e.componentStatus}` : "";
		return {
			point: e,
			x: n,
			y: c,
			yHigh: l,
			ariaLabel: (e.status === "known" || e.status === "zero") && f ? `Call ${e.callIndex} · ${Jl(f, t.indexed.analysis.session.source)} cost ${Xl(f)} USD${p}${d}` : e.status === "partial" ? `Call ${e.callIndex} · cost unavailable · some recorded cost components are present` : `Call ${e.callIndex} · cost unavailable`
		};
	}
	function xe(e) {
		return r() === "share" ? `${e.toFixed(0)}%` : Up(e);
	}
	function Se(e) {
		return Ra(e);
	}
	function Ce(e) {
		return e.shareStatus === "complete" ? e.shareSegments.map((e) => `${e.label} ${Ha(e.percentage / 100)}`).join(" · ") : e.shareStatus === "zeroPrompt" ? "share undefined: zero prompt tokens" : "share unavailable: incomplete or unsupported usage";
	}
	function we(e) {
		Vi(n).getElementById(`economics-call-${e}`)?.focus();
	}
	function Te(e, n) {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault(), t.onPinCall(n);
			return;
		}
		let r = t.indexed.analysis.modelCalls, i = r.findIndex((e) => e.index === n), a = i;
		if (e.key === "ArrowLeft") a = Math.max(0, i - 1);
		else if (e.key === "ArrowRight") a = Math.min(r.length - 1, i + 1);
		else if (e.key === "Home") a = 0;
		else if (e.key === "End") a = r.length - 1;
		else return;
		e.preventDefault();
		let o = r[a];
		o && (I(Ee, o.index), t.onHoverCall(o.index), we(o.index));
	}
	let Ee = /* @__PURE__ */ P(() => t.pinnedCallIndex ?? t.indexed.analysis.modelCalls[0]?.index ?? null);
	var De = { closeEventBreakdown: me }, Oe = xm(), ke = L(Oe), Ae = B(L(ke)), je = B(Ae), Me = B(je);
	J(Me, 17, () => H(k), $r, (e, n) => {
		var r = sm(), i = R(r), a = B(i), o = z(a, !0);
		V((e) => {
			Y(i, "x1", f.left), Y(i, "x2", t.width - f.right), Y(i, "y1", H(n).y), Y(i, "y2", H(n).y), Y(a, "x", f.left - 5), Y(a, "y", H(n).y + 3), K(o, e);
		}, [() => t.mode === "cache" ? xe(H(n).value) : Se(H(n).value)]), G(e, r);
	});
	var Ne = B(Me), Pe = z(Ne), Fe = B(Ne), N = L(Fe);
	J(B(N), 17, () => H(ae), (e) => e.id, (e, t) => {
		let n = /* @__PURE__ */ P(() => H(t).events[0]);
		var r = lm();
		let i;
		var a = L(r), o = z(a), s = B(a), c = B(s), f = (e) => {
			{
				let r = /* @__PURE__ */ P(() => H(t).x - 11), i = /* @__PURE__ */ P(() => H(d) - 11), a = /* @__PURE__ */ P(() => H(n).kind === "compaction" ? "Compaction" : H(n).kind === "targetChange" ? "Model / provider change" : `Cache-share ${H(n).direction === "drop" ? "drop" : "rise"}`);
				$p(e, {
					svg: !0,
					get kind() {
						return H(n).kind;
					},
					get direction() {
						return H(n).direction;
					},
					size: 22,
					get x() {
						return H(r);
					},
					get y() {
						return H(i);
					},
					get label() {
						return H(a);
					}
				});
			}
		}, p = (e) => {
			var n = cm(), r = R(n);
			Y(r, "height", 22);
			var i = B(r), a = z(i, !0);
			V(() => {
				Y(r, "x", H(t).x - H(t).badgeWidth / 2), Y(r, "y", H(d) - 11), Y(r, "width", H(t).badgeWidth), Y(i, "x", H(t).x), Y(i, "y", H(d) + 4), K(a, H(t).badgeLabel);
			}), G(e, n);
		};
		q(c, (e) => {
			H(t).events.length === 1 ? e(f) : e(p, -1);
		}), M(r), V((e, a) => {
			Y(r, "id", H(t).id), i = gi(r, 0, `track-event-trigger ${H(t).events.length === 1 ? "track-event-singleton" : "track-event-cluster"} track-${H(n)?.kind ?? "cluster"} ${H(n)?.kind === "compaction" ? "track-compaction-marker" : H(n)?.kind === "targetChange" ? "track-target-change" : H(n)?.kind === "ratioChange" ? "track-ratioChange ratio-change-marker" : ""}`, "svelte-18b1ucv", i, {
				rise: H(n)?.direction === "rise",
				large: H(n)?.magnitude === "large"
			}), Y(r, "aria-label", e), K(o, `${H(t).compositionLabel ?? ""} at calls ${H(t).callRanges ?? ""} ·
            ${a ?? ""}`), Y(s, "x", H(t).x - H(t).hitWidth / 2), Y(s, "y", H(l) + 6), Y(s, "width", H(t).hitWidth), Y(s, "height", H(u) - 12);
		}, [() => H(t).events.length === 1 ? `${fe(H(n))}; activate for details` : `${H(t).compositionLabel} at calls ${H(t).callRanges}; activate for breakdown`, () => H(t).events.map((e) => fe(e)).join("; ")]), U("click", r, (e) => {
			e.stopPropagation(), pe(H(t));
		}), U("keydown", r, (e) => ge(e, H(t))), G(e, r);
	}), M(Fe);
	var Ie = B(Fe), Le = (e) => {
		var n = Br();
		J(R(n), 17, () => H(ne), (e) => e.point.callIndex, (e, n) => {
			var r = gm();
			let i;
			var a = L(r), o = z(a, !0), s = B(a), c = (e) => {
				var t = Br();
				J(R(t), 19, () => H(n).segments, (e, t) => `${e.kind}-${t}`, (e, t) => {
					var r = Br(), i = R(r), a = (e) => {
						var r = um();
						V(() => {
							gi(r, 0, `cache-segment ${H(t).kind}`, "svelte-18b1ucv"), Y(r, "x", H(n).x - H(D) / 2), Y(r, "y", H(t).y), Y(r, "width", H(D)), Y(r, "height", H(t).height);
						}), G(e, r);
					};
					q(i, (e) => {
						H(t).height > 0 && e(a);
					}), G(e, r);
				}), G(e, t);
			}, l = (e) => {
				var t = dm();
				V(() => {
					Y(t, "cx", H(n).x), Y(t, "cy", H(p) - 2);
				}), G(e, t);
			}, u = (e) => {
				var t = fm();
				V(() => {
					Y(t, "x", H(n).x - 4), Y(t, "y", H(p) - 7);
				}), G(e, t);
			}, d = (e) => {
				var t = pm();
				V(() => Y(t, "d", `M ${H(n).x} ${H(p) - 8} l 5 5 l -5 5 l -5 -5 Z`)), G(e, t);
			};
			q(s, (e) => {
				H(n).point.status === "complete" ? e(c) : H(n).point.status === "zero" ? e(l, 1) : H(n).point.status === "missing" ? e(u, 2) : e(d, -1);
			});
			var m = B(s), h = (e) => {
				var t = mm();
				V(() => {
					Y(t, "x1", H(n).x), Y(t, "x2", H(n).x), Y(t, "y1", f.top), Y(t, "y2", H(p));
				}), G(e, t);
			};
			q(m, (e) => {
				t.pinnedCallIndex === H(n).point.callIndex && e(h);
			});
			var g = B(m), _ = (e) => {
				var t = hm();
				V(() => {
					Y(t, "x1", H(n).x), Y(t, "x2", H(n).x), Y(t, "y1", f.top), Y(t, "y2", H(p));
				}), G(e, t);
			};
			q(g, (e) => {
				t.hoveredCallIndex === H(n).point.callIndex && e(_);
			}), M(r), V((e, a) => {
				Y(r, "id", `economics-call-${H(n).point.callIndex}`), i = gi(r, 0, "economics-mark cache-mark svelte-18b1ucv", null, i, {
					partial: H(n).point.status === "partial",
					missing: H(n).point.status === "missing",
					unsupported: H(n).point.status === "unsupported",
					zero: H(n).point.status === "zero",
					pinned: t.pinnedCallIndex === H(n).point.callIndex,
					hovered: t.hoveredCallIndex === H(n).point.callIndex
				}), Y(r, "tabindex", H(Ee) === H(n).point.callIndex ? 0 : -1), Y(r, "aria-label", e), Y(r, "aria-current", t.pinnedCallIndex === H(n).point.callIndex ? "true" : void 0), K(o, a);
			}, [() => ye(H(n), t.pinnedCallIndex, t.hoveredCallIndex), () => ye(H(n), t.pinnedCallIndex, t.hoveredCallIndex)]), Or("pointerenter", r, () => t.onHoverCall(H(n).point.callIndex)), Or("pointerleave", r, () => t.onHoverCall(null)), Or("focus", r, () => t.onHoverCall(H(n).point.callIndex)), U("keydown", r, (e) => Te(e, H(n).point.callIndex)), U("click", r, (e) => t.onMarkClick(e, H(n).point.callIndex)), G(e, r);
		}), G(e, n);
	}, Re = (e) => {
		var n = Br();
		J(R(n), 17, () => H(re), (e) => e.point.callIndex, (e, n) => {
			var r = bm();
			let i;
			var a = L(r), o = z(a, !0), s = B(a), c = (e) => {
				var t = _m();
				V(() => {
					Y(t, "x1", H(n).x), Y(t, "x2", H(n).x), Y(t, "y1", H(n).y), Y(t, "y2", H(n).yHigh);
				}), G(e, t);
			};
			q(s, (e) => {
				H(n).point.status === "known" && H(n).yHigh !== null && e(c);
			});
			var l = B(s), u = (e) => {
				var t = vm(), r = R(t);
				let i;
				var a = B(r);
				let o;
				V(() => {
					i = gi(r, 0, "cost-stem svelte-18b1ucv", null, i, { partial: H(n).point.componentStatus === "partial" }), Y(r, "x1", H(n).x), Y(r, "x2", H(n).x), Y(r, "y1", H(p)), Y(r, "y2", H(n).y), o = gi(a, 0, "cost-dot svelte-18b1ucv", null, o, { partial: H(n).point.componentStatus === "partial" }), Y(a, "cx", H(n).x), Y(a, "cy", H(n).y);
				}), G(e, t);
			}, d = (e) => {
				var t = ym();
				let r;
				V(() => {
					r = gi(t, 0, "cost-zero svelte-18b1ucv", null, r, { partial: H(n).point.componentStatus === "partial" }), Y(t, "cx", H(n).x), Y(t, "cy", H(p) - 2);
				}), G(e, t);
			}, m = (e) => {
				var t = pm();
				V(() => Y(t, "d", `M ${H(n).x} ${H(p) - 8} l 5 5 l -5 5 l -5 -5 Z`)), G(e, t);
			}, h = (e) => {
				var t = fm();
				V(() => {
					Y(t, "x", H(n).x - 4), Y(t, "y", H(p) - 7);
				}), G(e, t);
			};
			q(l, (e) => {
				H(n).point.status === "known" ? e(u) : H(n).point.status === "zero" ? e(d, 1) : H(n).point.status === "partial" ? e(m, 2) : e(h, -1);
			});
			var g = B(l), _ = (e) => {
				var t = mm();
				V(() => {
					Y(t, "x1", H(n).x), Y(t, "x2", H(n).x), Y(t, "y1", f.top), Y(t, "y2", H(p));
				}), G(e, t);
			};
			q(g, (e) => {
				t.pinnedCallIndex === H(n).point.callIndex && e(_);
			});
			var v = B(g), y = (e) => {
				var t = hm();
				V(() => {
					Y(t, "x1", H(n).x), Y(t, "x2", H(n).x), Y(t, "y1", f.top), Y(t, "y2", H(p));
				}), G(e, t);
			};
			q(v, (e) => {
				t.hoveredCallIndex === H(n).point.callIndex && e(y);
			}), M(r), V(() => {
				Y(r, "id", `economics-call-${H(n).point.callIndex}`), i = gi(r, 0, "economics-mark cost-mark svelte-18b1ucv", null, i, {
					partial: H(n).point.status === "partial" || H(n).point.componentStatus === "partial",
					missing: H(n).point.status === "missing",
					zero: H(n).point.status === "zero",
					"api-equivalent": H(n).point.kind === "apiEquivalent",
					pinned: t.pinnedCallIndex === H(n).point.callIndex,
					hovered: t.hoveredCallIndex === H(n).point.callIndex
				}), Y(r, "tabindex", H(Ee) === H(n).point.callIndex ? 0 : -1), Y(r, "aria-label", H(n).ariaLabel), Y(r, "aria-current", t.pinnedCallIndex === H(n).point.callIndex ? "true" : void 0), K(o, H(n).ariaLabel);
			}), Or("pointerenter", r, () => t.onHoverCall(H(n).point.callIndex)), Or("focus", r, () => t.onHoverCall(H(n).point.callIndex)), U("keydown", r, (e) => Te(e, H(n).point.callIndex)), U("click", r, (e) => t.onMarkClick(e, H(n).point.callIndex)), G(e, r);
		}), G(e, n);
	};
	return q(Ie, (e) => {
		t.mode === "cache" ? e(Le) : e(Re, -1);
	}), M(ke), M(Oe), Li(Oe, (e) => n = e, () => n), V((e, n) => {
		vi(Oe, `width:${t.width}px`), Y(ke, "viewBox", `0 0 ${t.width} ${H(s)}`), Y(ke, "width", t.width), Y(ke, "height", H(s)), Y(ke, "aria-label", t.mode === "cache" ? "Cache usage track. One keyboard stop; use left and right arrows to inspect calls." : "Cost track. One keyboard stop; use left and right arrows to inspect calls."), Y(Ae, "width", t.width), Y(Ae, "height", H(s)), Y(je, "x", f.left), Y(je, "y", f.top), Y(je, "width", e), Y(je, "height", H(m)), Y(Pe, "x", f.left + 4), Y(Pe, "y", H(c) + 12), Y(N, "x", f.left), Y(N, "y", H(l)), Y(N, "width", n), Y(N, "height", H(u));
	}, [() => Math.max(0, t.width - f.left - f.right), () => Math.max(0, t.width - f.left - f.right)]), Or("pointerleave", Oe, () => t.onHoverCall(null)), G(e, Oe), Ve(De);
}
kr(["click", "keydown"]);
//#endregion
//#region src/lib/context-river/EconomicsBreakdown.svelte
var wm = /* @__PURE__ */ W("<li class=\"svelte-51gj1f\"><span class=\"event-list-label svelte-51gj1f\"><!> </span> <button type=\"button\" class=\"svelte-51gj1f\"> </button></li>"), Tm = /* @__PURE__ */ W("<div class=\"event-breakdown svelte-51gj1f\" role=\"dialog\" tabindex=\"-1\" aria-label=\"Economics event breakdown\"><div class=\"event-breakdown-header svelte-51gj1f\"><strong> </strong> <button type=\"button\" aria-label=\"Close event breakdown\" class=\"svelte-51gj1f\">×</button></div> <button type=\"button\" class=\"zoom-events-button\">Zoom to these calls</button> <ul class=\"svelte-51gj1f\"></ul></div>"), Em = {
	hash: "svelte-51gj1f",
	code: ".event-breakdown.svelte-51gj1f {position:fixed;z-index:6;width:min(300px, calc(100vw - 16px));max-height:min(220px, calc(100vh - 16px));overflow:auto;padding:8px;color:var(--text);background:var(--surface);border:1px solid var(--control-border);border-radius:var(--control-radius);box-shadow:0 8px 24px var(--shadow);}.event-breakdown-header.svelte-51gj1f,\n  li.svelte-51gj1f {display:flex;align-items:start;justify-content:space-between;gap:8px;}.event-breakdown-header.svelte-51gj1f {color:var(--text-strong);font-size:var(--text-sm);}.event-breakdown-header.svelte-51gj1f button:where(.svelte-51gj1f) {padding:1px 6px;font-size:var(--text-lg);line-height:1.1;}ul.svelte-51gj1f {display:grid;gap:7px;margin:7px 0 0;padding:0;list-style:none;font-size:var(--text-xs);}li.svelte-51gj1f > span:where(.svelte-51gj1f) {min-width:0;overflow-wrap:anywhere;}.event-list-label.svelte-51gj1f {display:inline-flex;align-items:center;gap:4px;}li.svelte-51gj1f button:where(.svelte-51gj1f) {flex:0 0 auto;padding:3px 6px;font-size:10px;white-space:nowrap;}\n  @container highwater (max-width: 620px) {.event-breakdown.svelte-51gj1f {position:static;width:100%;max-height:180px;margin:8px 0 0;}\n  }"
};
function Dm(e, t) {
	Be(t, !0), li(e, Em);
	let n = X(t, "element", 15, null), r = X(t, "positionStyle", 3, "");
	function i(e) {
		e.key === "Escape" && (e.preventDefault(), e.stopPropagation(), t.onClose());
	}
	var a = Tm(), o = L(a), s = L(o), c = z(s), l = B(s, 2);
	M(o);
	var u = B(o, 2), d = B(u, 2);
	J(d, 21, () => t.breakdown.events, (e) => e.id, (e, n) => {
		var r = wm(), i = L(r), a = L(i);
		$p(a, {
			get kind() {
				return H(n).kind;
			},
			get direction() {
				return H(n).direction;
			},
			size: 18
		});
		var o = B(a);
		M(i);
		var s = B(i, 2), c = z(s);
		M(r), V(() => {
			K(o, `${H(n).label ?? ""} · call
          ${H(n).callIndex ?? ""}`), K(c, `Inspect call ${H(n).callIndex ?? ""}`);
		}), U("click", s, () => t.onInspect(H(n).callIndex)), G(e, r);
	}), M(d), M(a), Li(a, (e) => n(e), () => n()), V((e) => {
		vi(a, r()), K(c, `${t.breakdown.events.length ?? ""}
      ${t.breakdown.events.length === 1 ? "event" : "events"} · calls ${e ?? ""}`), Y(l, "id", `${t.breakdown.id}-close`), u.disabled = !t.canZoomIn || t.breakdown.callIndices.length === 0;
	}, [() => t.breakdown.callIndices.join(", ")]), U("keydown", a, i), U("click", l, function(...e) {
		t.onClose?.apply(this, e);
	}), U("click", u, function(...e) {
		t.onZoom?.apply(this, e);
	}), G(e, a), Ve();
}
kr(["keydown", "click"]);
//#endregion
//#region src/lib/context-river/GroupBreakdown.svelte
var Om = /* @__PURE__ */ W("<li> </li>"), km = /* @__PURE__ */ W("<p class=\"svelte-17hzezc\">Showing the first 12 members.</p>"), Am = /* @__PURE__ */ W("<div class=\"group-breakdown svelte-17hzezc\" role=\"dialog\" tabindex=\"-1\"><div class=\"event-breakdown-header svelte-17hzezc\"><strong> </strong> <button id=\"group-breakdown-close\" type=\"button\" aria-label=\"Close item type breakdown\" class=\"svelte-17hzezc\">×</button></div> <p class=\"svelte-17hzezc\"> </p> <ul class=\"svelte-17hzezc\"></ul> <!> <button type=\"button\">Show items here</button></div>"), jm = {
	hash: "svelte-17hzezc",
	code: ".group-breakdown.svelte-17hzezc {position:fixed;box-sizing:border-box;z-index:6;width:min(340px, calc(100vw - 16px));max-height:min(220px, calc(100vh - 16px));overflow:auto;padding:9px;color:var(--text);background:var(--surface);border:1px solid var(--control-border);border-radius:var(--control-radius);box-shadow:0 8px 24px var(--shadow);}.event-breakdown-header.svelte-17hzezc {display:flex;align-items:start;justify-content:space-between;gap:8px;color:var(--text-strong);font-size:var(--text-sm);}.event-breakdown-header.svelte-17hzezc button:where(.svelte-17hzezc) {padding:1px 6px;font-size:var(--text-lg);line-height:1.1;}p.svelte-17hzezc {margin:7px 0;color:var(--text);font-size:var(--text-xs);}ul.svelte-17hzezc {max-height:150px;overflow:auto;margin:7px 0;padding-left:18px;color:var(--text);font-size:var(--text-xs);}"
};
function Mm(e, t) {
	Be(t, !0), li(e, jm);
	let n, r = /* @__PURE__ */ F(340), i = /* @__PURE__ */ F(220), a = /* @__PURE__ */ F(1280), o = /* @__PURE__ */ F(800), s = /* @__PURE__ */ P(() => Math.max(8, Math.min(t.anchor.x + 8, H(a) - H(r) - 8))), c = /* @__PURE__ */ P(() => Math.max(8, Math.min(t.anchor.y + 8, H(o) - H(i) - 8)));
	zi(() => {
		let e = () => {
			I(a, window.innerWidth, !0), I(o, window.innerHeight, !0);
			let e = n.getBoundingClientRect();
			I(r, e.width, !0), I(i, e.height, !0);
		}, s = n.closest(".chart-frame")?.querySelector("[data-testid=\"river-host\"]"), c = {
			x: window.scrollX,
			y: window.scrollY,
			left: s?.scrollLeft,
			top: s?.scrollTop
		}, l = (e) => {
			e.target instanceof Node && n.contains(e.target) || (window.scrollX !== c.x || window.scrollY !== c.y || s?.scrollLeft !== c.left || s?.scrollTop !== c.top) && t.onClose();
		}, u = new ResizeObserver(e);
		return u.observe(n), e(), window.addEventListener("resize", e), window.addEventListener("scroll", l, !0), () => {
			u.disconnect(), window.removeEventListener("resize", e), window.removeEventListener("scroll", l, !0);
		};
	});
	function l(e) {
		e.key === "Escape" && (e.preventDefault(), e.stopPropagation(), t.onClose());
	}
	var u = Am();
	let d;
	var f = L(u), p = L(f), m = z(p), h = B(p, 2);
	M(f);
	var g = B(f, 2), _ = z(g), v = B(g, 2);
	J(v, 21, () => t.memberLabels, $r, (e, t, n, r) => {
		var i = Om(), a = z(i, !0);
		V(() => K(a, H(t))), G(e, i);
	}), M(v);
	var y = B(v, 2), b = (e) => {
		G(e, km());
	};
	q(y, (e) => {
		t.memberCount > 12 && e(b);
	});
	var x = B(y, 2);
	M(u), Li(u, (e) => n = e, () => n), V(() => {
		Y(u, "aria-label", `Item type ${t.label} breakdown`), d = vi(u, "", d, {
			left: `${H(s)}px`,
			top: `${H(c)}px`
		}), K(m, `Item type: ${t.label ?? ""}`), K(_, `${t.memberCount ?? ""}
    ${t.memberCount === 1 ? "member" : "members"}${t.callIndex === null ? "" : ` at call ${t.callIndex}`}.`);
	}), U("keydown", u, l), U("click", h, function(...e) {
		t.onClose?.apply(this, e);
	}), U("click", x, function(...e) {
		t.onShowItems?.apply(this, e);
	}), G(e, u), Ve();
}
kr(["keydown", "click"]);
//#endregion
//#region src/lib/context-river/overlay-position.ts
function Nm(e) {
	return e.querySelector(".economics-track-svg");
}
function Pm(e, t) {
	let n = Nm(e);
	if (!n) return null;
	let r = n.getBoundingClientRect(), i = Number(n.getAttribute("width")) || n.viewBox.baseVal.width, a = i > 0 ? r.width / i : 1, o = n.viewBox.baseVal.height > 0 ? r.height / n.viewBox.baseVal.height : 1;
	return {
		x: r.left + t.anchorX * a,
		y: r.top + t.anchorY * o
	};
}
function Fm(e, t) {
	let n = Pm(e, t);
	if (!n) return !1;
	let r = e.getBoundingClientRect(), i = e.parentElement?.getBoundingClientRect(), a = Math.max(0, r.left, i?.left ?? -Infinity), o = Math.min(window.innerWidth, r.right, i?.right ?? Infinity), s = Math.max(0, r.top, i?.top ?? -Infinity), c = Math.min(window.innerHeight, r.bottom, i?.bottom ?? Infinity);
	return o >= a && c >= s && n.x >= a && n.x <= o && n.y >= s && n.y <= c;
}
function Im(e, t, n) {
	if (!n || !t || window.innerWidth <= 620) return "";
	let r = Pm(e, n), i = Nm(e);
	if (!r || !i) return "";
	let a = i.getBoundingClientRect(), o = t.getBoundingClientRect(), s = e.getBoundingClientRect(), c = Math.min(300, Math.max(120, o.width || 300)), l = o.height || 160, u = Math.max(8, s.left + 8), d = Math.max(u, Math.min(window.innerWidth - c - 8, s.right - c - 8)), f = Math.max(u, Math.min(d, r.x - c / 2)), p = i.viewBox.baseVal.height > 0 ? a.height / i.viewBox.baseVal.height : 1, m = a.top + n.laneTop * p, h = a.top + (n.laneTop + n.laneHeight) * p + 8, g = m - l - 8;
	return `left:${f}px;top:${h + l <= window.innerHeight - 8 ? h : g >= 8 ? g : Math.max(8, Math.min(window.innerHeight - l - 8, h))}px;width:${c}px`;
}
//#endregion
//#region src/lib/context-river/EconomicsControls.svelte
var Lm = /* @__PURE__ */ W("<div class=\"toggle-group cache-view-toggle\" role=\"group\" aria-label=\"Cache view\"><span class=\"toggle-label\">Cache view</span> <button type=\"button\">Tokens</button> <button type=\"button\">Share (%)</button><!></div>"), Rm = /* @__PURE__ */ W("<div class=\"economics-track-controls svelte-1x8cxwu\"><div class=\"toggle-group\" role=\"group\" aria-label=\"Economics track\"><span class=\"toggle-label\">Economics</span> <button type=\"button\">Cache</button> <button type=\"button\">Cost</button> <button type=\"button\">Off</button></div> <!> <span class=\"track-title svelte-1x8cxwu\"> </span></div>"), zm = /* @__PURE__ */ W("<span class=\"svelte-1x8cxwu\"><i></i> </span>"), Bm = /* @__PURE__ */ W("<span class=\"legend-muted svelte-1x8cxwu\">No supported numeric cache categories</span>"), Vm = /* @__PURE__ */ W("<span class=\"inline-availability svelte-1x8cxwu\"> </span>"), Hm = /* @__PURE__ */ W("<div class=\"track-legend-group svelte-1x8cxwu\" aria-label=\"Token categories\"><span class=\"legend-group-title svelte-1x8cxwu\">Token categories</span> <div class=\"track-legend svelte-1x8cxwu\"></div></div> <!>", 1), Um = /* @__PURE__ */ W("<span class=\"svelte-1x8cxwu\"><i class=\"swatch api-equivalent svelte-1x8cxwu\"></i>API-equivalent (subscription) · USD</span>"), Wm = /* @__PURE__ */ W("<div class=\"track-legend-group svelte-1x8cxwu\" aria-label=\"Cost values\"><span class=\"legend-group-title svelte-1x8cxwu\">Cost values</span> <div class=\"track-legend svelte-1x8cxwu\"><span class=\"svelte-1x8cxwu\"><i class=\"swatch cost svelte-1x8cxwu\"></i>Billed · USD</span> <!></div></div>"), Gm = /* @__PURE__ */ W("<span class=\"svelte-1x8cxwu\"><!>Share rise/drop</span>"), Km = /* @__PURE__ */ W("<p class=\"availability-summary svelte-1x8cxwu\"> </p>"), qm = /* @__PURE__ */ W("<div class=\"track-legend-groups essential-legend svelte-1x8cxwu\"><!></div> <details class=\"economics-legend svelte-1x8cxwu\"><summary class=\"disclosure svelte-1x8cxwu\">Key</summary> <div class=\"track-legend-group svelte-1x8cxwu\" aria-label=\"Events\"><span class=\"legend-group-title svelte-1x8cxwu\">Events</span> <div class=\"track-legend svelte-1x8cxwu\"><!> <span class=\"svelte-1x8cxwu\"><!>Compaction</span> <span class=\"svelte-1x8cxwu\"><!>Model / provider change</span></div></div> <div class=\"track-legend-group svelte-1x8cxwu\" aria-label=\"Data quality\"><span class=\"legend-group-title svelte-1x8cxwu\">Data quality</span> <div class=\"track-legend svelte-1x8cxwu\"><span class=\"svelte-1x8cxwu\"><i class=\"swatch uncertain svelte-1x8cxwu\"></i>Partial / unsupported</span> <span class=\"svelte-1x8cxwu\"><i class=\"swatch missing svelte-1x8cxwu\"></i>Missing</span> <span class=\"svelte-1x8cxwu\"><i class=\"swatch zero svelte-1x8cxwu\"></i>Measured zero</span></div></div> <!></details>", 1), Jm = /* @__PURE__ */ W("<div class=\"economics-track-header svelte-1x8cxwu\" role=\"group\" aria-label=\"Economics track controls and legend\"><button class=\"economics-disclosure disclosure svelte-1x8cxwu\" type=\"button\" aria-controls=\"economics-expanded\"><span>Cache &amp; cost</span></button> <div id=\"economics-expanded\"><!> <!></div></div>"), Ym = {
	hash: "svelte-1x8cxwu",
	code: ".economics-disclosure.svelte-1x8cxwu {justify-self:start;display:inline-flex;align-items:center;gap:6px;min-height:28px;padding:4px 0;border:0;border-radius:0;background:transparent;color:var(--secondary);font:inherit;font-size:var(--text-md);}.economics-disclosure.svelte-1x8cxwu:hover {background:transparent;color:var(--text);}.economics-track-header.svelte-1x8cxwu {position:sticky;left:0;z-index:3;display:grid;width:100%;gap:6px;margin:0 0 8px;padding:8px 0;border:0;border-top:1px solid var(--separator);border-radius:0;background:var(--surface);}.economics-track-controls.svelte-1x8cxwu {display:flex;flex-wrap:wrap;align-items:center;gap:7px 14px;color:var(--text);font-size:var(--text-sm);}.economics-legend.svelte-1x8cxwu {min-width:0;color:var(--text);font-size:var(--text-xs);}.economics-legend[open].svelte-1x8cxwu {padding-top:2px;}.economics-legend.svelte-1x8cxwu summary:where(.svelte-1x8cxwu) {width:fit-content;color:var(--secondary);cursor:pointer;}\n  /* Matches the River's legend: 12px text, with each group's title leading its items. */.track-legend-groups.svelte-1x8cxwu {display:flex;flex-wrap:wrap;align-items:start;gap:8px 18px;padding-top:6px;color:var(--text);font-size:var(--text-sm);}.essential-legend.svelte-1x8cxwu {padding:2px 0 0;}.legend-muted.svelte-1x8cxwu,\n  .availability-summary.svelte-1x8cxwu {color:var(--secondary);}.inline-availability.svelte-1x8cxwu {align-self:center;max-width:38rem;color:var(--warning);line-height:1.35;}.availability-summary.svelte-1x8cxwu {margin:6px 0;line-height:1.4;}.track-title.svelte-1x8cxwu {min-width:0;color:var(--text);font-weight:650;overflow-wrap:anywhere;}.track-legend-group.svelte-1x8cxwu {display:flex;flex-wrap:wrap;align-items:center;gap:5px 12px;min-width:0;}.legend-group-title.svelte-1x8cxwu {color:var(--text-strong);font-weight:650;}.track-legend.svelte-1x8cxwu {display:flex;flex-wrap:wrap;gap:5px 12px;align-items:center;}.track-legend.svelte-1x8cxwu span:where(.svelte-1x8cxwu) {display:inline-flex;align-items:center;gap:4px;max-width:100%;overflow-wrap:anywhere;}.swatch.svelte-1x8cxwu {display:inline-block;width:10px;height:10px;border:1px solid var(--text);border-radius:var(--radius-small);flex:0 0 auto;}.swatch.read.svelte-1x8cxwu,\n  .swatch.cacheRead.svelte-1x8cxwu {background:var(--cache-read);}.swatch.write.svelte-1x8cxwu,\n  .swatch.cacheWrite.svelte-1x8cxwu {background:repeating-linear-gradient(\n      135deg,\n      var(--cache-write) 0 3px,\n      var(--cache-write-mark) 3px 4px\n    );}.swatch.fresh.svelte-1x8cxwu {background:radial-gradient(circle, var(--cache-fresh-mark) 1px, var(--cache-fresh) 1.5px);}.swatch.nonread.svelte-1x8cxwu,\n  .swatch.nonRead.svelte-1x8cxwu {background:repeating-linear-gradient(\n      135deg,\n      var(--cache-nonread) 0 3px,\n      var(--cache-nonread-mark) 3px 4px\n    );}.swatch.uncached.svelte-1x8cxwu {background:radial-gradient(circle, var(--cache-fresh-mark) 1px, var(--cache-fresh) 1.5px);}.swatch.uncertain.svelte-1x8cxwu {background:transparent;border-color:var(--warning);transform:rotate(45deg) scale(0.78);}.swatch.change-rise.svelte-1x8cxwu,\n  .swatch.change-drop.svelte-1x8cxwu {display:inline-flex;align-items:center;justify-content:center;width:14px;border:0;color:var(--event-warning-text);background:var(--event-warning);font-size:10px;font-style:normal;font-weight:800;line-height:1;}.swatch.change-drop.svelte-1x8cxwu {margin-left:-4px;}.swatch.compaction.svelte-1x8cxwu,\n  .swatch.target.svelte-1x8cxwu {display:inline-flex;width:16px;justify-content:center;border-color:var(--accent);background:var(--action);color:var(--active-text);font-size:7px;font-style:normal;font-weight:750;}.swatch.target.svelte-1x8cxwu {border-radius:0;transform:rotate(45deg) scale(0.8);}.swatch.missing.svelte-1x8cxwu {background:transparent;border-style:dashed;}.swatch.zero.svelte-1x8cxwu {border-radius:50%;background:transparent;}.swatch.cost.svelte-1x8cxwu {border-radius:50%;background:var(--cost);}.swatch.api-equivalent.svelte-1x8cxwu {border-radius:50%;background:transparent;border-color:var(--api-cost);}\n  @container highwater (max-width: 620px) {.economics-track-controls.svelte-1x8cxwu {align-items:start;}.track-legend.svelte-1x8cxwu {gap:5px 9px;}\n  }"
};
function Xm(e, t) {
	Be(t, !0), li(e, Ym);
	let n = X(t, "hasApiEquivalentCost", 3, !1), r = X(t, "headerElement", 15), i = X(t, "triggerElement", 15);
	var a = Jm(), o = L(a);
	Li(o, (e) => i(e), () => i());
	var s = B(o, 2), c = L(s), l = (e) => {
		var n = Rm(), r = L(n), i = B(L(r), 2), a = B(i, 2), o = B(a, 2);
		Y(o, "aria-pressed", !1), M(r);
		var s = B(r, 2), c = (e) => {
			var n = Lm(), r = B(L(n), 2), i = B(r, 2);
			_a(B(i), {
				id: "cache-share-note",
				label: "About Share (%)",
				children: (e, t) => {
					xe(), G(e, zr("Shows cache reads, cache writes and fresh input as shares of each call's input\n              tokens. Calls with missing, partial or zero input are marked, not drawn as zero."));
				},
				$$slots: { default: !0 }
			}), M(n), V(() => {
				Y(r, "aria-pressed", t.cacheView === "tokens"), Y(i, "aria-pressed", t.cacheView === "share");
			}), U("click", r, () => t.onCacheViewChange("tokens")), U("click", i, () => t.onCacheViewChange("share")), G(e, n);
		};
		q(s, (e) => {
			t.mode === "cache" && e(c);
		});
		var l = z(B(s, 2), !0);
		M(n), V(() => {
			Y(i, "aria-pressed", t.mode === "cache"), Y(a, "aria-pressed", t.mode === "cost"), K(l, t.mode === "cache" ? t.cacheView === "share" ? "Cache share per call · share of each call's input · fixed 0–100% axis" : "Prompt tokens per call · session-wide scale" : t.mode === "cost" ? "Cost per call · USD · session-wide scale · recorded or estimated, not invoices" : "Economics off · details remain available in the inspector");
		}), U("click", i, () => t.onModeChange("cache")), U("click", a, () => t.onModeChange("cost")), U("click", o, () => t.onModeChange("off")), G(e, n);
	};
	q(c, (e) => {
		t.mode !== "off" && e(l);
	});
	var u = B(c, 2), d = (e) => {
		var r = qm(), i = R(r), a = L(i), o = (e) => {
			var n = Hm(), r = R(n), i = B(L(r), 2);
			J(i, 21, () => t.cachePresentation.categories, (e) => e.kind, (e, t) => {
				var n = zm(), r = L(n), i = B(r);
				M(n), V(() => {
					gi(r, 1, `swatch ${H(t).kind}`, "svelte-1x8cxwu"), K(i, `${H(t).label ?? ""}${H(t).availability === "measuredZero" ? " · 0 in this session" : ""}`);
				}), G(e, n);
			}, (e) => {
				G(e, Bm());
			}), M(i), M(r), J(B(r, 2), 17, () => t.cachePresentation.notes, $r, (e, t) => {
				var n = Vm(), r = z(n, !0);
				V(() => K(r, H(t))), G(e, n);
			}), G(e, n);
		}, s = (e) => {
			var t = Wm(), r = B(L(t), 2), i = B(L(r), 2), a = (e) => {
				G(e, Um());
			};
			q(i, (e) => {
				n() && e(a);
			}), M(r), M(t), G(e, t);
		};
		q(a, (e) => {
			t.mode === "cache" ? e(o) : e(s, -1);
		}), M(i);
		var c = B(i, 2), l = B(L(c), 2), u = B(L(l), 2), d = L(u), f = (e) => {
			var t = Gm();
			$p(L(t), {
				kind: "ratioChange",
				direction: "rise",
				size: 16
			}), xe(), M(t), G(e, t);
		};
		q(d, (e) => {
			t.mode === "cache" && e(f);
		});
		var p = B(d, 2);
		$p(L(p), {
			kind: "compaction",
			size: 16
		}), xe(), M(p);
		var m = B(p, 2);
		$p(L(m), {
			kind: "targetChange",
			size: 16
		}), xe(), M(m), M(u), M(l);
		var h = B(l, 4), g = (e) => {
			var n = Km(), r = z(n);
			V(() => K(r, `Billed calls show the cost the harness recorded, or an estimate at the provider's rate
            when it recorded none. Subscription calls show what they would have cost at the lab's
            API rate; that is not a charge. A shaded bar marks a range. ${t.costCopy.note ?? ""}
            Unavailable values are not zero.`)), G(e, n);
		};
		q(h, (e) => {
			t.mode === "cost" && e(g);
		}), M(c), G(e, r);
	};
	q(u, (e) => {
		t.mode !== "off" && e(d);
	}), M(s), M(a), Li(a, (e) => r(e), () => r()), V(() => {
		Y(o, "aria-expanded", t.mode !== "off"), Y(s, "hidden", t.mode === "off");
	}), U("pointerdown", a, (e) => e.stopPropagation()), U("click", a, (e) => e.stopPropagation()), U("click", o, () => t.onModeChange(t.mode === "off" ? t.lastMode : "off")), G(e, a), Ve();
}
kr(["pointerdown", "click"]);
//#endregion
//#region src/lib/context-river/hit-testing.ts
function Zm(e, t) {
	if (t.length === 0) return null;
	let n = 0, r = t.length;
	for (; n < r;) {
		let i = Math.floor((n + r) / 2);
		t[i].x < e ? n = i + 1 : r = i;
	}
	if (n === 0) return t[0].callIndex;
	if (n === t.length) return t[t.length - 1]?.callIndex ?? null;
	let i = t[n - 1], a = t[n];
	return e - i.x <= a.x - e ? i.callIndex : a.callIndex;
}
function Qm(e, t, n, r) {
	return n <= 0 ? 0 : (e - t) / n * r;
}
//#endregion
//#region src/lib/context-river/axis-labels.ts
function $m(e) {
	return String(e).length * 7;
}
function eh(e, t) {
	return ($m(e.callIndex) + $m(t.callIndex)) / 2 + 8;
}
function th(e, t) {
	return Math.abs(e.x - t.x) < eh(e, t);
}
function nh(e, t, n) {
	if (e.length === 0) return /* @__PURE__ */ new Set();
	let r = Number.isFinite(t) && t > 0 ? t : 1, i = e.length < 2 ? Infinity : e.reduce((t, n, r) => r === 0 ? t : Math.min(t, n.x - (e[r - 1]?.x ?? n.x)), Infinity), a = i < r ? Math.ceil(r / Math.max(1, i)) : 1, o = /* @__PURE__ */ new Set([0, e.length - 1]);
	if (n !== null) {
		let t = e.findIndex((e) => e.callIndex === n);
		t >= 0 && o.add(t);
	}
	let s = (t) => e[t]?.callIndex === n && n !== null ? 0 : t === 0 || t === e.length - 1 ? 1 : 2, c = [];
	for (let t of [...o].sort((t, n) => s(t) - s(n) || (e[t]?.x ?? 0) - (e[n]?.x ?? 0))) {
		let n = e[t];
		n && c.every((t) => {
			let r = e[t];
			return r !== void 0 && !th(n, r);
		}) && c.push(t);
	}
	c.sort((t, n) => (e[t]?.x ?? 0) - (e[n]?.x ?? 0));
	let l = new Set(c), u = new Set(o);
	for (let t = 0; t < e.length; t += a) u.add(t);
	let d = [...u].sort((t, n) => (e[t]?.x ?? 0) - (e[n]?.x ?? 0)), f = /* @__PURE__ */ new Set(), p = null, m = 0;
	for (let t of d) {
		let n = e[t];
		if (!n) continue;
		for (; m < c.length && (e[c[m]]?.x ?? Infinity) < n.x;) p = c[m], m += 1;
		if (l.has(t)) {
			f.add(t), p = t, c[m] === t && (m += 1);
			continue;
		}
		if (o.has(t)) continue;
		let r = p === null ? void 0 : e[p], i = c[m] === void 0 ? void 0 : e[c[m]];
		r && th(n, r) || i && th(n, i) || (f.add(t), p = t);
	}
	return f;
}
//#endregion
//#region node_modules/d3-scale/src/init.js
function rh(e, t) {
	switch (arguments.length) {
		case 0: break;
		case 1:
			this.range(e);
			break;
		default: this.range(t).domain(e);
	}
	return this;
}
//#endregion
//#region node_modules/d3-color/src/define.js
function ih(e, t, n) {
	e.prototype = t.prototype = n, n.constructor = e;
}
function ah(e, t) {
	var n = Object.create(e.prototype);
	for (var r in t) n[r] = t[r];
	return n;
}
//#endregion
//#region node_modules/d3-color/src/color.js
function oh() {}
var sh = .7, ch = 1 / sh, lh = "\\s*([+-]?\\d+)\\s*", uh = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*", dh = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*", fh = /^#([0-9a-f]{3,8})$/, ph = RegExp(`^rgb\\(${lh},${lh},${lh}\\)$`), mh = RegExp(`^rgb\\(${dh},${dh},${dh}\\)$`), hh = RegExp(`^rgba\\(${lh},${lh},${lh},${uh}\\)$`), gh = RegExp(`^rgba\\(${dh},${dh},${dh},${uh}\\)$`), _h = RegExp(`^hsl\\(${uh},${dh},${dh}\\)$`), vh = RegExp(`^hsla\\(${uh},${dh},${dh},${uh}\\)$`), yh = {
	aliceblue: 15792383,
	antiquewhite: 16444375,
	aqua: 65535,
	aquamarine: 8388564,
	azure: 15794175,
	beige: 16119260,
	bisque: 16770244,
	black: 0,
	blanchedalmond: 16772045,
	blue: 255,
	blueviolet: 9055202,
	brown: 10824234,
	burlywood: 14596231,
	cadetblue: 6266528,
	chartreuse: 8388352,
	chocolate: 13789470,
	coral: 16744272,
	cornflowerblue: 6591981,
	cornsilk: 16775388,
	crimson: 14423100,
	cyan: 65535,
	darkblue: 139,
	darkcyan: 35723,
	darkgoldenrod: 12092939,
	darkgray: 11119017,
	darkgreen: 25600,
	darkgrey: 11119017,
	darkkhaki: 12433259,
	darkmagenta: 9109643,
	darkolivegreen: 5597999,
	darkorange: 16747520,
	darkorchid: 10040012,
	darkred: 9109504,
	darksalmon: 15308410,
	darkseagreen: 9419919,
	darkslateblue: 4734347,
	darkslategray: 3100495,
	darkslategrey: 3100495,
	darkturquoise: 52945,
	darkviolet: 9699539,
	deeppink: 16716947,
	deepskyblue: 49151,
	dimgray: 6908265,
	dimgrey: 6908265,
	dodgerblue: 2003199,
	firebrick: 11674146,
	floralwhite: 16775920,
	forestgreen: 2263842,
	fuchsia: 16711935,
	gainsboro: 14474460,
	ghostwhite: 16316671,
	gold: 16766720,
	goldenrod: 14329120,
	gray: 8421504,
	green: 32768,
	greenyellow: 11403055,
	grey: 8421504,
	honeydew: 15794160,
	hotpink: 16738740,
	indianred: 13458524,
	indigo: 4915330,
	ivory: 16777200,
	khaki: 15787660,
	lavender: 15132410,
	lavenderblush: 16773365,
	lawngreen: 8190976,
	lemonchiffon: 16775885,
	lightblue: 11393254,
	lightcoral: 15761536,
	lightcyan: 14745599,
	lightgoldenrodyellow: 16448210,
	lightgray: 13882323,
	lightgreen: 9498256,
	lightgrey: 13882323,
	lightpink: 16758465,
	lightsalmon: 16752762,
	lightseagreen: 2142890,
	lightskyblue: 8900346,
	lightslategray: 7833753,
	lightslategrey: 7833753,
	lightsteelblue: 11584734,
	lightyellow: 16777184,
	lime: 65280,
	limegreen: 3329330,
	linen: 16445670,
	magenta: 16711935,
	maroon: 8388608,
	mediumaquamarine: 6737322,
	mediumblue: 205,
	mediumorchid: 12211667,
	mediumpurple: 9662683,
	mediumseagreen: 3978097,
	mediumslateblue: 8087790,
	mediumspringgreen: 64154,
	mediumturquoise: 4772300,
	mediumvioletred: 13047173,
	midnightblue: 1644912,
	mintcream: 16121850,
	mistyrose: 16770273,
	moccasin: 16770229,
	navajowhite: 16768685,
	navy: 128,
	oldlace: 16643558,
	olive: 8421376,
	olivedrab: 7048739,
	orange: 16753920,
	orangered: 16729344,
	orchid: 14315734,
	palegoldenrod: 15657130,
	palegreen: 10025880,
	paleturquoise: 11529966,
	palevioletred: 14381203,
	papayawhip: 16773077,
	peachpuff: 16767673,
	peru: 13468991,
	pink: 16761035,
	plum: 14524637,
	powderblue: 11591910,
	purple: 8388736,
	rebeccapurple: 6697881,
	red: 16711680,
	rosybrown: 12357519,
	royalblue: 4286945,
	saddlebrown: 9127187,
	salmon: 16416882,
	sandybrown: 16032864,
	seagreen: 3050327,
	seashell: 16774638,
	sienna: 10506797,
	silver: 12632256,
	skyblue: 8900331,
	slateblue: 6970061,
	slategray: 7372944,
	slategrey: 7372944,
	snow: 16775930,
	springgreen: 65407,
	steelblue: 4620980,
	tan: 13808780,
	teal: 32896,
	thistle: 14204888,
	tomato: 16737095,
	turquoise: 4251856,
	violet: 15631086,
	wheat: 16113331,
	white: 16777215,
	whitesmoke: 16119285,
	yellow: 16776960,
	yellowgreen: 10145074
};
ih(oh, wh, {
	copy(e) {
		return Object.assign(new this.constructor(), this, e);
	},
	displayable() {
		return this.rgb().displayable();
	},
	hex: bh,
	formatHex: bh,
	formatHex8: xh,
	formatHsl: Sh,
	formatRgb: Ch,
	toString: Ch
});
function bh() {
	return this.rgb().formatHex();
}
function xh() {
	return this.rgb().formatHex8();
}
function Sh() {
	return Lh(this).formatHsl();
}
function Ch() {
	return this.rgb().formatRgb();
}
function wh(e) {
	var t, n;
	return e = (e + "").trim().toLowerCase(), (t = fh.exec(e)) ? (n = t[1].length, t = parseInt(t[1], 16), n === 6 ? Th(t) : n === 3 ? new kh(t >> 8 & 15 | t >> 4 & 240, t >> 4 & 15 | t & 240, (t & 15) << 4 | t & 15, 1) : n === 8 ? Eh(t >> 24 & 255, t >> 16 & 255, t >> 8 & 255, (t & 255) / 255) : n === 4 ? Eh(t >> 12 & 15 | t >> 8 & 240, t >> 8 & 15 | t >> 4 & 240, t >> 4 & 15 | t & 240, ((t & 15) << 4 | t & 15) / 255) : null) : (t = ph.exec(e)) ? new kh(t[1], t[2], t[3], 1) : (t = mh.exec(e)) ? new kh(t[1] * 255 / 100, t[2] * 255 / 100, t[3] * 255 / 100, 1) : (t = hh.exec(e)) ? Eh(t[1], t[2], t[3], t[4]) : (t = gh.exec(e)) ? Eh(t[1] * 255 / 100, t[2] * 255 / 100, t[3] * 255 / 100, t[4]) : (t = _h.exec(e)) ? Ih(t[1], t[2] / 100, t[3] / 100, 1) : (t = vh.exec(e)) ? Ih(t[1], t[2] / 100, t[3] / 100, t[4]) : yh.hasOwnProperty(e) ? Th(yh[e]) : e === "transparent" ? new kh(NaN, NaN, NaN, 0) : null;
}
function Th(e) {
	return new kh(e >> 16 & 255, e >> 8 & 255, e & 255, 1);
}
function Eh(e, t, n, r) {
	return r <= 0 && (e = t = n = NaN), new kh(e, t, n, r);
}
function Dh(e) {
	return e instanceof oh || (e = wh(e)), e ? (e = e.rgb(), new kh(e.r, e.g, e.b, e.opacity)) : new kh();
}
function Oh(e, t, n, r) {
	return arguments.length === 1 ? Dh(e) : new kh(e, t, n, r ?? 1);
}
function kh(e, t, n, r) {
	this.r = +e, this.g = +t, this.b = +n, this.opacity = +r;
}
ih(kh, Oh, ah(oh, {
	brighter(e) {
		return e = e == null ? ch : ch ** +e, new kh(this.r * e, this.g * e, this.b * e, this.opacity);
	},
	darker(e) {
		return e = e == null ? sh : sh ** +e, new kh(this.r * e, this.g * e, this.b * e, this.opacity);
	},
	rgb() {
		return this;
	},
	clamp() {
		return new kh(Ph(this.r), Ph(this.g), Ph(this.b), Nh(this.opacity));
	},
	displayable() {
		return -.5 <= this.r && this.r < 255.5 && -.5 <= this.g && this.g < 255.5 && -.5 <= this.b && this.b < 255.5 && 0 <= this.opacity && this.opacity <= 1;
	},
	hex: Ah,
	formatHex: Ah,
	formatHex8: jh,
	formatRgb: Mh,
	toString: Mh
}));
function Ah() {
	return `#${Fh(this.r)}${Fh(this.g)}${Fh(this.b)}`;
}
function jh() {
	return `#${Fh(this.r)}${Fh(this.g)}${Fh(this.b)}${Fh((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
}
function Mh() {
	let e = Nh(this.opacity);
	return `${e === 1 ? "rgb(" : "rgba("}${Ph(this.r)}, ${Ph(this.g)}, ${Ph(this.b)}${e === 1 ? ")" : `, ${e})`}`;
}
function Nh(e) {
	return isNaN(e) ? 1 : Math.max(0, Math.min(1, e));
}
function Ph(e) {
	return Math.max(0, Math.min(255, Math.round(e) || 0));
}
function Fh(e) {
	return e = Ph(e), (e < 16 ? "0" : "") + e.toString(16);
}
function Ih(e, t, n, r) {
	return r <= 0 ? e = t = n = NaN : n <= 0 || n >= 1 ? e = t = NaN : t <= 0 && (e = NaN), new zh(e, t, n, r);
}
function Lh(e) {
	if (e instanceof zh) return new zh(e.h, e.s, e.l, e.opacity);
	if (e instanceof oh || (e = wh(e)), !e) return new zh();
	if (e instanceof zh) return e;
	e = e.rgb();
	var t = e.r / 255, n = e.g / 255, r = e.b / 255, i = Math.min(t, n, r), a = Math.max(t, n, r), o = NaN, s = a - i, c = (a + i) / 2;
	return s ? (o = t === a ? (n - r) / s + (n < r) * 6 : n === a ? (r - t) / s + 2 : (t - n) / s + 4, s /= c < .5 ? a + i : 2 - a - i, o *= 60) : s = c > 0 && c < 1 ? 0 : o, new zh(o, s, c, e.opacity);
}
function Rh(e, t, n, r) {
	return arguments.length === 1 ? Lh(e) : new zh(e, t, n, r ?? 1);
}
function zh(e, t, n, r) {
	this.h = +e, this.s = +t, this.l = +n, this.opacity = +r;
}
ih(zh, Rh, ah(oh, {
	brighter(e) {
		return e = e == null ? ch : ch ** +e, new zh(this.h, this.s, this.l * e, this.opacity);
	},
	darker(e) {
		return e = e == null ? sh : sh ** +e, new zh(this.h, this.s, this.l * e, this.opacity);
	},
	rgb() {
		var e = this.h % 360 + (this.h < 0) * 360, t = isNaN(e) || isNaN(this.s) ? 0 : this.s, n = this.l, r = n + (n < .5 ? n : 1 - n) * t, i = 2 * n - r;
		return new kh(Hh(e >= 240 ? e - 240 : e + 120, i, r), Hh(e, i, r), Hh(e < 120 ? e + 240 : e - 120, i, r), this.opacity);
	},
	clamp() {
		return new zh(Bh(this.h), Vh(this.s), Vh(this.l), Nh(this.opacity));
	},
	displayable() {
		return (0 <= this.s && this.s <= 1 || isNaN(this.s)) && 0 <= this.l && this.l <= 1 && 0 <= this.opacity && this.opacity <= 1;
	},
	formatHsl() {
		let e = Nh(this.opacity);
		return `${e === 1 ? "hsl(" : "hsla("}${Bh(this.h)}, ${Vh(this.s) * 100}%, ${Vh(this.l) * 100}%${e === 1 ? ")" : `, ${e})`}`;
	}
}));
function Bh(e) {
	return e = (e || 0) % 360, e < 0 ? e + 360 : e;
}
function Vh(e) {
	return Math.max(0, Math.min(1, e || 0));
}
function Hh(e, t, n) {
	return (e < 60 ? t + (n - t) * e / 60 : e < 180 ? n : e < 240 ? t + (n - t) * (240 - e) / 60 : t) * 255;
}
//#endregion
//#region node_modules/d3-interpolate/src/constant.js
var Uh = (e) => () => e;
//#endregion
//#region node_modules/d3-interpolate/src/color.js
function Wh(e, t) {
	return function(n) {
		return e + n * t;
	};
}
function Gh(e, t, n) {
	return e **= +n, t = t ** +n - e, n = 1 / n, function(r) {
		return (e + r * t) ** +n;
	};
}
function Kh(e) {
	return (e = +e) == 1 ? qh : function(t, n) {
		return n - t ? Gh(t, n, e) : Uh(isNaN(t) ? n : t);
	};
}
function qh(e, t) {
	var n = t - e;
	return n ? Wh(e, n) : Uh(isNaN(e) ? t : e);
}
//#endregion
//#region node_modules/d3-interpolate/src/rgb.js
var Jh = (function e(t) {
	var n = Kh(t);
	function r(e, t) {
		var r = n((e = Oh(e)).r, (t = Oh(t)).r), i = n(e.g, t.g), a = n(e.b, t.b), o = qh(e.opacity, t.opacity);
		return function(t) {
			return e.r = r(t), e.g = i(t), e.b = a(t), e.opacity = o(t), e + "";
		};
	}
	return r.gamma = e, r;
})(1);
//#endregion
//#region node_modules/d3-interpolate/src/numberArray.js
function Yh(e, t) {
	t ||= [];
	var n = e ? Math.min(t.length, e.length) : 0, r = t.slice(), i;
	return function(a) {
		for (i = 0; i < n; ++i) r[i] = e[i] * (1 - a) + t[i] * a;
		return r;
	};
}
function Xh(e) {
	return ArrayBuffer.isView(e) && !(e instanceof DataView);
}
//#endregion
//#region node_modules/d3-interpolate/src/array.js
function Zh(e, t) {
	for (var n = t ? t.length : 0, r = e ? Math.min(n, e.length) : 0, i = Array(r), a = Array(n), o = 0; o < r; ++o) i[o] = og(e[o], t[o]);
	for (; o < n; ++o) a[o] = t[o];
	return function(e) {
		for (o = 0; o < r; ++o) a[o] = i[o](e);
		return a;
	};
}
//#endregion
//#region node_modules/d3-interpolate/src/date.js
function Qh(e, t) {
	var n = /* @__PURE__ */ new Date();
	return e = +e, t = +t, function(r) {
		return n.setTime(e * (1 - r) + t * r), n;
	};
}
//#endregion
//#region node_modules/d3-interpolate/src/number.js
function $h(e, t) {
	return e = +e, t = +t, function(n) {
		return e * (1 - n) + t * n;
	};
}
//#endregion
//#region node_modules/d3-interpolate/src/object.js
function eg(e, t) {
	var n = {}, r = {}, i;
	for (i in (typeof e != "object" || !e) && (e = {}), (typeof t != "object" || !t) && (t = {}), t) i in e ? n[i] = og(e[i], t[i]) : r[i] = t[i];
	return function(e) {
		for (i in n) r[i] = n[i](e);
		return r;
	};
}
//#endregion
//#region node_modules/d3-interpolate/src/string.js
var tg = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g, ng = new RegExp(tg.source, "g");
function rg(e) {
	return function() {
		return e;
	};
}
function ig(e) {
	return function(t) {
		return e(t) + "";
	};
}
function ag(e, t) {
	var n = tg.lastIndex = ng.lastIndex = 0, r, i, a, o = -1, s = [], c = [];
	for (e += "", t += ""; (r = tg.exec(e)) && (i = ng.exec(t));) (a = i.index) > n && (a = t.slice(n, a), s[o] ? s[o] += a : s[++o] = a), (r = r[0]) === (i = i[0]) ? s[o] ? s[o] += i : s[++o] = i : (s[++o] = null, c.push({
		i: o,
		x: $h(r, i)
	})), n = ng.lastIndex;
	return n < t.length && (a = t.slice(n), s[o] ? s[o] += a : s[++o] = a), s.length < 2 ? c[0] ? ig(c[0].x) : rg(t) : (t = c.length, function(e) {
		for (var n = 0, r; n < t; ++n) s[(r = c[n]).i] = r.x(e);
		return s.join("");
	});
}
//#endregion
//#region node_modules/d3-interpolate/src/value.js
function og(e, t) {
	var n = typeof t, r;
	return t == null || n === "boolean" ? Uh(t) : (n === "number" ? $h : n === "string" ? (r = wh(t)) ? (t = r, Jh) : ag : t instanceof wh ? Jh : t instanceof Date ? Qh : Xh(t) ? Yh : Array.isArray(t) ? Zh : typeof t.valueOf != "function" && typeof t.toString != "function" || isNaN(t) ? eg : $h)(e, t);
}
//#endregion
//#region node_modules/d3-interpolate/src/round.js
function sg(e, t) {
	return e = +e, t = +t, function(n) {
		return Math.round(e * (1 - n) + t * n);
	};
}
//#endregion
//#region node_modules/d3-scale/src/constant.js
function cg(e) {
	return function() {
		return e;
	};
}
//#endregion
//#region node_modules/d3-scale/src/number.js
function lg(e) {
	return +e;
}
//#endregion
//#region node_modules/d3-scale/src/continuous.js
var ug = [0, 1];
function dg(e) {
	return e;
}
function fg(e, t) {
	return (t -= e = +e) ? function(n) {
		return (n - e) / t;
	} : cg(isNaN(t) ? NaN : .5);
}
function pg(e, t) {
	var n;
	return e > t && (n = e, e = t, t = n), function(n) {
		return Math.max(e, Math.min(t, n));
	};
}
function mg(e, t, n) {
	var r = e[0], i = e[1], a = t[0], o = t[1];
	return i < r ? (r = fg(i, r), a = n(o, a)) : (r = fg(r, i), a = n(a, o)), function(e) {
		return a(r(e));
	};
}
function hg(e, t, n) {
	var r = Math.min(e.length, t.length) - 1, i = Array(r), a = Array(r), o = -1;
	for (e[r] < e[0] && (e = e.slice().reverse(), t = t.slice().reverse()); ++o < r;) i[o] = fg(e[o], e[o + 1]), a[o] = n(t[o], t[o + 1]);
	return function(t) {
		var n = Ap(e, t, 1, r) - 1;
		return a[n](i[n](t));
	};
}
function gg(e, t) {
	return t.domain(e.domain()).range(e.range()).interpolate(e.interpolate()).clamp(e.clamp()).unknown(e.unknown());
}
function _g() {
	var e = ug, t = ug, n = og, r, i, a, o = dg, s, c, l;
	function u() {
		var n = Math.min(e.length, t.length);
		return o !== dg && (o = pg(e[0], e[n - 1])), s = n > 2 ? hg : mg, c = l = null, d;
	}
	function d(i) {
		return i == null || isNaN(i = +i) ? a : (c ||= s(e.map(r), t, n))(r(o(i)));
	}
	return d.invert = function(n) {
		return o(i((l ||= s(t, e.map(r), $h))(n)));
	}, d.domain = function(t) {
		return arguments.length ? (e = Array.from(t, lg), u()) : e.slice();
	}, d.range = function(e) {
		return arguments.length ? (t = Array.from(e), u()) : t.slice();
	}, d.rangeRound = function(e) {
		return t = Array.from(e), n = sg, u();
	}, d.clamp = function(e) {
		return arguments.length ? (o = e ? !0 : dg, u()) : o !== dg;
	}, d.interpolate = function(e) {
		return arguments.length ? (n = e, u()) : n;
	}, d.unknown = function(e) {
		return arguments.length ? (a = e, d) : a;
	}, function(e, t) {
		return r = e, i = t, u();
	};
}
function vg() {
	return _g()(dg, dg);
}
//#endregion
//#region node_modules/d3-format/src/formatDecimal.js
function yg(e) {
	return Math.abs(e = Math.round(e)) >= 1e21 ? e.toLocaleString("en").replace(/,/g, "") : e.toString(10);
}
function bg(e, t) {
	if (!isFinite(e) || e === 0) return null;
	var n = (e = t ? e.toExponential(t - 1) : e.toExponential()).indexOf("e"), r = e.slice(0, n);
	return [r.length > 1 ? r[0] + r.slice(2) : r, +e.slice(n + 1)];
}
//#endregion
//#region node_modules/d3-format/src/exponent.js
function xg(e) {
	return e = bg(Math.abs(e)), e ? e[1] : NaN;
}
//#endregion
//#region node_modules/d3-format/src/formatGroup.js
function Sg(e, t) {
	return function(n, r) {
		for (var i = n.length, a = [], o = 0, s = e[0], c = 0; i > 0 && s > 0 && (c + s + 1 > r && (s = Math.max(1, r - c)), a.push(n.substring(i -= s, i + s)), !((c += s + 1) > r));) s = e[o = (o + 1) % e.length];
		return a.reverse().join(t);
	};
}
//#endregion
//#region node_modules/d3-format/src/formatNumerals.js
function Cg(e) {
	return function(t) {
		return t.replace(/[0-9]/g, function(t) {
			return e[+t];
		});
	};
}
//#endregion
//#region node_modules/d3-format/src/formatSpecifier.js
var wg = /^(?:(.)?([<>=^]))?([+\-( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?(~)?([a-z%])?$/i;
function Tg(e) {
	if (!(t = wg.exec(e))) throw Error("invalid format: " + e);
	var t;
	return new Eg({
		fill: t[1],
		align: t[2],
		sign: t[3],
		symbol: t[4],
		zero: t[5],
		width: t[6],
		comma: t[7],
		precision: t[8] && t[8].slice(1),
		trim: t[9],
		type: t[10]
	});
}
Tg.prototype = Eg.prototype;
function Eg(e) {
	this.fill = e.fill === void 0 ? " " : e.fill + "", this.align = e.align === void 0 ? ">" : e.align + "", this.sign = e.sign === void 0 ? "-" : e.sign + "", this.symbol = e.symbol === void 0 ? "" : e.symbol + "", this.zero = !!e.zero, this.width = e.width === void 0 ? void 0 : +e.width, this.comma = !!e.comma, this.precision = e.precision === void 0 ? void 0 : +e.precision, this.trim = !!e.trim, this.type = e.type === void 0 ? "" : e.type + "";
}
Eg.prototype.toString = function() {
	return this.fill + this.align + this.sign + this.symbol + (this.zero ? "0" : "") + (this.width === void 0 ? "" : Math.max(1, this.width | 0)) + (this.comma ? "," : "") + (this.precision === void 0 ? "" : "." + Math.max(0, this.precision | 0)) + (this.trim ? "~" : "") + this.type;
};
//#endregion
//#region node_modules/d3-format/src/formatTrim.js
function Dg(e) {
	out: for (var t = e.length, n = 1, r = -1, i; n < t; ++n) switch (e[n]) {
		case ".":
			r = i = n;
			break;
		case "0":
			r === 0 && (r = n), i = n;
			break;
		default:
			if (!+e[n]) break out;
			r > 0 && (r = 0);
	}
	return r > 0 ? e.slice(0, r) + e.slice(i + 1) : e;
}
//#endregion
//#region node_modules/d3-format/src/formatPrefixAuto.js
var Og;
function kg(e, t) {
	var n = bg(e, t);
	if (!n) return Og = void 0, e.toPrecision(t);
	var r = n[0], i = n[1], a = i - (Og = Math.max(-8, Math.min(8, Math.floor(i / 3))) * 3) + 1, o = r.length;
	return a === o ? r : a > o ? r + Array(a - o + 1).join("0") : a > 0 ? r.slice(0, a) + "." + r.slice(a) : "0." + Array(1 - a).join("0") + bg(e, Math.max(0, t + a - 1))[0];
}
//#endregion
//#region node_modules/d3-format/src/formatRounded.js
function Ag(e, t) {
	var n = bg(e, t);
	if (!n) return e + "";
	var r = n[0], i = n[1];
	return i < 0 ? "0." + Array(-i).join("0") + r : r.length > i + 1 ? r.slice(0, i + 1) + "." + r.slice(i + 1) : r + Array(i - r.length + 2).join("0");
}
//#endregion
//#region node_modules/d3-format/src/formatTypes.js
var jg = {
	"%": (e, t) => (e * 100).toFixed(t),
	b: (e) => Math.round(e).toString(2),
	c: (e) => e + "",
	d: yg,
	e: (e, t) => e.toExponential(t),
	f: (e, t) => e.toFixed(t),
	g: (e, t) => e.toPrecision(t),
	o: (e) => Math.round(e).toString(8),
	p: (e, t) => Ag(e * 100, t),
	r: Ag,
	s: kg,
	X: (e) => Math.round(e).toString(16).toUpperCase(),
	x: (e) => Math.round(e).toString(16)
};
//#endregion
//#region node_modules/d3-format/src/identity.js
function Mg(e) {
	return e;
}
//#endregion
//#region node_modules/d3-format/src/locale.js
var Ng = Array.prototype.map, Pg = [
	"y",
	"z",
	"a",
	"f",
	"p",
	"n",
	"µ",
	"m",
	"",
	"k",
	"M",
	"G",
	"T",
	"P",
	"E",
	"Z",
	"Y"
];
function Fg(e) {
	var t = e.grouping === void 0 || e.thousands === void 0 ? Mg : Sg(Ng.call(e.grouping, Number), e.thousands + ""), n = e.currency === void 0 ? "" : e.currency[0] + "", r = e.currency === void 0 ? "" : e.currency[1] + "", i = e.decimal === void 0 ? "." : e.decimal + "", a = e.numerals === void 0 ? Mg : Cg(Ng.call(e.numerals, String)), o = e.percent === void 0 ? "%" : e.percent + "", s = e.minus === void 0 ? "−" : e.minus + "", c = e.nan === void 0 ? "NaN" : e.nan + "";
	function l(e, l) {
		e = Tg(e);
		var u = e.fill, d = e.align, f = e.sign, p = e.symbol, m = e.zero, h = e.width, g = e.comma, _ = e.precision, v = e.trim, y = e.type;
		y === "n" ? (g = !0, y = "g") : jg[y] || (_ === void 0 && (_ = 12), v = !0, y = "g"), (m || u === "0" && d === "=") && (m = !0, u = "0", d = "=");
		var b = (l && l.prefix !== void 0 ? l.prefix : "") + (p === "$" ? n : p === "#" && /[boxX]/.test(y) ? "0" + y.toLowerCase() : ""), x = (p === "$" ? r : /[%p]/.test(y) ? o : "") + (l && l.suffix !== void 0 ? l.suffix : ""), S = jg[y], C = /[defgprs%]/.test(y);
		_ = _ === void 0 ? 6 : /[gprs]/.test(y) ? Math.max(1, Math.min(21, _)) : Math.max(0, Math.min(20, _));
		function w(e) {
			var n = b, r = x, o, l, p;
			if (y === "c") r = S(e) + r, e = "";
			else {
				e = +e;
				var w = e < 0 || 1 / e < 0;
				if (e = isNaN(e) ? c : S(Math.abs(e), _), v && (e = Dg(e)), w && +e == 0 && f !== "+" && (w = !1), n = (w ? f === "(" ? f : s : f === "-" || f === "(" ? "" : f) + n, r = (y === "s" && !isNaN(e) && Og !== void 0 ? Pg[8 + Og / 3] : "") + r + (w && f === "(" ? ")" : ""), C) {
					for (o = -1, l = e.length; ++o < l;) if (p = e.charCodeAt(o), 48 > p || p > 57) {
						r = (p === 46 ? i + e.slice(o + 1) : e.slice(o)) + r, e = e.slice(0, o);
						break;
					}
				}
			}
			g && !m && (e = t(e, Infinity));
			var ee = n.length + e.length + r.length, T = ee < h ? Array(h - ee + 1).join(u) : "";
			switch (g && m && (e = t(T + e, T.length ? h - r.length : Infinity), T = ""), d) {
				case "<":
					e = n + e + r + T;
					break;
				case "=":
					e = n + T + e + r;
					break;
				case "^":
					e = T.slice(0, ee = T.length >> 1) + n + e + r + T.slice(ee);
					break;
				default: e = T + n + e + r;
			}
			return a(e);
		}
		return w.toString = function() {
			return e + "";
		}, w;
	}
	function u(e, t) {
		var n = Math.max(-8, Math.min(8, Math.floor(xg(t) / 3))) * 3, r = 10 ** -n, i = l((e = Tg(e), e.type = "f", e), { suffix: Pg[8 + n / 3] });
		return function(e) {
			return i(r * e);
		};
	}
	return {
		format: l,
		formatPrefix: u
	};
}
//#endregion
//#region node_modules/d3-format/src/defaultLocale.js
var Ig, Lg, Rg;
zg({
	thousands: ",",
	grouping: [3],
	currency: ["$", ""]
});
function zg(e) {
	return Ig = Fg(e), Lg = Ig.format, Rg = Ig.formatPrefix, Ig;
}
//#endregion
//#region node_modules/d3-format/src/precisionFixed.js
function Bg(e) {
	return Math.max(0, -xg(Math.abs(e)));
}
//#endregion
//#region node_modules/d3-format/src/precisionPrefix.js
function Vg(e, t) {
	return Math.max(0, Math.max(-8, Math.min(8, Math.floor(xg(t) / 3))) * 3 - xg(Math.abs(e)));
}
//#endregion
//#region node_modules/d3-format/src/precisionRound.js
function Hg(e, t) {
	return e = Math.abs(e), t = Math.abs(t) - e, Math.max(0, xg(t) - xg(e)) + 1;
}
//#endregion
//#region node_modules/d3-scale/src/tickFormat.js
function Ug(e, t, n, r) {
	var i = Lp(e, t, n), a;
	switch (r = Tg(r ?? ",f"), r.type) {
		case "s":
			var o = Math.max(Math.abs(e), Math.abs(t));
			return r.precision == null && !isNaN(a = Vg(i, o)) && (r.precision = a), Rg(r, o);
		case "":
		case "e":
		case "g":
		case "p":
		case "r":
			r.precision == null && !isNaN(a = Hg(i, Math.max(Math.abs(e), Math.abs(t)))) && (r.precision = a - (r.type === "e"));
			break;
		case "f":
		case "%": r.precision == null && !isNaN(a = Bg(i)) && (r.precision = a - (r.type === "%") * 2);
	}
	return Lg(r);
}
//#endregion
//#region node_modules/d3-scale/src/linear.js
function Wg(e) {
	var t = e.domain;
	return e.ticks = function(e) {
		var n = t();
		return Fp(n[0], n[n.length - 1], e ?? 10);
	}, e.tickFormat = function(e, n) {
		var r = t();
		return Ug(r[0], r[r.length - 1], e ?? 10, n);
	}, e.nice = function(n) {
		n ??= 10;
		var r = t(), i = 0, a = r.length - 1, o = r[i], s = r[a], c, l, u = 10;
		for (s < o && (l = o, o = s, s = l, l = i, i = a, a = l); u-- > 0;) {
			if (l = Ip(o, s, n), l === c) return r[i] = o, r[a] = s, t(r);
			if (l > 0) o = Math.floor(o / l) * l, s = Math.ceil(s / l) * l;
			else if (l < 0) o = Math.ceil(o * l) / l, s = Math.floor(s * l) / l;
			else break;
			c = l;
		}
		return e;
	}, e;
}
function Gg() {
	var e = vg();
	return e.copy = function() {
		return gg(e, Gg());
	}, rh.apply(e, arguments), Wg(e);
}
//#endregion
//#region src/lib/context-river/compaction-merge.ts
function Kg(e, t, n, r, i, a, o) {
	let s = Math.max(0, Math.min(o, (r - e) / 2)), c = e + s, l = r - s, u = (t + n) / 2, d = (i + a) / 2;
	return {
		path: `M ${e} ${u} C ${c} ${u}, ${l} ${d}, ${r} ${d}`,
		mergePath: n > t && a > i ? `M ${e} ${t} C ${c} ${t}, ${l} ${i}, ${r} ${i} L ${r} ${a} C ${l} ${a}, ${c} ${n}, ${e} ${n} Z` : ""
	};
}
//#endregion
//#region src/lib/context-river/layout.ts
function qg(e, t) {
	return ll().x((e) => e.x).y0((e) => e.y0).y1((e) => e.y1).curve(t ? al : hl)(Jg(e)) ?? "";
}
function Jg(e) {
	if (e.length < 3) return e;
	let t = [e[0]];
	for (let n = 1; n < e.length - 1; n += 1) {
		let r = e[n - 1], i = e[n], a = e[n + 1];
		(r.y0 !== i.y0 || i.y0 !== a.y0 || r.y1 !== i.y1 || i.y1 !== a.y1) && t.push(i);
	}
	return t.push(e[e.length - 1]), t;
}
function Yg(e) {
	return (e.y0 + e.y1) / 2;
}
function Xg(e) {
	let t = [...new Set(e)].sort((e, t) => e - t), n = [];
	for (let e of t) {
		let t = n[n.length - 1];
		t && e === t[t.length - 1] + 1 ? t.push(e) : n.push([e]);
	}
	return n;
}
function Zg(e, t, n) {
	if (e.length !== 1) return e;
	let r = e[0], i = Math.max(5, Math.min(t * .28, 18));
	return [{
		...r,
		x: Math.max(n.margin.left, r.x - i),
		xBasis: {
			kind: "singleton",
			callIndex: r.callIndex,
			side: -1
		}
	}, {
		...r,
		x: Math.min(n.width - n.margin.right, r.x + i),
		xBasis: {
			kind: "singleton",
			callIndex: r.callIndex,
			side: 1
		}
	}];
}
function Qg(e, t, n) {
	return e.itemById.has(n) ? e.analysis.displayWeightUnit === "calculatedTokens" || e.analysis.displayWeightUnit === "estimatedTokens" ? e.itemEstimateByProfile.get(n)?.get(t.tokenizationProfileId ?? "")?.tokens ?? 0 : 1 : 0;
}
function $g(e, t, n) {
	let r = e.analysis.modelCalls, i = Math.max(0, t - n.left - n.right);
	if (r.length === 0 || i === 0) return [];
	let a = r.length > 1 ? i / (r.length - 1) : i;
	return r.map((t, o) => ({
		callIndex: t.index,
		x: r.length > 1 ? n.left + o * a : n.left + i / 2,
		totalDisplayWeight: t.contextItemIds.reduce((n, r) => n + Qg(e, t, r), 0)
	}));
}
function e_(e) {
	return e.reduce((e, t) => t.y1 > t.y0 ? Math.min(e, t.y1 - t.y0) : e, Infinity);
}
function t_(e, t, n) {
	let { analysis: r, itemById: i } = e, a = Math.max(0, t.width - t.margin.left - t.margin.right), o = Math.max(0, t.height - t.margin.top - t.margin.bottom);
	if (a === 0 || o === 0) return {
		chartUnit: r.displayWeightUnit,
		columns: [],
		ribbons: [],
		compactions: [],
		lineageConnectors: [],
		versionMarks: [],
		innerWidth: a,
		innerHeight: o,
		maxTotalDisplayWeight: 0
	};
	if (r.modelCalls.length === 0) return {
		chartUnit: r.displayWeightUnit,
		columns: [],
		ribbons: [],
		compactions: r.compactions.map((e) => ({
			compactionId: e.id,
			beforeModelCall: e.beforeModelCall,
			x: t.margin.left + a
		})),
		lineageConnectors: [],
		versionMarks: [],
		innerWidth: a,
		innerHeight: o,
		maxTotalDisplayWeight: 0
	};
	let s = r.modelCalls.length, c = t.groupByKind === !0, l = /* @__PURE__ */ new Map();
	if (c) for (let e of r.contextItems) {
		let t = l.get(e.kind) ?? [];
		t.push(e.id), l.set(e.kind, t);
	}
	let u = n ? [...n] : $g(e, t.width, t.margin), d = s > 1 ? a / (s - 1) : a, f = new Map(u.map((e) => [e.callIndex, e.x])), p = Math.max(0, ...u.map((e) => e.totalDisplayWeight)), m = t.verticalDomainMax ?? p, h = Number.isFinite(m) && m >= 0 ? m : p, g = Gg().domain([0, Math.max(1, h)]).range([t.margin.top + o, t.margin.top]), _ = /* @__PURE__ */ new Map(), v = /* @__PURE__ */ new Map();
	for (let n of r.modelCalls) {
		let r = 0, i = c ? [...l.entries()].map(([e, t]) => ({
			key: `kind:${e}`,
			memberItemIds: t
		})) : (e.orderedItemIdsByCall.get(n.index) ?? []).map((e) => ({
			key: e,
			memberItemIds: [e]
		}));
		for (let a of i) {
			let i = a.memberItemIds.reduce((t, r) => t + (e.contextSetByCall.get(n.index)?.has(r) ? Qg(e, n, r) : 0), 0);
			if (i <= 0 && !a.memberItemIds.some((t) => e.contextSetByCall.get(n.index)?.has(t))) continue;
			let o = g(r);
			r += i;
			let s = g(r), c = {
				callIndex: n.index,
				x: f.get(n.index) ?? t.margin.left,
				y0: Math.min(o, s),
				y1: Math.max(o, s)
			}, l = _.get(a.key) ?? /* @__PURE__ */ new Map();
			l.set(n.index, c), _.set(a.key, l);
			let u = v.get(a.key) ?? /* @__PURE__ */ new Map();
			u.set(n.index, i), v.set(a.key, u);
		}
	}
	let y = (e) => {
		let n = f.get(e), r = f.get(e - 1);
		return n !== void 0 && r !== void 0 ? (r + n) / 2 : n === void 0 ? t.margin.left + a : n - Math.min(d / 2, 16);
	}, b = r.compactions.map((e) => ({
		compactionId: e.id,
		beforeModelCall: e.beforeModelCall,
		x: y(e.beforeModelCall)
	})), x = [], S = [];
	if (c) for (let [n, i] of l) {
		let a = Xg(r.modelCalls.filter((t) => i.some((n) => e.contextSetByCall.get(t.index)?.has(n))).map((e) => e.index));
		for (let [e, r] of a.entries()) {
			let a = r.flatMap((e) => {
				let t = _.get(`kind:${n}`)?.get(e);
				return t ? [t] : [];
			});
			if (a.length === 0) continue;
			let o = Zg(a, d, t), s = e_(o), c = s < t.minimumVisibleThickness, l = qg(o, !1);
			x.push({
				key: `kind:${n}:${e}`,
				itemId: `kind:${n}`,
				groupKind: n,
				memberItemIds: [...i],
				valueByCall: v.get(`kind:${n}`),
				rangeIndex: e,
				startCall: r[0],
				endCall: r[r.length - 1],
				points: o,
				path: l,
				hitPath: l,
				isSubpixel: c,
				thinnest: s
			});
		}
	}
	else for (let n of r.contextItems) for (let [r, a] of n.presence.entries()) {
		let o = [];
		for (let e = a.startCall; e <= a.endCall; e += 1) {
			let t = _.get(n.id)?.get(e);
			t && o.push(t);
		}
		if (o.length === 0) continue;
		let s = !1, c = (e.compactionBySourceId.get(n.id) ?? []).find((e) => e.beforeModelCall === a.endCall + 1), l = c && _.get(c.summaryItemId)?.get(c.beforeModelCall);
		if (l && (s = !0), c && !l) {
			let e = o[o.length - 1], t = Yg(e);
			o = [...o, {
				callIndex: c.beforeModelCall,
				x: y(c.beforeModelCall),
				xBasis: {
					kind: "boundary",
					beforeModelCall: c.beforeModelCall
				},
				y0: t,
				y1: t
			}], s = !0;
		}
		let u = (e.compactionsBySummaryId.get(n.id) ?? []).find((e) => e.beforeModelCall === a.startCall);
		u && (o = [{
			...o[0],
			x: y(u.beforeModelCall),
			xBasis: {
				kind: "boundary",
				beforeModelCall: u.beforeModelCall
			}
		}, ...o], s = !0);
		let f = e.versionByItemId.get(n.id)?.nextId, p = f && r === n.presence.length - 1 && !c && i.get(f)?.firstModelCall === a.endCall + 1 ? _.get(f)?.get(a.endCall + 1) : void 0;
		p && f && (o = [...o, p], n.kind === "system" && S.push({
			key: `${f}:version`,
			itemId: f,
			callIndex: p.callIndex,
			x: p.x,
			y0: p.y0,
			y1: p.y1
		})), o = o.length === 1 && l ? [Zg(o, d, t)[0], o[0]] : Zg(o, d, t);
		let m = e_(o), h = m < t.minimumVisibleThickness, g = qg(o, s);
		x.push({
			key: `${n.id}:${r}`,
			itemId: n.id,
			rangeIndex: r,
			startCall: a.startCall,
			endCall: a.endCall,
			points: o,
			path: g,
			hitPath: g,
			isSubpixel: h,
			thinnest: m,
			linear: s
		});
	}
	let C = c ? [] : r.compactions.flatMap((t) => {
		let n = _.get(t.summaryItemId)?.get(t.beforeModelCall);
		if (!n) return [];
		let r = Yg(n), i = y(t.beforeModelCall);
		return (e.incomingLineage.get(t.summaryItemId) ?? []).filter((e) => e.kind === "frameworkCompaction" && t.sourceItemIds.includes(e.from)).flatMap((e) => {
			let a = _.get(e.from)?.get(t.beforeModelCall - 1);
			if (!a) return [];
			let o = Yg(a), s = Math.max(8, Math.min(d * .25, 24));
			return [{
				key: `${t.id}:${e.from}:${e.to}`,
				fromItemId: e.from,
				toItemId: e.to,
				compactionId: t.id,
				sourceX: a.x,
				sourceY: o,
				sourceY0: a.y0,
				sourceY1: a.y1,
				targetX: i,
				summaryY: r,
				summaryY0: n.y0,
				summaryY1: n.y1,
				...Kg(a.x, a.y0, a.y1, i, n.y0, n.y1, s)
			}];
		});
	});
	return {
		chartUnit: r.displayWeightUnit,
		columns: u,
		ribbons: x,
		compactions: b,
		lineageConnectors: C,
		versionMarks: S,
		innerWidth: a,
		innerHeight: o,
		maxTotalDisplayWeight: p
	};
}
//#endregion
//#region src/lib/context-river/horizontal-projection.ts
function n_(e, t, n, r) {
	let i = t - r.left - r.right, a = Math.max(0, n - r.left - r.right);
	if (a === 0 || i <= 0) return [];
	let o = a / i;
	return e.map((e) => ({
		...e,
		x: r.left + (e.x - r.left) * o
	}));
}
function r_(e, t, n, r) {
	let i = Math.max(0, n - r.left - r.right), a = i / (t - r.left - r.right), o = r.left * (1 - a), s = `matrix(${a} 0 0 1 ${o} 0)`;
	if (i === 0) return {
		layout: {
			...e,
			innerWidth: i,
			columns: [],
			ribbons: [],
			compactions: [],
			lineageConnectors: [],
			versionMarks: [],
			maxTotalDisplayWeight: 0
		},
		scale: a,
		offset: o,
		transform: s
	};
	if (n === t) return {
		layout: e,
		scale: a,
		offset: o,
		transform: s
	};
	let c = n_(e.columns, t, n, r), l = new Map(c.map((e) => [e.callIndex, e.x])), u = c.length > 1 ? i / (c.length - 1) : i, d = (e) => {
		let t = l.get(e), n = l.get(e - 1);
		return t !== void 0 && n !== void 0 ? (n + t) / 2 : t === void 0 ? r.left + i : t - Math.min(u / 2, 16);
	}, f = (e) => {
		if (e.xBasis?.kind === "boundary") return (d(e.xBasis.beforeModelCall) - o) / a;
		if (e.xBasis?.kind === "singleton") {
			let t = l.get(e.xBasis.callIndex) ?? r.left, i = Math.max(5, Math.min(u * .28, 18));
			return ((e.xBasis.side === -1 ? Math.max(r.left, t - i) : Math.min(n - r.right, t + i)) - o) / a;
		}
		return e.x;
	}, p = e.ribbons.map((e) => {
		let t = e.points[0], n = e.points[e.points.length - 1];
		if (!t || !n || Math.abs(f(t) - t.x) < 1e-8 && Math.abs(f(n) - n.x) < 1e-8) return e;
		let r = e.points.slice();
		r[0] = {
			...t,
			x: f(t)
		}, r[r.length - 1] = {
			...n,
			x: f(n)
		};
		let i = qg(r, e.linear === !0);
		return {
			...e,
			points: r,
			path: i,
			hitPath: i
		};
	}), m = new Map(e.compactions.map((e) => [e.compactionId, (d(e.beforeModelCall) - o) / a])), h = Math.max(8, Math.min(u * .25, 24)) / a, g = e.lineageConnectors.map((e) => {
		let t = m.get(e.compactionId);
		return {
			...e,
			targetX: t,
			...Kg(e.sourceX, e.sourceY0, e.sourceY1, t, e.summaryY0, e.summaryY1, h)
		};
	});
	return {
		scale: a,
		offset: o,
		transform: s,
		layout: {
			...e,
			columns: c,
			ribbons: p,
			lineageConnectors: g,
			innerWidth: i,
			compactions: e.compactions.map((e) => ({
				...e,
				x: d(e.beforeModelCall)
			}))
		}
	};
}
//#endregion
//#region src/lib/context-river/reveal.ts
function i_(e, t, n) {
	return !Number.isFinite(n.left) || !Number.isFinite(n.right) || n.right < n.left ? !1 : t.some((t) => {
		if (t.itemId !== e || t.points.length === 0) return !1;
		let r = Infinity, i = -Infinity;
		for (let e of t.points) Number.isFinite(e.x) && (r = Math.min(r, e.x), i = Math.max(i, e.x));
		return i >= n.left && r <= n.right;
	});
}
function a_(e, t) {
	return e.some((e) => e.startCall <= t && t <= e.endCall);
}
function o_(e, t, n, r = null) {
	if (r !== null && a_(e, r)) return t.some((e) => e.callIndex === r) ? r : null;
	if (e.length === 0 || t.length === 0) return null;
	let i = Number.isFinite(n) ? n : r === null ? NaN : t.find((e) => e.callIndex === r)?.x ?? NaN;
	if (!Number.isFinite(i)) return null;
	let a = null;
	for (let n of t) {
		if (!a_(e, n.callIndex) || !Number.isFinite(n.x)) continue;
		let t = Math.abs(n.x - i);
		(a === null || t < a.distance) && (a = {
			...n,
			distance: t
		});
	}
	return a ? a.callIndex : null;
}
//#endregion
//#region src/lib/context-river/gestures.ts
function s_() {
	return {
		pointers: [],
		gesture: null,
		suppressClick: !1
	};
}
function c_(e, t) {
	return v_(e, t);
}
function l_(e, t) {
	return e.filter((e) => e.pointerId !== t);
}
function u_(e, t) {
	let n = t ? t.map((t) => e.find((e) => e.pointerId === t)) : e.slice(0, 2);
	if (n.length < 2 || n.some((e) => e === void 0)) return null;
	let r = n[0], i = n[1];
	return {
		x: (r.x + i.x) / 2,
		y: (r.y + i.y) / 2
	};
}
function d_(e, t, n) {
	if (t.pointerType === "mouse" && t.button !== 0 && t.button !== 1) return {
		state: e,
		effects: []
	};
	let r = v_(e.pointers, t), i = {
		...e,
		pointers: r,
		suppressClick: !1
	};
	if (e.gesture?.kind === "pinch") return {
		state: i,
		effects: [{
			kind: "capture",
			pointerIds: [t.pointerId]
		}]
	};
	if (r.length >= 2) {
		let e = r[0], t = r[1], a = n.pinchAnchor ? {
			kind: "pinch",
			pointerIds: [e.pointerId, t.pointerId],
			startDistance: Math.max(1, y_(e, t)),
			startSpacing: n.callSpacing,
			anchor: n.pinchAnchor
		} : null;
		return {
			state: {
				...i,
				gesture: a
			},
			effects: [
				{ kind: "clear-requested-range" },
				{ kind: "clear-selection" },
				{
					kind: "capture",
					pointerIds: r.map((e) => e.pointerId)
				}
			]
		};
	}
	let a = n.spaceHeld || t.shiftKey || t.pointerType === "mouse" && t.button === 1, o = {
		kind: a ? "pan" : "candidate",
		pointerId: t.pointerId,
		startX: t.x,
		startY: t.y,
		currentX: t.x,
		scrollLeft: n.scrollLeft
	};
	return {
		state: {
			...i,
			gesture: o
		},
		effects: a ? [
			{ kind: "clear-requested-range" },
			{
				kind: "capture",
				pointerIds: [t.pointerId]
			},
			{ kind: "prevent-default" }
		] : []
	};
}
function f_(e, t, n) {
	if (!e.pointers.some((e) => e.pointerId === t.pointerId)) return {
		state: e,
		effects: []
	};
	let r = v_(e.pointers, t), i = {
		...e,
		pointers: r
	}, a = e.gesture;
	if (!a) return {
		state: i,
		effects: []
	};
	if (a.kind === "pinch") {
		if (!a.pointerIds.includes(t.pointerId)) return {
			state: i,
			effects: []
		};
		let e = r.find((e) => e.pointerId === a.pointerIds[0]), n = r.find((e) => e.pointerId === a.pointerIds[1]);
		if (!e || !n) return {
			state: {
				...i,
				gesture: null
			},
			effects: []
		};
		let o = u_(r, a.pointerIds);
		return o ? {
			state: i,
			effects: [{
				kind: "pinch-zoom",
				centerX: o.x,
				distance: Math.max(1, y_(e, n)),
				startDistance: a.startDistance,
				startSpacing: a.startSpacing,
				anchor: a.anchor
			}]
		} : {
			state: {
				...i,
				gesture: null
			},
			effects: []
		};
	}
	if (a.pointerId !== t.pointerId) return {
		state: i,
		effects: []
	};
	let o = {
		...a,
		currentX: t.x
	};
	if (o.kind === "candidate") {
		let e = t.x - o.startX, r = t.y - o.startY;
		if (Math.abs(e) < n.dragThreshold && Math.abs(r) < n.dragThreshold) return {
			state: {
				...i,
				gesture: o
			},
			effects: []
		};
		if (Math.abs(e) > Math.abs(r) * 1.2) {
			let e = {
				...o,
				kind: "range"
			};
			return {
				state: {
					...i,
					gesture: e
				},
				effects: [{
					kind: "capture",
					pointerIds: [t.pointerId]
				}, {
					kind: "selection",
					startX: e.startX,
					currentX: t.x
				}]
			};
		}
		return {
			state: {
				...i,
				gesture: {
					...o,
					kind: "cancel"
				}
			},
			effects: [{
				kind: "capture",
				pointerIds: [t.pointerId]
			}]
		};
	}
	return o.kind === "range" ? {
		state: {
			...i,
			gesture: o
		},
		effects: [{
			kind: "selection",
			startX: o.startX,
			currentX: t.x
		}]
	} : o.kind === "pan" ? {
		state: {
			...i,
			gesture: o
		},
		effects: [{
			kind: "scroll",
			scrollLeft: o.scrollLeft - (t.x - o.startX)
		}]
	} : {
		state: {
			...i,
			gesture: o
		},
		effects: []
	};
}
function p_(e, t, n) {
	if (!e.pointers.some((e) => e.pointerId === t)) return {
		state: e,
		effects: []
	};
	let r = l_(e.pointers, t), i = [{ kind: "clear-selection" }], a = e.gesture, o = a, s = e.suppressClick;
	if (a?.kind === "pinch") {
		if (s = !0, i.push({ kind: "suppress-click" }), a.pointerIds.includes(t)) {
			let e = u_(r);
			o = r.length >= 2 && e && n.pinchAnchor ? {
				kind: "pinch",
				pointerIds: [r[0].pointerId, r[1].pointerId],
				startDistance: Math.max(1, y_(r[0], r[1])),
				startSpacing: n.callSpacing,
				anchor: n.pinchAnchor
			} : null;
		}
	} else a?.pointerId === t && (a.kind === "range" ? (i.push({
		kind: "zoom-range",
		startX: a.startX,
		endX: n.clientX
	}), i.push({ kind: "suppress-click" }), s = !0) : (a.kind === "pan" || a.kind === "cancel") && (i.push({ kind: "suppress-click" }), s = !0), o = null);
	return {
		state: {
			pointers: r,
			gesture: o,
			suppressClick: s
		},
		effects: i
	};
}
function m_(e, t) {
	return e.pointers.some((e) => e.pointerId === t) ? {
		state: s_(),
		effects: [{ kind: "clear-selection" }, {
			kind: "release",
			pointerIds: e.pointers.map((e) => e.pointerId)
		}]
	} : {
		state: e,
		effects: []
	};
}
function h_(e) {
	return e.pointers.length === 0 && e.gesture === null ? {
		state: s_(),
		effects: []
	} : {
		state: s_(),
		effects: [{ kind: "clear-selection" }, {
			kind: "release",
			pointerIds: e.pointers.map((e) => e.pointerId)
		}]
	};
}
function g_(e) {
	return e.suppressClick ? {
		state: {
			...e,
			suppressClick: !1
		},
		suppressed: !0
	} : {
		state: e,
		suppressed: !1
	};
}
function __(e) {
	return e.suppressClick ? {
		...e,
		suppressClick: !1
	} : e;
}
function v_(e, t) {
	let n = e.findIndex((e) => e.pointerId === t.pointerId);
	return n < 0 ? [...e, t] : e.map((e, r) => r === n ? t : e);
}
function y_(e, t) {
	return Math.hypot(t.x - e.x, t.y - e.y);
}
//#endregion
//#region src/lib/context-river/ContextRiver.svelte
var b_ = 0, x_ = /* @__PURE__ */ W("<div class=\"toggle-group\" role=\"group\" aria-label=\"Vertical scale\"><span class=\"toggle-label\">Vertical scale</span> <button type=\"button\">Session scale</button> <button type=\"button\">Visible calls</button></div> <div class=\"toggle-group\" role=\"group\" aria-label=\"River display\"><span class=\"toggle-label\">Display</span> <button type=\"button\">Items</button> <button type=\"button\">Item types</button></div>", 1), S_ = /* @__PURE__ */ W("<div class=\"vertical-scale-controls compact svelte-13ao2q1\"><!></div>"), C_ = /* @__PURE__ */ W("<div class=\"vertical-scale-controls svelte-13ao2q1\"><!></div>"), w_ = /* @__PURE__ */ W("<span> </span>"), T_ = /* @__PURE__ */ Rr("<path fill=\"black\" vector-effect=\"non-scaling-stroke\"></path>"), E_ = /* @__PURE__ */ Rr("<path fill=\"black\"></path>"), D_ = /* @__PURE__ */ Rr("<pattern width=\"8\" height=\"8\" patternUnits=\"userSpaceOnUse\"><rect width=\"8\" height=\"8\" fill=\"var(--input-gap-base)\" opacity=\".08\"></rect><path d=\"M-2 2L2-2M0 8L8 0M6 10L10 6\" stroke=\"var(--input-gap)\" stroke-width=\"1\" opacity=\".45\"></path></pattern><mask maskUnits=\"userSpaceOnUse\" style=\"mask-type:luminance\"><rect fill=\"white\"></rect><g><!><!></g></mask>", 1), O_ = /* @__PURE__ */ Rr("<linearGradient gradientUnits=\"userSpaceOnUse\"><stop offset=\"0%\"></stop><stop offset=\"100%\"></stop></linearGradient>"), k_ = /* @__PURE__ */ Rr("<line class=\"weight-gridline svelte-13ao2q1\"></line>"), A_ = /* @__PURE__ */ Rr("<line class=\"column-guide svelte-13ao2q1\"></line>"), j_ = /* @__PURE__ */ Rr("<g class=\"compaction-marker svelte-13ao2q1\"><title> </title><line class=\"svelte-13ao2q1\"></line><text class=\"svelte-13ao2q1\"> </text></g>"), M_ = /* @__PURE__ */ Rr("<path class=\"compaction-merge svelte-13ao2q1\" aria-hidden=\"true\"></path>"), N_ = /* @__PURE__ */ Rr("<title> </title>"), P_ = /* @__PURE__ */ Rr("<g><path vector-effect=\"non-scaling-stroke\"></path><path class=\"ribbon-hit svelte-13ao2q1\" vector-effect=\"non-scaling-stroke\" pointer-events=\"fill\" role=\"button\"><!></path></g>"), F_ = /* @__PURE__ */ Rr("<path class=\"unreconciled-input\"></path>"), I_ = /* @__PURE__ */ Rr("<!><path class=\"reported-input-line svelte-13ao2q1\"></path>", 1), L_ = /* @__PURE__ */ Rr("<g class=\"reported-input-overlay svelte-13ao2q1\" aria-hidden=\"true\" data-testid=\"reported-input-overlay\"></g>"), R_ = /* @__PURE__ */ Rr("<g role=\"button\"><rect width=\"44\" height=\"38\" class=\"svelte-13ao2q1\"></rect><text text-anchor=\"middle\" class=\"svelte-13ao2q1\"> </text></g>"), z_ = /* @__PURE__ */ Rr("<path class=\"lineage-connector visible svelte-13ao2q1\" vector-effect=\"non-scaling-stroke\"></path>"), B_ = /* @__PURE__ */ Rr("<path></path><!>", 1), V_ = /* @__PURE__ */ Rr("<path class=\"ribbon-emphasis hovered svelte-13ao2q1\" vector-effect=\"non-scaling-stroke\"></path>"), H_ = /* @__PURE__ */ Rr("<path class=\"ribbon-emphasis selected svelte-13ao2q1\" vector-effect=\"non-scaling-stroke\"></path>"), U_ = /* @__PURE__ */ Rr("<line class=\"version-mark svelte-13ao2q1\" vector-effect=\"non-scaling-stroke\"></line>"), W_ = /* @__PURE__ */ Rr("<rect class=\"zoom-selection svelte-13ao2q1\"></rect>"), G_ = /* @__PURE__ */ Rr("<line class=\"crosshair svelte-13ao2q1\"></line>"), K_ = /* @__PURE__ */ Rr("<line class=\"pin-line svelte-13ao2q1\"></line>"), q_ = /* @__PURE__ */ W("<div role=\"status\"><strong class=\"svelte-13ao2q1\"> </strong> <span> </span> <span> </span></div>"), J_ = /* @__PURE__ */ W("<span class=\"svelte-13ao2q1\"><i class=\"svelte-13ao2q1\"></i> </span>"), Y_ = /* @__PURE__ */ W("<div class=\"group-type-legend svelte-13ao2q1\" role=\"group\" aria-label=\"Item type legend\"><strong class=\"svelte-13ao2q1\">Item types</strong> <!></div>"), X_ = /* @__PURE__ */ W("<span class=\"svelte-13ao2q1\"><i class=\"input-gap-key svelte-13ao2q1\"></i>Unreconciled input<!></span>"), Z_ = /* @__PURE__ */ W("<span class=\"input-comparison-readout svelte-13ao2q1\"> <!> tokens</span>"), Q_ = /* @__PURE__ */ W("<span class=\"input-comparison-readout svelte-13ao2q1\"> </span>"), $_ = /* @__PURE__ */ W("<span class=\"input-comparison-readout svelte-13ao2q1\">Hover or pin a call to compare its estimated and reported input.</span>"), ev = /* @__PURE__ */ W("<div class=\"input-reference-legend svelte-13ao2q1\" role=\"group\" aria-label=\"Input reference legend\"><span class=\"svelte-13ao2q1\"><i class=\"input-reference-key svelte-13ao2q1\"></i>Reported input</span> <!> <!></div>"), tv = /* @__PURE__ */ W("<div class=\"economics-readout svelte-13ao2q1\" aria-label=\"Economics call readout\"> </div>"), nv = /* @__PURE__ */ W("<!> <div class=\"chart-frame svelte-13ao2q1\"><div class=\"chart-plot svelte-13ao2q1\"><div class=\"vertical-axis-overlay svelte-13ao2q1\" role=\"img\"></div> <div class=\"river-scroll svelte-13ao2q1\" data-testid=\"river-host\" role=\"application\" tabindex=\"0\" aria-label=\"Context River\" aria-describedby=\"context-river-description\"><span id=\"context-river-description\" class=\"sr-only\"> </span>  <div class=\"river-canvas svelte-13ao2q1\"><svg class=\"river-plot svelte-13ao2q1\"><defs><!><!><pattern id=\"unknown-geometry\" width=\"8\" height=\"8\" patternUnits=\"userSpaceOnUse\"><rect width=\"8\" height=\"8\" fill=\"var(--unknown-fill)\"></rect><path d=\"M0 0V8\" stroke=\"var(--unknown-mark)\" stroke-width=\"2\" opacity=\".65\"></path></pattern></defs><rect class=\"plot-background svelte-13ao2q1\"></rect><!><!><!><g data-testid=\"river-ribbon-geometry\"><!><!></g><!></svg> <svg class=\"river-overlay svelte-13ao2q1\"><!><g aria-hidden=\"true\"><!><!><!><!></g><!><!><!></svg></div> <!> <!> <!> <!> <!></div></div> <!> <!> <!></div>", 1), rv = {
	hash: "svelte-13ao2q1",
	code: ".vertical-scale-controls.compact.svelte-13ao2q1 {display:flex;justify-content:flex-end;margin:-6px 0 6px;}.vertical-scale-controls.svelte-13ao2q1 {display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;margin:6px 0 10px;color:var(--secondary);font-size:var(--text-md);}.chart-frame.svelte-13ao2q1 {position:relative;max-width:100%;}\n  /* The legends sit in the chart's horizontal scroller; sticky, like the Cache & cost header,\n     they stay in view while a zoomed chart is scrolled, starting where the plot does. */.group-type-legend.svelte-13ao2q1 {position:sticky;left:0;display:flex;flex-wrap:wrap;align-items:center;gap:5px 12px;width:100%;margin:6px 0 0;padding-left:var(--plot-left);color:var(--text);font-size:var(--text-sm);}.group-type-legend.svelte-13ao2q1 strong:where(.svelte-13ao2q1) {color:var(--text-strong);}.group-type-legend.svelte-13ao2q1 span:where(.svelte-13ao2q1) {display:inline-flex;align-items:center;gap:4px;}.group-type-legend.svelte-13ao2q1 i:where(.svelte-13ao2q1) {width:10px;height:10px;border-radius:var(--radius-small);border:1px solid var(--swatch-border);}.group-hover-card.svelte-13ao2q1 {position:absolute;z-index:4;display:grid;gap:2px;width:max-content;max-width:240px;padding:6px 9px;border:1px solid var(--separator);border-left:3px solid var(--group-color);border-radius:var(--control-radius);background:var(--plot);color:var(--text);font-size:var(--text-sm);box-shadow:0 6px 18px var(--shadow);pointer-events:none;transform:translate(14px, 14px);}.group-hover-card.flip.svelte-13ao2q1 {transform:translate(calc(-100% - 14px), 14px);}.group-hover-card.svelte-13ao2q1 strong:where(.svelte-13ao2q1) {color:var(--text-strong);}.chart-plot.svelte-13ao2q1 {position:relative;min-width:0;max-width:100%;}.economics-readout.svelte-13ao2q1 {min-height:28px;padding:0.45rem 0 0 var(--plot-left);color:var(--secondary);font-size:var(--text-sm);font-variant-numeric:tabular-nums;overflow-wrap:anywhere;}.vertical-axis-overlay.svelte-13ao2q1 {position:absolute;z-index:2;left:0;width:var(--plot-left);border-right:1px solid var(--control-border);background:var(--plot);pointer-events:none;}.vertical-axis-tick.svelte-13ao2q1 {position:absolute;right:5px;color:var(--text);font-size:10px;line-height:1;white-space:nowrap;transform:translateY(-50%);}.vertical-axis-tick.top.svelte-13ao2q1 {transform:none;}.vertical-axis-tick.bottom.svelte-13ao2q1 {transform:translateY(-100%);}.river-scroll.svelte-13ao2q1 {overflow-x:auto;max-width:100%;overscroll-behavior-x:contain;scrollbar-color:var(--control-border) var(--plot);scrollbar-width:thin;outline:none;user-select:none;-webkit-user-select:none;}.river-scroll.svelte-13ao2q1:focus-visible {outline:2px solid var(--accent);outline-offset:2px;}.river-scroll.svelte-13ao2q1::-webkit-scrollbar {height:9px;}.river-scroll.svelte-13ao2q1::-webkit-scrollbar-track {background:var(--plot);border-radius:var(--control-radius);}.river-scroll.svelte-13ao2q1::-webkit-scrollbar-thumb {background:var(--control-border);border:2px solid var(--plot);border-radius:var(--control-radius);}svg.svelte-13ao2q1 {display:block;background:var(--plot);border-radius:var(--radius);touch-action:pan-y;}.plot-background.svelte-13ao2q1 {fill:var(--plot);}.weight-gridline.svelte-13ao2q1 {stroke:var(--separator);stroke-width:0.75;opacity:0.72;pointer-events:none;}.column-guide.svelte-13ao2q1 {stroke:var(--chart-guide);stroke-width:1;pointer-events:none;}.river-overlay.svelte-13ao2q1 .call-target:where(.svelte-13ao2q1) {pointer-events:all;}.call-target.svelte-13ao2q1 {cursor:pointer;color:var(--secondary);}.call-target.svelte-13ao2q1 rect:where(.svelte-13ao2q1) {fill:transparent;}.call-target.svelte-13ao2q1 text:where(.svelte-13ao2q1) {fill:currentColor;font-size:var(--text-sm);}.call-target.svelte-13ao2q1:hover,\n  .call-target.svelte-13ao2q1:focus-visible,\n  .call-target.pinned.svelte-13ao2q1 {color:var(--text-strong);outline:none;}.call-target.svelte-13ao2q1:focus-visible rect:where(.svelte-13ao2q1) {stroke:var(--selection);stroke-width:2;}.call-target.condensed.svelte-13ao2q1 {pointer-events:none;}.call-target.condensed.svelte-13ao2q1:focus-visible {pointer-events:all;}.compaction-marker.svelte-13ao2q1 {pointer-events:none;}.compaction-marker.svelte-13ao2q1 line:where(.svelte-13ao2q1) {stroke:var(--compaction);stroke-width:1.5;stroke-dasharray:6 5;}.compaction-marker.svelte-13ao2q1 text:where(.svelte-13ao2q1) {fill:var(--compaction-text);font-size:10px;font-weight:700;letter-spacing:0.08em;}.reported-input-overlay.svelte-13ao2q1 {pointer-events:none;}.reported-input-line.svelte-13ao2q1 {fill:none;stroke:var(--secondary);stroke-width:1.5;stroke-dasharray:5 4;pointer-events:none;}.input-reference-legend.svelte-13ao2q1 {position:sticky;left:0;width:100%;display:flex;flex-wrap:wrap;align-items:center;gap:0.35rem 1rem;padding:0.45rem 0 0.45rem var(--plot-left);color:var(--secondary);font-size:var(--text-sm);}.input-reference-legend.svelte-13ao2q1 span:where(.svelte-13ao2q1) {display:inline-flex;align-items:center;gap:0.4rem;}.input-reference-legend.svelte-13ao2q1 i:where(.svelte-13ao2q1) {display:inline-block;width:18px;height:10px;flex-shrink:0;}.input-reference-key.svelte-13ao2q1 {border-top:2px dashed var(--secondary);margin-top:8px;}.input-gap-key.svelte-13ao2q1 {background:repeating-linear-gradient(\n      135deg,\n      transparent 0 4px,\n      color-mix(in srgb, var(--input-gap) 46%, transparent) 4px 5px\n    );border:1px solid color-mix(in srgb, var(--input-gap-base) 34%, transparent);}.input-comparison-readout.svelte-13ao2q1 {flex-basis:100%;}\n\n  /* Hover and selection never restyle ribbons: that would re-rasterise every\n     ribbon. Emphasis is drawn in .river-overlay instead. */.river-canvas.svelte-13ao2q1 {position:relative;}\n  /* Composite the overlay, not the ribbon SVG: promoting the ribbon SVG changes\n     how Chrome hit-tests sub-pixel ribbons. */.river-overlay.svelte-13ao2q1 {position:absolute;top:0;left:0;background:none;pointer-events:none;will-change:transform;}.ribbon.svelte-13ao2q1 {pointer-events:none;fill-opacity:0.88;stroke-opacity:0.88;}.ribbon-group.unknown.svelte-13ao2q1 .ribbon:where(.svelte-13ao2q1) {fill-opacity:0.92;}.ribbon-emphasis.svelte-13ao2q1 {fill-opacity:1;}.ribbon-emphasis.hovered.svelte-13ao2q1 {stroke:var(--selection-soft);stroke-width:1.5;}.ribbon-emphasis.selected.svelte-13ao2q1 {stroke:var(--selection);stroke-width:2.5;}.ribbon.subpixel.svelte-13ao2q1 {paint-order:stroke;}.ribbon-hit.svelte-13ao2q1 {fill:transparent;stroke:transparent;stroke-width:0;cursor:pointer;pointer-events:fill;}.ribbon-hit.svelte-13ao2q1:focus-visible {stroke:var(--selection-focus);stroke-width:3;outline:none;}.compaction-merge.svelte-13ao2q1 {opacity:0.4;pointer-events:none;}\n  /* Drawn over the 0.4 base merge: about 0.5 combined when the summary is\n     focused, about 0.8 when the focused item is one of its sources. */.compaction-merge-emphasis.svelte-13ao2q1 {opacity:0.15;}.compaction-merge-emphasis.emphasized.svelte-13ao2q1 {opacity:0.65;}.version-mark.svelte-13ao2q1 {stroke:var(--selection);stroke-width:1.5;opacity:0.8;}.lineage-connector.svelte-13ao2q1 {fill:none;stroke:var(--selection);stroke-width:1.5;stroke-dasharray:4 4;opacity:0.88;}.crosshair.svelte-13ao2q1 {stroke:var(--secondary);stroke-width:1;stroke-dasharray:4 4;pointer-events:none;}.pin-line.svelte-13ao2q1 {stroke:var(--selection);stroke-width:2;pointer-events:none;}.zoom-selection.svelte-13ao2q1 {fill:color-mix(in srgb, var(--accent) 20%, transparent);stroke:var(--accent);stroke-width:1.5;stroke-dasharray:4 3;pointer-events:none;}\n  @container highwater (max-width: 620px) {.vertical-scale-controls.svelte-13ao2q1 {display:block;}\n  }"
};
function iv(e, t) {
	Be(t, !0), li(e, rv);
	let n = () => ot(Ma, "$activePalette", r), [r, i] = st(), a = (e) => {
		var t = x_(), n = R(t), r = B(L(n), 2), i = B(r, 2);
		M(n);
		var a = B(n, 2), o = B(L(a), 2), s = B(o, 2);
		M(a), V(() => {
			Y(r, "aria-pressed", H(se) === "session"), Y(i, "aria-pressed", H(se) === "visible"), Y(o, "aria-pressed", H(ce) === "items"), Y(s, "aria-pressed", H(ce) === "itemTypes");
		}), U("click", r, () => E("session")), U("click", i, () => E("visible")), U("click", o, () => T("items")), U("click", s, () => T("itemTypes")), G(e, t);
	}, o = `compaction-merge-${b_++}`, s = 0, c = X(t, "pinnedCallIndex", 3, null), l = X(t, "hoveredCallIndex", 3, null), u = X(t, "selectedItemId", 3, null), d = X(t, "hoveredItemId", 3, null), f = X(t, "navigationCommand", 3, null), p = X(t, "isVisible", 3, !0), m = X(t, "onViewportChange", 3, () => {}), h = X(t, "onNavigationSettled", 3, () => {}), g = X(t, "onSelectionVisibility", 3, () => {}), _ = X(t, "consumeUnhandledEscape", 3, !0), v = X(t, "compact", 3, !1), y = X(t, "preferences", 23, Gi), b = X(t, "onPreferencesChange", 3, () => {}), x = null, S = /* @__PURE__ */ F(void 0), C = /* @__PURE__ */ F(void 0);
	function w(e) {
		y(e), b()(e);
	}
	function ee(e) {
		on(e.river.verticalScale), H(ce) !== e.river.display && Un(!1), I(ce, e.river.display, !0);
		let t = e.economics.expanded ? e.economics.lastMode : "off";
		if (t === "off" && H(ue) !== "off") {
			let e = Vi(D).activeElement, t = e instanceof Node && (H(C)?.contains(e) || D?.querySelector(".economics-track-svg")?.contains(e) || H(j)?.contains(e));
			Jn(!1), ge.cancel(), I(de, ""), I(fe, null), I(ve, ""), t && H(S)?.focus();
		}
		I(le, e.economics.cacheView, !0), I(ue, t, !0);
	}
	function T(e) {
		w({
			...y(),
			river: {
				...y().river,
				display: e
			}
		});
	}
	function E(e) {
		w({
			...y(),
			river: {
				...y().river,
				verticalScale: e
			}
		});
	}
	function te(e) {
		w({
			...y(),
			economics: {
				...y().economics,
				cacheView: e
			}
		});
	}
	let D, O, k, ne = /* @__PURE__ */ F(960), re = /* @__PURE__ */ F(!1), ie = /* @__PURE__ */ F(0), ae = /* @__PURE__ */ F(0), oe = /* @__PURE__ */ F(0), se = /* @__PURE__ */ F("session"), ce = /* @__PURE__ */ F("items"), le = /* @__PURE__ */ F("tokens"), ue = /* @__PURE__ */ F("off"), de = /* @__PURE__ */ F(""), fe = /* @__PURE__ */ F(null), pe = /* @__PURE__ */ F(null), me = null, he = Cp(), ge = Cp(), _e = /* @__PURE__ */ F(null), A, ve = /* @__PURE__ */ F(""), j = /* @__PURE__ */ F(null), ye = /* @__PURE__ */ F(null), be = /* @__PURE__ */ F(null), Se = /* @__PURE__ */ F(null), Ce = /* @__PURE__ */ F(null), we = "", Te = 960, Ee = null, De = "", Oe = "", ke = [], Ae = /* @__PURE__ */ F(null), je = /* @__PURE__ */ F(null), Me = s_(), Ne = null, Pe = !1, Fe = !0, N = {
		top: 36,
		right: 24,
		bottom: 54,
		left: 42
	}, Ie = 1.5, Le = {
		maxWeight: 0,
		visibleCallCount: 0,
		usesInterpolatedEdge: !1
	};
	function Re() {
		p() ? D && D.clientWidth > 0 && (I(ne, D.clientWidth, !0), I(re, !0), an()) : (he.cancel(), ge.cancel(), Fn(), t.onHoverCall(null), t.onHoverItem(null), H(fe) && Jn(!1));
	}
	let ze = /* @__PURE__ */ F(null), He = /* @__PURE__ */ P(() => Rl(t.indexed.analysis.economics.costBasis, t.indexed.analysis.session.source)), Ue = /* @__PURE__ */ P(() => H(pe) ? H(pe).memberIds.slice(0, 12).map((e) => Ao(t.indexed.itemById.get(e), e)) : []), We = /* @__PURE__ */ P(() => JSON.stringify(t.indexed.analysis.modelCalls.map((e) => [e.index, e.sourceRecordId]))), Ge = /* @__PURE__ */ P(() => t.indexed.analysis.modelCalls.length), Ke = /* @__PURE__ */ P(() => Math.max(1, H(ne) - N.left - N.right)), qe = /* @__PURE__ */ P(() => H(Ge) > 1 ? H(Ke) / (H(Ge) - 1) : 0), Je = /* @__PURE__ */ P(() => Math.max(H(be) ?? H(qe), H(qe))), Ye = /* @__PURE__ */ P(() => H(Ge) > 1 && H(be) !== null ? Math.max(H(ne), N.left + N.right + (H(Ge) - 1) * H(be)) : Math.max(1, H(ne))), Xe = /* @__PURE__ */ P(() => $g(t.indexed, 960, N)), Ze = /* @__PURE__ */ P(() => _l(t.indexed, H(Xe))), Qe = /* @__PURE__ */ P(() => yl(H(Xe), H(Ze))), $e = /* @__PURE__ */ P(() => Math.max(0, ...H(Qe).map((e) => e.totalDisplayWeight))), et = /* @__PURE__ */ P(() => n_(H(Qe), 960, H(Ye), N)), tt = /* @__PURE__ */ P(() => Math.max(N.left, H(ie) - H(oe))), nt = /* @__PURE__ */ P(() => Math.min(H(Ye) - N.right, H(ie) - H(oe) + H(ne))), rt = /* @__PURE__ */ P(() => Math.max(N.left, H(ae) - H(oe))), it = /* @__PURE__ */ P(() => Math.min(H(Ye) - N.right, H(ae) - H(oe) + H(ne))), at = /* @__PURE__ */ P(() => t_(t.indexed, {
		width: 960,
		height: 500,
		margin: N,
		minimumVisibleThickness: 1,
		verticalDomainMax: H(Ze).size > 0 ? H($e) : void 0,
		groupByKind: H(ce) === "itemTypes"
	}, H(Xe))), ct = /* @__PURE__ */ P(() => r_(H(at), 960, H(Ye), N)), lt = /* @__PURE__ */ P(() => H(ct).layout), ut = /* @__PURE__ */ P(() => u() === null || !H(re) || !p() ? null : {
		itemId: u(),
		visible: lr(u(), H(ce), H(lt).ribbons, {
			left: (H(rt) - H(ct).offset) / (H(ct).scale || 1),
			right: (H(it) - H(ct).offset) / (H(ct).scale || 1)
		})
	}), dt = /* @__PURE__ */ P(() => JSON.stringify(H(ut))), ft = /* @__PURE__ */ P(() => H(se) === "visible" ? Rp(H(et), H(tt), H(nt)) : Le), pt = /* @__PURE__ */ P(() => Math.max(1, H(Ze).size > 0 ? H($e) : H(at).maxTotalDisplayWeight)), mt = /* @__PURE__ */ P(() => H(se) === "visible" ? H(pt) / Math.max(1, H(ft).maxWeight) : 1), ht = /* @__PURE__ */ P(() => (500 - N.bottom) * (1 - H(mt))), gt = /* @__PURE__ */ P(() => H(mt) === 1 ? H(ct).transform : `${H(ct).transform} matrix(1 0 0 ${H(mt)} 0 ${H(ht)})`), _t = /* @__PURE__ */ P(() => Tu(t.indexed.analysis)), vt = /* @__PURE__ */ P(() => H(se) === "visible" ? H(ft).maxWeight : H($e)), yt = /* @__PURE__ */ P(() => Math.max(1, H(vt))), bt = /* @__PURE__ */ P(() => bl(H(lt).columns, H(Ze), {
		width: H(Ye),
		height: 500,
		margin: N,
		minimumVisibleThickness: 1
	}, H(yt))), xt = /* @__PURE__ */ P(() => [...H(Ze).values()].some((e) => e.gap > 0)), St = /* @__PURE__ */ P(() => H(Ze).get(c() ?? l() ?? -1)), Ct = /* @__PURE__ */ P(() => zp(H(vt))), wt = /* @__PURE__ */ P(() => H(Ct).map((e, t) => ({
		value: e,
		position: t,
		y: N.top + H(lt).innerHeight * (1 - e / H(yt)),
		percent: Math.max(0, Math.min(100, 100 * (1 - e / H(yt))))
	}))), Tt = /* @__PURE__ */ P(() => t.indexed.analysis.displayWeightUnit === "unavailable" ? "structural placeholder stack weight (token geometry unavailable)" : Wa(t.indexed.analysis.displayWeightUnit)), Et = /* @__PURE__ */ P(() => H(se) === "session" ? `Session-wide scale in ${H(Tt)}. Ribbon heights remain comparable across the session.` : `${H(ft).visibleCallCount} visible call markers in ${H(Tt)}. Viewport edges are interpolated where needed; ribbon heights change as you pan or zoom.`), Dt = /* @__PURE__ */ P(() => `Vertical axis. ${H(Et)} Tick values: ${H(Ct).map(Up).join(", ")}.`), Ot = /* @__PURE__ */ P(() => new Map(H(lt).columns.map((e) => [e.callIndex, e]))), kt = /* @__PURE__ */ P(() => new Map(H(lt).ribbons.filter((e) => e.groupKind === void 0).map((e) => [e.itemId, e]))), At = /* @__PURE__ */ P(() => d() === null ? null : H(kt).get(d()) ?? null), jt = /* @__PURE__ */ P(() => u() === null ? null : H(kt).get(u()) ?? null), Mt = /* @__PURE__ */ P(() => u() ?? d()), Nt = /* @__PURE__ */ P(() => new Map(H(lt).ribbons.map((e) => [e.key, e]))), Pt = /* @__PURE__ */ P(() => H(lt).ribbons.reduce((e, t) => {
		let n = e.get(t.itemId);
		return n ? n.push(t) : e.set(t.itemId, [t]), e;
	}, /* @__PURE__ */ new Map())), Ft = /* @__PURE__ */ P(() => H(ze) !== null && H(Nt).has(H(ze)) ? H(ze) : H(jt)?.key ?? H(lt).ribbons[0]?.key ?? null), It = /* @__PURE__ */ P(() => nh(H(lt).columns, 52, c())), Lt = /* @__PURE__ */ P(() => [...H(It)].map((e) => H(lt).columns[e]?.callIndex)), Rt = /* @__PURE__ */ P(() => c() !== null && H(Lt).includes(c()) ? c() : H(Lt)[0] ?? null), zt = /* @__PURE__ */ P(() => H(Mt) === null ? [] : H(lt).lineageConnectors.map((e, t) => ({
		connector: e,
		index: t
	})).filter(({ connector: e }) => e.fromItemId === H(Mt) || e.toItemId === H(Mt))), Bt = /* @__PURE__ */ P(() => H(lt).columns.map((e) => ({
		callIndex: e.callIndex,
		x: e.x,
		sourceRecordId: t.indexed.callByIndex.get(e.callIndex)?.sourceRecordId ?? null
	}))), Vt = /* @__PURE__ */ P(() => H(Bt).length < 2 ? Infinity : H(Bt).reduce((e, t, n) => n === 0 ? e : Math.min(e, t.x - H(Bt)[n - 1].x), Infinity)), Ht = /* @__PURE__ */ P(() => H(Vt) < 52 ? Math.ceil(52 / Math.max(1, H(Vt))) : 1), Ut = /* @__PURE__ */ P(() => nh(H(lt).columns, 52, null)), Wt = /* @__PURE__ */ P(() => H(qe) > 0 ? Math.max(1, H(Je) / H(qe)) : 1), Gt = /* @__PURE__ */ P(() => H(be) === null || H(Ye) <= H(ne) + 1), Kt = /* @__PURE__ */ P(() => H(qe) * Math.min(256, Math.max(1, H(Ge) - 1))), qt = /* @__PURE__ */ P(() => H(Ge) > 1 && H(Je) < H(Kt) - .5), Jt = /* @__PURE__ */ P(() => H(Ge) > 1 && !H(Gt) && H(Wt) > 1.01), Yt = /* @__PURE__ */ P(() => H(je) ? {
		x: Math.min(Sn(H(je).startClientX), Sn(H(je).currentClientX)),
		width: Math.abs(Sn(H(je).currentClientX) - Sn(H(je).startClientX))
	} : null);
	Tn(() => {
		let e = y();
		e !== x && (x = e, yr(() => ee(e)));
	}), Tn(() => he.observeIdentity(t.indexed)), Tn(() => ge.observeIdentity(t.indexed)), Tn(() => {
		if (H(dt) === Oe) return;
		Oe = H(dt);
		let e = H(ut);
		yr(() => g()(e));
	}), Tn(() => {
		Fe !== p() && (Fe = p(), yr(Re));
	}), Tn(() => {
		H(We), H(ne), H(be), H(Se), yr(Xt);
	}), Cn(() => {
		f(), p(), H(Ye), H(lt), H(We), H(ne), H(re), H(be), H(Ae), H(Ce), H(fe), H(j), yr(Zt);
	});
	function Xt() {
		if (D) {
			if (H(Se) && H(be) !== null && H(ne) !== Te) {
				I(Ce, H(Se), !0);
				return;
			}
			if (!H(Ae) && H(be) !== null && (H(We) !== we || H(ne) !== Te)) {
				let e = H(ne) === Te ? sa(ke, D.scrollLeft, en(), rn()) : gp(ke, D.scrollLeft + Te / 2 - H(oe), H(ne) / 2);
				e && I(Ae, {
					kind: "anchor",
					anchor: e
				}, !0);
			}
		}
	}
	function Zt() {
		if (D) {
			if (me && !me.isConnected && (me = null), un(), f() && f().id !== Ee && nn() && (Ee = f().id, xn(f())), H(Ce)) {
				let e = H(Ce);
				if (I(Ce, null), H(Se) === e && H(be) !== null) {
					let t = fn(e.startCallIndex, e.endCallIndex, en() / 2);
					if (t) {
						let e = _p(t.intervalCount, H(Ke), H(Ge));
						mn(Math.min(H(Kt), e), t.anchor);
					} else I(Se, null);
				}
			}
			if (an(), we = H(We), Te = H(ne), ke = H(Bt), cn(), H(fe) && H(j)) {
				let e = qn();
				e !== H(ve) && I(ve, e, !0);
			}
		}
	}
	let Qt = null;
	function $t() {
		Qt === null && (Qt = requestAnimationFrame(() => {
			Qt = null, an(), cn(), Kn();
		}));
	}
	zi(() => {
		let e = yp(D, {
			onScroll: $t,
			onDocumentScroll: Kn,
			onWheel: (e) => {
				if (!(e.metaKey || e.ctrlKey) || H(Ge) < 2) return;
				e.preventDefault();
				let t = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 16 : e.deltaMode === WheelEvent.DOM_DELTA_PAGE ? e.deltaY * Math.max(1, D.clientHeight) : e.deltaY;
				hn(e.clientX, Math.exp(-t * .0035));
			},
			onPointerMove: Mn,
			onPointerUp: Nn,
			onPointerCancel: Pn,
			onKeyUp: (e) => {
				e.code === "Space" && (Pe = !1);
			},
			onBlur: () => {
				Pe = !1, Fn();
			},
			onResize: (e, t) => {
				if (H(ne) !== e) {
					let t = Me.pointers.length > 0;
					Fn(), t && (Me = {
						...Me,
						suppressClick: !0
					}), I(ne, e, !0);
				}
				I(re, !0), an(), t === "element" && (cn(), Kn());
			}
		});
		return () => {
			he.dispose(), ge.dispose(), Fn(), Ne !== null && window.clearTimeout(Ne), Qt !== null && cancelAnimationFrame(Qt), e();
		};
	});
	function en() {
		return D?.clientWidth > 0 ? D.clientWidth : H(re) ? H(ne) : 0;
	}
	function tn() {
		return Math.max(D?.scrollWidth ?? 0, H(Ye));
	}
	function nn() {
		return !p() || !D || D.clientWidth <= 0 ? !1 : Math.abs(D.clientWidth - H(ne)) > .5 ? (I(ne, D.clientWidth, !0), I(re, !0), !1) : !0;
	}
	function rn() {
		if (!D || !O) return 0;
		let e = D.getBoundingClientRect(), t = O.getBoundingClientRect();
		return !Number.isFinite(e.left) || !Number.isFinite(t.left) ? 0 : t.left - e.left + D.scrollLeft - D.clientLeft;
	}
	function an() {
		if (!D) return;
		H(ae) !== D.scrollLeft && I(ae, D.scrollLeft, !0);
		let e = rn();
		Math.abs(H(oe) - e) > .01 && I(oe, e, !0), H(se) === "visible" && H(ie) !== D.scrollLeft && I(ie, D.scrollLeft, !0);
	}
	function on(e) {
		I(se, e, !0), e === "visible" && D && (I(ie, D.scrollLeft, !0), I(oe, rn(), !0));
	}
	function sn() {
		let e = en(), t = tn(), n = H(re) || e > 0, r = H(oe), i = n ? aa(H(Bt), D.scrollLeft, e, r) : {
			firstVisibleCallIndex: null,
			lastVisibleCallIndex: null
		};
		return {
			ready: n,
			isFitAll: H(Gt),
			zoomFactor: H(Wt),
			canZoomIn: H(qt),
			canZoomOut: H(Jt),
			totalCallCount: H(Ge),
			hasOverflow: n && t > e + 1,
			centerCallIndex: n ? Zm(D.scrollLeft + e / 2 - r, H(lt).columns) : null,
			...i
		};
	}
	function cn() {
		if (!D) return;
		let e = sn(), t = JSON.stringify(e);
		t !== De && (De = t, m()(e)), e.ready && Ee !== null && !H(Ae) && !H(Ce) && Ee !== s && (s = Ee, h()(Ee));
	}
	function ln(e) {
		D.scrollLeft = ia(e, tn(), en()), an(), cn();
	}
	function un() {
		if (!H(Ae)) return;
		let e = H(Ae);
		if (I(Ae, null), e === "fit") {
			D.scrollLeft = 0, an();
			return;
		}
		let t = ca(e.anchor, H(Bt), en(), tn(), rn());
		D.scrollLeft = t ?? ia(D.scrollLeft, tn(), en()), an();
	}
	function dn(e, t) {
		return mp(H(Bt), e, t);
	}
	function fn(e, t, n) {
		return hp(H(Bt), e, t, n);
	}
	function pn(e) {
		let t = Math.min(H(Ye) - N.right, Math.max(N.left, Sn(e))), n = D.getBoundingClientRect();
		return gp(H(Bt), t, e - n.left - D.clientLeft);
	}
	function mn(e, t = null) {
		let n = H(be), r = vp(H(be), e, H(qe), H(Kt), t);
		if (I(be, r.spacing, !0), r.adjustment && (I(Ae, r.adjustment, !0), H(be) === n && un()), r.immediateAnchor) {
			let e = ca(r.immediateAnchor, H(Bt), en(), tn(), rn());
			e !== null && ln(e);
		}
	}
	function hn(e, t) {
		if (H(Ge) < 2 || !Number.isFinite(t) || t <= 0) return;
		I(Se, null);
		let n = pn(e);
		mn(Math.min(H(Kt), Math.max(H(qe), H(Je) * t)), n);
	}
	function gn(e) {
		hn(D.getBoundingClientRect().left + en() / 2, e === "in" ? Ie : 1 / Ie);
	}
	function _n(e, t = !1) {
		if (t || I(Se, null), H(Ge) < 2) return;
		let n = H(Je);
		if (H(be) === null) {
			let e = Math.min(15, H(Ge));
			e > 1 && (n = H(Ke) / (e - 1));
		}
		let r = dn(e, en() / 2);
		mn(n, r);
	}
	function vn(e, t) {
		let n = wn(e, !0), r = wn(t, !0);
		n !== null && r !== null && yn(n, r);
	}
	function yn(e, t) {
		let n = fn(e, t, en() / 2);
		if (n) {
			if (I(Se, {
				startCallIndex: e,
				endCallIndex: t
			}, !0), n.intervalCount === 0) {
				_n(e, !0);
				return;
			}
			mn(Math.min(H(Kt), H(Ke) / n.intervalCount), n.anchor);
		}
	}
	function bn(e, n) {
		let r = t.indexed.itemById.get(e);
		if (!r || r.presence.length === 0) return;
		T("items"), I(ce, "items");
		let i = H(it) > H(rt) ? (H(rt) + H(it)) / 2 : NaN, a = n === null ? NaN : H(Ot).get(n)?.x ?? NaN, o = o_(r.presence, H(lt).columns, Number.isFinite(i) ? i : a, c());
		if (o === null) return;
		let s = dn(o, en() / 2);
		if (!s) return;
		let l = ca(s, H(Bt), en(), tn(), rn());
		l !== null && ln(l);
	}
	function xn(e) {
		if (e.kind === "reveal-item") {
			bn(e.itemId, e.referenceCallIndex);
			return;
		}
		if (e.kind === "fit") {
			I(Se, null), mn(null);
			return;
		}
		if (e.kind === "zoom-in" || e.kind === "zoom-out") {
			gn(e.kind === "zoom-in" ? "in" : "out");
			return;
		}
		if (e.kind === "latest") {
			I(Se, null), ln(oa(tn(), en()));
			return;
		}
		if (e.kind === "ensure-call") {
			let t = H(Bt).find((t) => t.callIndex === e.callIndex);
			if (!t) return;
			let n = ra(t.x + rn(), D.scrollLeft, en(), tn());
			Math.abs(n - D.scrollLeft) > .5 && I(Se, null), ln(n);
			return;
		}
		if (e.kind === "range") {
			yn(e.startCallIndex, e.endCallIndex);
			return;
		}
		if (e.kind === "recent") {
			let n = t.indexed.analysis.modelCalls, r = Math.max(2, Math.floor(H(Ke) / e.minCallSpacing) + 1);
			if (n.length <= r) {
				I(Se, null), mn(null);
				return;
			}
			yn(n[n.length - r].index, n[n.length - 1].index);
			return;
		}
	}
	function Sn(e) {
		let t = O.getBoundingClientRect();
		return Qm(e, t.left, t.width, H(Ye));
	}
	function wn(e, t = !1) {
		let n = Sn(e);
		if (t) n = Math.min(H(Ye) - N.right, Math.max(N.left, n));
		else if (n < N.left || n > H(Ye) - N.right) return null;
		return Zm(n, H(lt).columns);
	}
	function En(e) {
		return wn(e.clientX);
	}
	function Dn(e) {
		let t = g_(Me);
		return Me = t.state, t.suppressed ? (Ne !== null && window.clearTimeout(Ne), Ne = null, e.preventDefault(), e.stopPropagation(), !0) : !1;
	}
	function On() {
		Ne !== null && window.clearTimeout(Ne), Ne = window.setTimeout(() => {
			Me = __(Me), Ne = null;
		}, 0);
	}
	function kn(e) {
		for (let t of e) switch (t.kind) {
			case "capture":
				t.pointerIds.forEach((e) => xp(D, e));
				break;
			case "release":
				t.pointerIds.forEach((e) => Sp(D, e));
				break;
			case "clear-selection":
				I(je, null);
				break;
			case "clear-requested-range":
				I(Se, null);
				break;
			case "selection":
				I(je, {
					startClientX: t.startX,
					currentClientX: t.currentX
				});
				break;
			case "scroll":
				ln(t.scrollLeft);
				break;
			case "zoom-range":
				vn(t.startX, t.endX);
				break;
			case "pinch-zoom": {
				let e = D.getBoundingClientRect(), n = {
					...t.anchor,
					offsetFromViewportLeft: t.centerX - e.left - D.clientLeft
				}, r = t.distance / t.startDistance;
				mn(t.startSpacing * r ** 1.7, n);
				break;
			}
			case "suppress-click": On();
		}
	}
	function An(e) {
		return e.target instanceof Node && k !== void 0 && k.contains(e.target);
	}
	function jn(e) {
		if (!An(e)) return;
		let t = bp(e), n = u_(c_(Me.pointers, t)), r = n ? pn(n.x) : null, i = d_(Me, t, {
			spaceHeld: Pe,
			scrollLeft: D.scrollLeft,
			callSpacing: H(Je),
			pinchAnchor: r
		});
		Me = i.state, i.effects.some((e) => e.kind === "prevent-default") && e.preventDefault(), kn(i.effects);
	}
	function Mn(e) {
		if (!Me.pointers.some((t) => t.pointerId === e.pointerId)) return;
		let t = f_(Me, bp(e), { dragThreshold: 7 });
		Me = t.state, kn(t.effects);
	}
	function Nn(e) {
		let t = u_(l_(Me.pointers, e.pointerId)), n = t ? pn(t.x) : null, r = p_(Me, e.pointerId, {
			clientX: e.clientX,
			callSpacing: H(Je),
			pinchAnchor: n
		});
		Me = r.state, kn(r.effects);
	}
	function Pn(e) {
		let t = m_(Me, e.pointerId);
		Me = t.state, kn(t.effects);
	}
	function Fn() {
		let e = h_(Me);
		Me = e.state, kn(e.effects), Ne !== null && window.clearTimeout(Ne), Ne = null;
	}
	function In(e) {
		An(e) && t.onHoverCall(En(e));
	}
	function Ln(e) {
		w({
			...y(),
			economics: {
				...y().economics,
				expanded: e !== "off",
				lastMode: e === "off" ? y().economics.lastMode : e
			}
		});
	}
	function Rn() {
		return !p() || H(ue) === "off" ? !1 : H(fe) ? (Jn(), !0) : (Ln("off"), H(S)?.focus({ preventScroll: !0 }), !0);
	}
	function zn(e) {
		I(de, e, !0);
	}
	function Bn(e) {
		I(fe, e, !0), e === null && I(ve, "");
	}
	function Vn() {
		let e = H(fe)?.callIndices ?? [];
		if (e.length === 0) return;
		let t = Math.min(...e), n = Math.max(...e);
		t === n ? _n(t) : yn(t, n);
	}
	function Hn(e, t, n, r = null, i) {
		H(pe) === null && (me = r ?? (Vi(D).activeElement instanceof HTMLElement ? Vi(D).activeElement : null));
		let a = r?.getBoundingClientRect(), o = {
			kind: e,
			memberIds: t,
			callIndex: n,
			anchor: i ?? {
				x: a ? (Math.max(8, a.left) + Math.min(window.innerWidth - 8, a.right)) / 2 : 8,
				y: a ? (Math.max(8, a.top) + Math.min(window.innerHeight - 8, a.bottom)) / 2 : 8
			}
		};
		I(pe, o), he.focusAfterUpdate(() => Vi(D).getElementById("group-breakdown-close"), () => H(pe) !== null && p(), { preventScroll: !0 });
	}
	function Un(e = !0) {
		let t = me;
		I(pe, null), me = null, he.cancel(), e && t?.isConnected && he.focusAfterUpdate(() => t, () => H(pe) === null && p(), { preventScroll: !0 });
	}
	function Wn(e, t, n, r) {
		let i = wn(r.clientX, !0), a = A.getBoundingClientRect(), o = r.clientX - a.left;
		I(_e, {
			kind: e,
			total: i === null ? 0 : t?.get(i) ?? 0,
			callIndex: i,
			itemCount: n,
			x: o,
			y: r.clientY - a.top,
			flip: o > a.width - 260
		});
	}
	function Gn() {
		T("items"), Un(!1);
	}
	function Kn() {
		H(fe) && (I(ve, qn(), !0), D && !Fm(D, H(fe)) && Jn(!1));
	}
	function qn() {
		return D ? Im(D, H(j), H(fe)) : "";
	}
	function Jn(e = !0) {
		H(ye)?.closeEventBreakdown(e);
	}
	function Yn(e) {
		Jn(!1), t.onPinCall(e), ge.focusAfterUpdate(() => Vi(D).getElementById(`economics-call-${e}`), () => p() && t.indexed.callByIndex.has(e));
	}
	function Xn(e, n) {
		Dn(e) || (e.stopPropagation(), t.onPinCall(n));
	}
	function Zn(e) {
		if (Dn(e) || !An(e)) return;
		let n = En(e);
		n !== null && t.onEmptyClick(n);
	}
	function Qn(e, t) {
		Dn(e) || (e.stopPropagation(), $n(t));
	}
	function $n(e) {
		t.onSelectItem(e);
		let n = t.indexed.itemById.get(e)?.presence[0]?.startCall;
		n !== void 0 && t.indexed.callByIndex.has(n) && t.onPinCall(n);
	}
	function er(e, n, r) {
		if (Dn(e)) return;
		e.stopPropagation();
		let i = wn(e.clientX, !0);
		Hn(n, i === null ? r : r.filter((e) => t.indexed.contextSetByCall.get(i)?.has(e)), i, e.currentTarget instanceof SVGElement ? e.currentTarget : null, {
			x: e.clientX,
			y: e.clientY
		});
	}
	function tr(e, n, r) {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			let i = c();
			Hn(n, i === null ? r : r.filter((e) => t.indexed.contextSetByCall.get(i)?.has(e)), i, e.currentTarget instanceof SVGElement ? e.currentTarget : null);
		} else e.key === "Escape" && nr(e);
	}
	function nr(e) {
		(t.onEscape() !== !1 || _()) && (e.preventDefault(), e.stopPropagation());
	}
	function rr(e) {
		e.key === "Escape" ? nr(e) : e.code === "Space" && (e.target === D || e.target === O) && (Pe = !0, e.preventDefault());
	}
	function ir(e, n) {
		if (![
			"ArrowUp",
			"ArrowDown",
			"Home",
			"End"
		].includes(e.key)) return !1;
		e.preventDefault();
		let r;
		if (n.groupKind !== void 0) r = H(lt).ribbons;
		else {
			let e = c() !== null && c() >= n.startCall && c() <= n.endCall ? c() : n.startCall;
			r = (t.indexed.orderedItemIdsByCall.get(e) ?? []).flatMap((t) => H(Pt).get(t)?.filter((t) => t.startCall <= e && e <= t.endCall) ?? []);
		}
		let i = r.findIndex((e) => e.key === n.key), a = e.key === "Home" ? r[0] : e.key === "End" ? r[r.length - 1] : r[i + (e.key === "ArrowUp" ? 1 : -1)];
		return !a || (I(ze, a.key, !0), D?.querySelector(`[data-ribbon-key="${CSS.escape(a.key)}"]`)?.focus({ preventScroll: !0 }), !0);
	}
	function ar(e, t) {
		e.key === "Enter" || e.key === " " ? (e.preventDefault(), $n(t)) : e.key === "Escape" && nr(e);
	}
	function or(e, n) {
		e.key === "Enter" || e.key === " " ? (e.preventDefault(), t.onPinCall(n)) : e.key === "Escape" && nr(e);
	}
	function sr(e) {
		return e.thinnest * H(mt) < 1;
	}
	function cr(e) {
		return Ao(t.indexed.itemById.get(e), e);
	}
	function lr(e, n, r, i) {
		if (n === "items") return i_(e, r, i);
		let a = t.indexed.itemById.get(e);
		return a ? r.some((t) => t.memberItemIds?.includes(e) && t.points.some((e) => a_(a.presence, e.callIndex) && e.x >= i.left && e.x <= i.right)) : !1;
	}
	var ur = { dismissEconomics: Rn }, dr = nv(), fr = R(dr), pr = (e) => {
		var t = S_();
		Ws(L(t), {
			label: "View",
			children: (e, t) => {
				a(e);
			},
			$$slots: { default: !0 }
		}), M(t), G(e, t);
	}, mr = (e) => {
		var t = C_(), n = L(t);
		a(n), M(t), G(e, t);
	};
	q(fr, (e) => {
		v() ? e(pr) : e(mr, -1);
	});
	var hr = B(fr, 2);
	let gr;
	var _r = L(hr), vr = L(_r);
	J(vr, 21, () => H(wt), (e) => e.value, (e, t) => {
		var n = w_();
		let r, i;
		var a = z(n, !0);
		V((e) => {
			r = gi(n, 1, "vertical-axis-tick svelte-13ao2q1", null, r, {
				top: H(t).position === H(wt).length - 1,
				bottom: H(t).position === 0
			}), i = vi(n, "", i, { top: `${H(t).percent}%` }), K(a, e);
		}, [() => Up(H(t).value)]), G(e, n);
	}), M(vr);
	var br = B(vr, 2), xr = L(br), Sr = z(xr), Cr = B(xr, 2);
	let wr;
	var Tr = L(Cr);
	Y(Tr, "height", 500);
	var Er = L(Tr), Dr = L(Er), kr = (e) => {
		var t = D_(), n = R(t), r = B(n), i = L(r), a = B(i), s = L(a);
		J(s, 17, () => H(lt).ribbons, (e) => e.key, (e, t) => {
			var n = T_();
			V((e, r) => {
				Y(n, "d", H(t).path), Y(n, "stroke", e), Y(n, "stroke-width", r);
			}, [() => sr(H(t)) ? "black" : "none", () => sr(H(t)) ? 1.25 : 0]), G(e, n);
		}), J(B(s), 17, () => H(lt).lineageConnectors, (e) => e.key, (e, t) => {
			var n = E_();
			V(() => Y(n, "d", H(t).mergePath)), G(e, n);
		}), M(a), M(r), V(() => {
			Y(n, "id", `${o}-input-hatch`), Y(r, "id", `${o}-input-mask`), Y(r, "x", N.left), Y(r, "y", N.top), Y(r, "width", H(lt).innerWidth), Y(r, "height", H(lt).innerHeight), Y(i, "x", N.left), Y(i, "y", N.top), Y(i, "width", H(lt).innerWidth), Y(i, "height", H(lt).innerHeight), Y(a, "transform", H(gt));
		}), G(e, t);
	};
	q(Dr, (e) => {
		H(xt) && e(kr);
	});
	var Ar = B(Dr);
	J(Ar, 19, () => H(lt).lineageConnectors, (e) => e.key, (e, r, i) => {
		var a = O_(), s = L(a), c = B(s);
		M(a), V((e, t) => {
			Y(a, "id", `${o}-${H(i)}`), Y(a, "x1", H(r).sourceX), Y(a, "y1", H(r).sourceY), Y(a, "x2", H(r).targetX), Y(a, "y2", H(r).sourceY), Y(s, "stop-color", e), Y(c, "stop-color", t);
		}, [() => wa(t.indexed, H(r).fromItemId, n()), () => wa(t.indexed, H(r).toItemId, n())]), G(e, a);
	});
	var jr = B(Ar);
	M(Er);
	var Mr = B(Er), Nr = B(Mr);
	J(Nr, 17, () => H(wt), (e) => e.value, (e, t) => {
		var n = k_();
		V(() => {
			Y(n, "x1", N.left), Y(n, "x2", H(Ye) - N.right), Y(n, "y1", H(t).y), Y(n, "y2", H(t).y);
		}), G(e, n);
	});
	var Pr = B(Nr);
	J(Pr, 19, () => H(lt).columns, (e) => e.callIndex, (e, t, n) => {
		var r = Br(), i = R(r), a = (e) => {
			var n = A_();
			V(() => {
				Y(n, "x1", H(t).x), Y(n, "x2", H(t).x), Y(n, "y1", N.top), Y(n, "y2", 500 - N.bottom);
			}), G(e, n);
		}, o = /* @__PURE__ */ P(() => H(Ut).has(H(n)));
		q(i, (e) => {
			H(o) && e(a);
		}), G(e, r);
	});
	var Fr = B(Pr);
	J(Fr, 17, () => H(lt).compactions, (e) => e.compactionId, (e, t) => {
		var n = j_(), r = L(n), i = z(r), a = B(r), o = B(a), s = z(o, !0);
		M(n), V(() => {
			Y(n, "aria-label", `Compaction before call ${H(t).beforeModelCall}`), K(i, `Compaction before call ${H(t).beforeModelCall ?? ""}`), Y(a, "x1", H(t).x), Y(a, "x2", H(t).x), Y(a, "y1", N.top - 8), Y(a, "y2", 500 - N.bottom), Y(o, "x", H(t).x + 5), Y(o, "y", N.top - 13), K(s, H(Vt) < 64 ? "C" : "COMPACT");
		}), G(e, n);
	});
	var Ir = B(Fr), W = L(Ir);
	J(W, 19, () => H(lt).lineageConnectors, (e) => e.key, (e, t, n) => {
		var r = M_();
		V(() => {
			Y(r, "d", H(t).mergePath), Y(r, "fill", `url(#${o}-${H(n)})`);
		}), G(e, r);
	}), J(B(W), 17, () => H(lt).ribbons, (e) => e.key, (e, r) => {
		let i = /* @__PURE__ */ P(() => H(r).groupKind !== void 0), a = /* @__PURE__ */ P(() => H(r).groupKind ? Ca(H(r).groupKind, n()) : wa(t.indexed, H(r).itemId, n())), o = /* @__PURE__ */ P(() => H(i) ? `Item type ${Io(H(r).groupKind)} · ${H(r).memberItemIds?.length ?? 0} items` : cr(H(r).itemId));
		var s = P_();
		let c;
		var l = L(s);
		let d;
		var f = B(l), p = L(f), m = (e) => {
			var t = N_(), n = z(t, !0);
			V(() => K(n, H(o))), G(e, t);
		};
		q(p, (e) => {
			H(i) || e(m);
		}), M(f), M(s), V((e, n, p) => {
			c = gi(s, 0, "ribbon-group svelte-13ao2q1", null, c, {
				"group-ribbon": H(i),
				selected: !H(i) && u() === H(r).itemId,
				unknown: t.indexed.analysis.displayWeightUnit === "unavailable"
			}), d = gi(l, 0, "ribbon svelte-13ao2q1", null, d, { subpixel: e }), Y(l, "d", H(r).path), Y(l, "fill", t.indexed.analysis.displayWeightUnit === "unavailable" ? "url(#unknown-geometry)" : H(a)), Y(l, "stroke", n), Y(l, "stroke-width", p), Y(f, "d", H(r).hitPath), Y(f, "tabindex", H(r).key === H(Ft) ? 0 : -1), Y(f, "data-ribbon-key", H(r).key), Y(f, "aria-label", H(o)), Y(f, "aria-pressed", !H(i) && u() === H(r).itemId);
		}, [
			() => sr(H(r)),
			() => sr(H(r)) ? H(a) : "none",
			() => sr(H(r)) ? 1.25 : 0
		]), Or("pointerenter", f, (e) => H(i) ? Wn(H(r).groupKind, H(r).valueByCall, H(r).memberItemIds?.length ?? 0, e) : t.onHoverItem(H(r).itemId, e)), U("pointermove", f, (e) => H(i) ? Wn(H(r).groupKind, H(r).valueByCall, H(r).memberItemIds?.length ?? 0, e) : t.onHoverItem(H(r).itemId, e)), Or("pointerleave", f, () => {
			H(i) ? I(_e, null) : t.onHoverItem(null);
		}), U("mousedown", f, (e) => {
			H(i) && e.preventDefault();
		}), U("click", f, (e) => H(i) ? er(e, H(r).groupKind, H(r).memberItemIds ?? []) : Qn(e, H(r).itemId)), Or("focus", f, () => I(ze, H(r).key, !0)), U("keydown", f, (e) => {
			ir(e, H(r)) || (H(i) ? tr(e, H(r).groupKind, H(r).memberItemIds ?? []) : ar(e, H(r).itemId));
		}), G(e, s);
	}), M(Ir);
	var Lr = B(Ir), Rr = (e) => {
		var t = L_();
		J(t, 21, () => H(bt), $r, (e, t) => {
			var n = I_(), r = R(n), i = (e) => {
				var n = F_();
				V(() => {
					Y(n, "d", H(t).fill), Y(n, "fill", `url(#${o}-input-hatch)`), Y(n, "mask", `url(#${o}-input-mask)`);
				}), G(e, n);
			};
			q(r, (e) => {
				H(xt) && H(t).fill && e(i);
			});
			var a = B(r);
			V(() => Y(a, "d", H(t).line)), G(e, n);
		}), M(t), G(e, t);
	};
	q(Lr, (e) => {
		H(Ze).size > 0 && e(Rr);
	}), M(Tr), Li(Tr, (e) => O = e, () => O);
	var Vr = B(Tr, 2);
	Y(Vr, "height", 500);
	var Hr = L(Vr);
	J(Hr, 19, () => H(lt).columns, (e) => e.callIndex, (e, n, r) => {
		var i = Br(), a = R(i), o = (e) => {
			var r = R_();
			let i;
			var a = L(r), o = B(a);
			Y(o, "y", 483);
			var s = z(o, !0);
			M(r), V(() => {
				i = gi(r, 0, "call-target svelte-13ao2q1", null, i, {
					condensed: H(Ht) > 1,
					pinned: c() === H(n).callIndex
				}), Y(r, "data-call-index", H(n).callIndex), Y(r, "tabindex", H(n).callIndex === H(Rt) ? 0 : -1), Y(r, "aria-label", `Pin model call ${H(n).callIndex}`), Y(a, "x", H(n).x - 22), Y(a, "y", 500 - N.bottom + 5), Y(o, "x", H(n).x), K(s, H(n).callIndex);
			}), U("keydown", r, (e) => or(e, H(n).callIndex)), U("click", r, (e) => {
				Dn(e) || (e.stopPropagation(), t.onPinCall(H(n).callIndex));
			}), G(e, r);
		}, s = /* @__PURE__ */ P(() => H(It).has(H(r)));
		q(a, (e) => {
			H(s) && e(o);
		}), G(e, i);
	});
	var Ur = B(Hr), Wr = L(Ur);
	J(Wr, 17, () => H(zt), ({ connector: e, index: t }) => e.key, (e, t) => {
		let n = () => H(t).connector, r = () => H(t).index;
		var i = B_(), a = R(i);
		let s;
		var c = B(a), l = (e) => {
			var t = z_();
			V(() => Y(t, "d", n().path)), G(e, t);
		};
		q(c, (e) => {
			n().fromItemId === H(Mt) && e(l);
		}), V(() => {
			s = gi(a, 0, "compaction-merge-emphasis svelte-13ao2q1", null, s, { emphasized: n().fromItemId === H(Mt) }), Y(a, "d", n().mergePath), Y(a, "fill", `url(#${o}-${r()})`);
		}), G(e, i);
	});
	var Gr = B(Wr), Kr = (e) => {
		var r = V_();
		V((e) => {
			Y(r, "d", H(At).path), Y(r, "fill", e);
		}, [() => wa(t.indexed, H(At).itemId, n())]), G(e, r);
	};
	q(Gr, (e) => {
		H(At) && H(At) !== H(jt) && e(Kr);
	});
	var qr = B(Gr), Jr = (e) => {
		var r = H_();
		V((e) => {
			Y(r, "d", H(jt).path), Y(r, "fill", e);
		}, [() => wa(t.indexed, H(jt).itemId, n())]), G(e, r);
	};
	q(qr, (e) => {
		H(jt) && e(Jr);
	}), J(B(qr), 17, () => H(lt).versionMarks, (e) => e.key, (e, t) => {
		var n = U_();
		V(() => {
			Y(n, "x1", H(t).x), Y(n, "x2", H(t).x), Y(n, "y1", H(t).y0), Y(n, "y2", H(t).y1);
		}), G(e, n);
	}), M(Ur);
	var Yr = B(Ur), Xr = (e) => {
		var t = W_();
		V(() => {
			Y(t, "x", H(Yt).x), Y(t, "y", N.top), Y(t, "width", H(Yt).width), Y(t, "height", H(lt).innerHeight);
		}), G(e, t);
	};
	q(Yr, (e) => {
		H(Yt) && H(Yt).width > 0 && e(Xr);
	});
	var Zr = B(Yr), Qr = (e) => {
		let t = /* @__PURE__ */ P(() => H(Ot).get(l()));
		var n = Br(), r = R(n), i = (e) => {
			var n = G_();
			V(() => {
				Y(n, "x1", H(t).x), Y(n, "x2", H(t).x), Y(n, "y1", N.top), Y(n, "y2", 500 - N.bottom);
			}), G(e, n);
		};
		q(r, (e) => {
			H(t) && e(i);
		}), G(e, n);
	};
	q(Zr, (e) => {
		l() !== null && e(Qr);
	});
	var ei = B(Zr), ti = (e) => {
		let t = /* @__PURE__ */ P(() => H(Ot).get(c()));
		var n = Br(), r = R(n), i = (e) => {
			var n = K_();
			V(() => {
				Y(n, "x1", H(t).x), Y(n, "x2", H(t).x), Y(n, "y1", N.top), Y(n, "y2", 500 - N.bottom);
			}), G(e, n);
		};
		q(r, (e) => {
			H(t) && e(i);
		}), G(e, n);
	};
	q(ei, (e) => {
		c() !== null && e(ti);
	}), M(Vr), M(Cr), Li(Cr, (e) => k = e, () => k);
	var ni = B(Cr, 2), ri = (e) => {
		var t = q_();
		let r, i;
		var a = L(t), o = z(a, !0), s = B(a, 2), c = z(s), l = z(B(s, 2));
		M(t), V((e, n, a, s) => {
			r = gi(t, 1, "group-hover-card svelte-13ao2q1", null, r, { flip: H(_e).flip }), i = vi(t, "", i, {
				left: `${H(_e).x}px`,
				top: `${H(_e).y}px`,
				"--group-color": e
			}), K(o, n), K(c, `${a ?? ""}
            ${H(Tt) ?? ""} at call ${H(_e).callIndex ?? "—" ?? ""}`), K(l, `${s ?? ""} items`);
		}, [
			() => Ca(H(_e).kind, n()),
			() => Io(H(_e).kind),
			() => Up(H(_e).total),
			() => H(_e).itemCount.toLocaleString()
		]), G(e, t);
	};
	q(ni, (e) => {
		H(_e) && e(ri);
	});
	var ii = B(ni, 2), ai = (e) => {
		var t = Y_();
		J(B(L(t), 2), 17, () => [...new Set(H(lt).ribbons.map((e) => e.groupKind).filter(Boolean))], $r, (e, t) => {
			var r = J_(), i = L(r), a = B(i, 1, !0);
			M(r), V((e, t) => {
				vi(i, e), K(a, t);
			}, [() => `background:${Ca(H(t), n())}`, () => Io(H(t))]), G(e, r);
		}), M(t), G(e, t);
	};
	q(ii, (e) => {
		H(ce) === "itemTypes" && e(ai);
	});
	var oi = B(ii, 2), si = (e) => {
		var t = ev(), n = B(L(t), 2), r = (e) => {
			var t = X_();
			_a(B(L(t), 2), {
				id: "unreconciled-input-note",
				label: "About unreconciled input",
				children: (e, t) => {
					xe(), G(e, zr("The reported input minus the content estimated in the River. It can include request\n                framing and estimation differences. It is not lost content, and it is not attributed\n                to cost."));
				},
				$$slots: { default: !0 }
			}), M(t), G(e, t);
		};
		q(n, (e) => {
			H(xt) && e(r);
		});
		var i = B(n, 2), a = (e) => {
			var t = Z_(), n = L(t), r = B(n), i = (e) => {
				var t = zr();
				V((e) => K(t, `estimate
                exceeds reported by ~${e ?? ""}`), [() => Up(H(St).reconstructed - H(St).reported)]), G(e, t);
			}, a = (e) => {
				var t = zr();
				V((e) => K(t, `unreconciled ~${e ?? ""}`), [() => Up(H(St).gap)]), G(e, t);
			};
			q(r, (e) => {
				H(St).reconstructed > H(St).reported ? e(i) : e(a, -1);
			}), xe(), M(t), V((e, t) => K(n, `Call ${H(St).callIndex ?? ""}: reconstructed ${e ?? ""} · reported ${t ?? ""} · `), [() => Up(H(St).reconstructed), () => Up(H(St).reported)]), G(e, t);
		}, o = (e) => {
			var t = Q_(), n = z(t);
			V(() => K(n, `Call ${c() ?? l() ?? ""}: input comparison unavailable`)), G(e, t);
		}, s = (e) => {
			G(e, $_());
		};
		q(i, (e) => {
			H(St) ? e(a) : c() !== null || l() !== null ? e(o, 1) : e(s, -1);
		}), M(t), G(e, t);
	};
	q(oi, (e) => {
		H(Ze).size > 0 && e(si);
	});
	var ci = B(oi, 2);
	{
		let e = /* @__PURE__ */ P(() => t.indexed.analysis.session.costSummary.apiEquivalent.calls > 0);
		Xm(ci, {
			get mode() {
				return H(ue);
			},
			get lastMode() {
				return y().economics.lastMode;
			},
			get cacheView() {
				return H(le);
			},
			get cachePresentation() {
				return H(_t);
			},
			get costCopy() {
				return H(He);
			},
			get hasApiEquivalentCost() {
				return H(e);
			},
			onModeChange: Ln,
			onCacheViewChange: te,
			get headerElement() {
				return H(C);
			},
			set headerElement(e) {
				I(C, e, !0);
			},
			get triggerElement() {
				return H(S);
			},
			set triggerElement(e) {
				I(S, e, !0);
			}
		});
	}
	var ui = B(ci, 2), di = (e) => {
		Li(Cm(e, {
			get indexed() {
				return t.indexed;
			},
			get columns() {
				return H(lt).columns;
			},
			get width() {
				return H(Ye);
			},
			get mode() {
				return H(ue);
			},
			get cacheView() {
				return H(le);
			},
			get pinnedCallIndex() {
				return c();
			},
			get hoveredCallIndex() {
				return l();
			},
			get onPinCall() {
				return t.onPinCall;
			},
			get onHoverCall() {
				return t.onHoverCall;
			},
			onMarkClick: Xn,
			onReadoutChange: zn,
			onEventBreakdownChange: Bn
		}), (e) => I(ye, e, !0), () => H(ye));
	};
	q(ui, (e) => {
		H(ue) !== "off" && e(di);
	}), M(br), Li(br, (e) => D = e, () => D), M(_r), Li(_r, (e) => A = e, () => A);
	var fi = B(_r, 2), pi = (e) => {
		{
			let t = /* @__PURE__ */ P(() => Io(H(pe).kind));
			Mm(e, {
				get label() {
					return H(t);
				},
				get anchor() {
					return H(pe).anchor;
				},
				get memberLabels() {
					return H(Ue);
				},
				get memberCount() {
					return H(pe).memberIds.length;
				},
				get callIndex() {
					return H(pe).callIndex;
				},
				onClose: () => Un(),
				onShowItems: Gn
			});
		}
	};
	q(fi, (e) => {
		H(pe) && e(pi);
	});
	var mi = B(fi, 2), hi = (e) => {
		Dm(e, {
			get breakdown() {
				return H(fe);
			},
			get positionStyle() {
				return H(ve);
			},
			get canZoomIn() {
				return H(qt);
			},
			onClose: () => Jn(),
			onZoom: Vn,
			onInspect: Yn,
			get element() {
				return H(j);
			},
			set element(e) {
				I(j, e, !0);
			}
		});
	};
	q(mi, (e) => {
		H(fe) && e(hi);
	});
	var _i = B(mi, 2), yi = (e) => {
		var t = tv(), n = z(t, !0);
		V(() => K(n, H(de) || "Hover or focus a call for an exact readout.")), G(e, t);
	};
	q(_i, (e) => {
		H(ue) !== "off" && e(yi);
	}), M(hr), V(() => {
		gr = vi(hr, "", gr, { "--plot-left": `${N.left}px` }), Y(vr, "aria-label", H(Dt)), vi(vr, `top:${N.top}px;height:${H(lt).innerHeight}px`), K(Sr, `Context items flow horizontally through model calls. Tab reaches one context item and one
        call label; Up and Down arrows move between items in the stack, Home and End move to its
        bottom and top, Left and Right arrows move between calls, and Enter selects. Dashed vertical
        markers indicate compaction. In individual-item view, colour-blended connections show lossy
        summarization, not conserved tokens or source contributions to the summary. ${H(Et) ?? ""}.
        ${H(Ze).size > 0 ? "The dashed reported-input reference is recorded after each call. Hatched unreconciled input is its approximate excess over reconstructed content, not recovered items or cost attribution. Where a session does not record its system prompt or tools, an Unrecorded request context item is measured from the reported input at the first call and after each compaction or model change, so the hatching shows change since then. Scaling includes the reference. Missing comparisons break the line." : ""}
        ${t.indexed.analysis.displayWeightUnit === "unavailable" ? "Token geometry is unavailable; ribbon regions are structural placeholders, not measured token widths." : ""}`), wr = vi(Cr, "", wr, { width: `${H(Ye)}px` }), Y(Tr, "viewBox", `0 0 ${H(Ye)} 500`), Y(Tr, "width", H(Ye)), Y(jr, "patternTransform", `matrix(${1 / (H(ct).scale || 1)} 0 0 ${1 / H(mt)} ${-H(ct).offset / (H(ct).scale || 1)} ${-H(ht) / H(mt)}) rotate(35)`), Y(Mr, "x", N.left), Y(Mr, "y", N.top), Y(Mr, "width", H(lt).innerWidth), Y(Mr, "height", H(lt).innerHeight), Y(Ir, "transform", H(gt)), Y(Vr, "viewBox", `0 0 ${H(Ye)} 500`), Y(Vr, "width", H(Ye)), Y(Ur, "transform", H(gt));
	}), U("pointerdown", br, jn), U("pointermove", br, In), Or("selectstart", br, (e) => e.preventDefault()), Or("pointerleave", br, () => {
		t.onHoverCall(null), t.onHoverItem(null);
	}), U("keydown", br, rr), U("click", br, Zn), Or("pointerleave", Cr, () => t.onHoverCall(null)), G(e, dr);
	var bi = Ve(ur);
	return i(), bi;
}
kr([
	"click",
	"pointerdown",
	"pointermove",
	"keydown",
	"mousedown"
]);
//#endregion
//#region src/lib/components/CallOverview.svelte
var av = /* @__PURE__ */ W("<span class=\"model svelte-182syzp\"> </span> <button type=\"button\" class=\"svelte-182syzp\">View details</button>", 1), ov = /* @__PURE__ */ W("<p class=\"empty svelte-182syzp\"> </p>"), sv = /* @__PURE__ */ W("<small class=\"svelte-182syzp\"> </small>"), cv = /* @__PURE__ */ W("<p class=\"empty svelte-182syzp\">No items added or dropped.</p>"), lv = /* @__PURE__ */ W("<li class=\"svelte-182syzp\"><span class=\"change added svelte-182syzp\" aria-hidden=\"true\">+</span> <button type=\"button\" class=\"svelte-182syzp\"><span class=\"visually-hidden svelte-182syzp\">Added</span> </button> <span class=\"size svelte-182syzp\"> </span></li>"), uv = /* @__PURE__ */ W("<li class=\"more svelte-182syzp\"> </li>"), dv = /* @__PURE__ */ W("<li class=\"svelte-182syzp\"><span class=\"change dropped svelte-182syzp\" aria-hidden=\"true\">−</span> <button type=\"button\" class=\"svelte-182syzp\"><span class=\"visually-hidden svelte-182syzp\">Dropped</span> </button> <span class=\"size svelte-182syzp\"> </span></li>"), fv = /* @__PURE__ */ W("<ul role=\"list\" class=\"svelte-182syzp\"><!> <!> <!> <!></ul>"), pv = /* @__PURE__ */ W("<p class=\"empty svelte-182syzp\">No item estimates at this call.</p>"), mv = /* @__PURE__ */ W("<li class=\"svelte-182syzp\"><button type=\"button\" class=\"svelte-182syzp\"> </button> <span class=\"size svelte-182syzp\"> </span></li>"), hv = /* @__PURE__ */ W("<ol role=\"list\" class=\"svelte-182syzp\"></ol> <button type=\"button\" class=\"link svelte-182syzp\">Show all in Composition</button>", 1), gv = /* @__PURE__ */ W("<span> </span>"), _v = /* @__PURE__ */ W("<div class=\"tools svelte-182syzp\"><h3 class=\"svelte-182syzp\">Tools invoked after this response</h3> <div class=\"tool-list svelte-182syzp\"></div></div>"), vv = /* @__PURE__ */ W("<dl class=\"figures svelte-182syzp\"><div><dt class=\"svelte-182syzp\">Call</dt> <dd class=\"svelte-182syzp\"> </dd></div> <div><dt class=\"svelte-182syzp\">Input</dt> <dd class=\"svelte-182syzp\"> <!></dd></div> <div><dt class=\"svelte-182syzp\">Cost</dt> <dd class=\"svelte-182syzp\"> </dd></div></dl> <div><div><h3 title=\"Highwater's token estimates; they need not match the reported change in input.\" class=\"svelte-182syzp\"> </h3> <!></div> <div><h3 class=\"svelte-182syzp\">Largest items in context</h3> <!></div></div> <!>", 1), yv = /* @__PURE__ */ W("<section class=\"panel call-overview svelte-182syzp\" aria-labelledby=\"call-overview-heading\"><div class=\"heading svelte-182syzp\"><h2 id=\"call-overview-heading\" class=\"svelte-182syzp\"> </h2> <!></div> <!></section>"), bv = {
	hash: "svelte-182syzp",
	code: ".panel.svelte-182syzp {background:var(--surface);border-radius:var(--radius);padding:var(--panel-padding);min-width:0;}.heading.svelte-182syzp {display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px;}h2.svelte-182syzp {margin:0;font-size:var(--text-lg);}.model.svelte-182syzp {color:var(--secondary);font-size:var(--text-sm);overflow-wrap:anywhere;}.heading.svelte-182syzp button:where(.svelte-182syzp) {margin-left:auto;}.figures.svelte-182syzp {display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:8px 16px;margin:12px 0 0;}.figures.svelte-182syzp dt:where(.svelte-182syzp) {color:var(--secondary);font-size:var(--text-sm);}.figures.svelte-182syzp dd:where(.svelte-182syzp) {margin:0;color:var(--text-strong);font-weight:600;font-variant-numeric:tabular-nums;}.figures.svelte-182syzp small:where(.svelte-182syzp) {margin-left:4px;color:var(--secondary);font-weight:400;}.lists.svelte-182syzp {display:grid;grid-template-columns:minmax(0, 1fr);gap:12px 24px;margin-top:14px;}.lists.two-columns.svelte-182syzp {grid-template-columns:repeat(2, minmax(0, 1fr));}h3.svelte-182syzp {margin:0 0 6px;color:var(--text-strong);font-size:var(--text-sm);}ul.svelte-182syzp,\n  ol.svelte-182syzp {margin:0;padding:0;list-style:none;}li.svelte-182syzp {display:flex;align-items:baseline;gap:6px;min-width:0;padding:2px 0;}li.svelte-182syzp button:where(.svelte-182syzp) {min-width:0;padding:0;overflow:hidden;border:0;background:transparent;color:var(--text);text-align:left;text-overflow:ellipsis;white-space:nowrap;}li.svelte-182syzp button:where(.svelte-182syzp):hover {color:var(--accent);text-decoration:underline;}.change.svelte-182syzp {flex:none;width:1ch;font-weight:700;}.added.svelte-182syzp {color:var(--accent);}.dropped.svelte-182syzp {color:var(--secondary);}.size.svelte-182syzp {flex:none;margin-left:auto;color:var(--secondary);font-size:var(--text-sm);font-variant-numeric:tabular-nums;}.more.svelte-182syzp,\n  .empty.svelte-182syzp {color:var(--secondary);font-size:var(--text-sm);}.empty.svelte-182syzp {margin:8px 0 0;}.link.svelte-182syzp {margin-top:6px;padding:0;border:0;background:transparent;color:var(--accent);font-size:var(--text-sm);}.tools.svelte-182syzp {margin-top:14px;}.tool-list.svelte-182syzp {display:flex;flex-wrap:wrap;gap:6px;}.tool-chip.svelte-182syzp {padding:2px 8px;border:1px solid var(--separator);border-radius:999px;font-size:var(--text-sm);}.tool-chip.failed.svelte-182syzp {border-color:var(--error);color:var(--error);}.visually-hidden.svelte-182syzp {position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;}"
};
function xv(e, t) {
	Be(t, !0), li(e, bv);
	let n = X(t, "following", 3, !1), r = X(t, "twoColumns", 3, !1), i = X(t, "onSelectItem", 3, () => {}), a = X(t, "onViewDetails", 3, () => {}), o = X(t, "onShowComposition", 3, () => {}), s = /* @__PURE__ */ P(() => {
		if (!t.call) return null;
		let e = t.indexed.analysis.modelCalls.findIndex((e) => e.index === t.call.index);
		return e > 0 ? t.indexed.analysis.modelCalls[e - 1] : null;
	}), c = /* @__PURE__ */ P(() => t.call?.reportedPromptTokens != null && H(s)?.reportedPromptTokens != null ? t.call.reportedPromptTokens - H(s).reportedPromptTokens : null), l = /* @__PURE__ */ P(() => Au(t.indexed, t.call?.addedItemIds ?? [], t.call)), u = /* @__PURE__ */ P(() => Au(t.indexed, t.call?.droppedItemIds ?? [], H(s))), d = /* @__PURE__ */ P(() => ju(t.call?.addedItemIds ?? [], H(l).items)), f = /* @__PURE__ */ P(() => ju(t.call?.droppedItemIds ?? [], H(u).items)), p = /* @__PURE__ */ P(() => t.call ? Go(Zo(t.indexed, t.call.index)?.items ?? []).slice(0, 5) : []), m = /* @__PURE__ */ P(() => {
		let e = /* @__PURE__ */ new Map();
		for (let n of t.call?.toolCallsAfter ?? []) {
			let t = e.get(n.name) ?? {
				count: 0,
				failed: !1
			};
			e.set(n.name, {
				count: t.count + 1,
				failed: t.failed || n.failed
			});
		}
		return [...e].map(([e, t]) => ({
			name: e,
			...t
		}));
	});
	function h(e) {
		return Ao(t.indexed.itemById.get(e), e);
	}
	function g(e, t, n) {
		return e === 0 ? `0 ${t}` : `${Q(e)} ${t} (≈ ${Z(n.total)}${n.complete ? "" : ", partial"})`;
	}
	function _(e) {
		return `${e > 0 ? "+" : e < 0 ? "−" : "±"}${Z(Math.abs(e))}`;
	}
	var v = yv(), y = L(v), b = L(y), x = z(b, !0), S = B(b, 2), C = (e) => {
		var n = av(), r = R(n), i = z(r), o = B(r, 2);
		V(() => K(i, `${t.call.provider ?? "Unknown provider" ?? ""} / ${t.call.model ?? "Unknown model" ?? ""}`)), U("click", o, function(...e) {
			a()?.apply(this, e);
		}), G(e, n);
	};
	q(S, (e) => {
		t.call && e(C);
	}), M(y);
	var w = B(y, 2), ee = (e) => {
		var n = ov(), r = z(n, !0);
		V(() => K(r, t.indexed.analysis.modelCalls.length === 0 ? "No model calls yet." : "Select a call in the chart to see it here.")), G(e, n);
	}, T = (e) => {
		var n = vv(), a = R(n), v = L(a), y = z(B(L(v), 2));
		M(v);
		var b = B(v, 2), x = B(L(b), 2), S = L(x), C = B(S), w = (e) => {
			var t = sv(), n = z(t, !0);
			V((e) => {
				Y(t, "title", `Change since call ${H(s)?.index}`), K(n, e);
			}, [() => _(H(c))]), G(e, t);
		};
		q(C, (e) => {
			H(c) !== null && !t.call.usage.placeholder && e(w);
		}), M(x), M(b);
		var ee = B(b, 2), T = z(B(L(ee), 2), !0);
		M(ee), M(a);
		var E = B(a, 2);
		let te;
		var D = L(E), O = L(D), k = z(O), ne = B(O, 2), re = (e) => {
			G(e, cv());
		}, ie = (e) => {
			var n = fv(), r = L(n);
			J(r, 16, () => H(d).slice(0, 5), (e) => e, (e, t) => {
				let n = /* @__PURE__ */ P(() => H(l).items.get(t));
				var r = lv(), a = B(L(r), 2), o = B(L(a), 1, !0);
				M(a);
				var s = B(a, 2), c = z(s, !0);
				M(r), V((e, t) => {
					K(o, e), Y(s, "title", H(n)?.partial ? "Partial or missing estimate" : void 0), K(c, t);
				}, [() => h(t), () => H(n)?.tokens == null ? "Unknown" : Z(H(n).tokens)]), U("click", a, () => i()(t)), G(e, r);
			});
			var a = B(r, 2), o = (e) => {
				var n = uv(), r = z(n);
				V((e) => K(r, `${e ?? ""} more added`), [() => Q(t.call.addedItemIds.length - 5)]), G(e, n);
			};
			q(a, (e) => {
				t.call.addedItemIds.length > 5 && e(o);
			});
			var s = B(a, 2);
			J(s, 16, () => H(f).slice(0, 5), (e) => e, (e, t) => {
				let n = /* @__PURE__ */ P(() => H(u).items.get(t));
				var r = dv(), a = B(L(r), 2), o = B(L(a), 1, !0);
				M(a);
				var s = B(a, 2), c = z(s, !0);
				M(r), V((e, t) => {
					K(o, e), Y(s, "title", H(n)?.partial ? "Partial or missing estimate" : void 0), K(c, t);
				}, [() => h(t), () => H(n)?.tokens == null ? "Unknown" : Z(H(n).tokens)]), U("click", a, () => i()(t)), G(e, r);
			});
			var c = B(s, 2), p = (e) => {
				var n = uv(), r = z(n);
				V((e) => K(r, `${e ?? ""} more dropped`), [() => Q(t.call.droppedItemIds.length - 5)]), G(e, n);
			};
			q(c, (e) => {
				t.call.droppedItemIds.length > 5 && e(p);
			}), M(n), G(e, n);
		};
		q(ne, (e) => {
			t.call.addedItemIds.length === 0 && t.call.droppedItemIds.length === 0 ? e(re) : e(ie, -1);
		}), M(D);
		var ae = B(D, 2), oe = B(L(ae), 2), se = (e) => {
			G(e, pv());
		}, ce = (e) => {
			var t = hv(), n = R(t);
			J(n, 21, () => H(p), (e) => e.id, (e, t) => {
				var n = mv(), r = L(n), a = z(r, !0), o = z(B(r, 2));
				M(n), V((e, n) => {
					K(a, H(t).label), K(o, `${e ?? ""}${n ?? ""}`);
				}, [() => Z(H(t).tokens), () => H(t).share === null ? "" : ` · ${Va(H(t).share)}`]), U("click", r, () => i()(H(t).id)), G(e, n);
			}), M(n), U("click", B(n, 2), function(...e) {
				o()?.apply(this, e);
			}), G(e, t);
		};
		q(oe, (e) => {
			H(p).length === 0 ? e(se) : e(ce, -1);
		}), M(ae), M(E);
		var le = B(E, 2), ue = (e) => {
			var t = _v(), n = B(L(t), 2);
			J(n, 21, () => H(m), (e) => e.name, (e, t) => {
				var n = gv();
				let r;
				var i = z(n);
				V(() => {
					r = gi(n, 1, "tool-chip svelte-182syzp", null, r, { failed: H(t).failed }), K(i, `${H(t).name ?? ""}${H(t).count > 1 ? ` × ${H(t).count}` : ""}${H(t).failed ? " · failed" : ""}`);
				}), G(e, n);
			}), M(n), M(t), G(e, t);
		};
		q(le, (e) => {
			H(m).length > 0 && e(ue);
		}), V((e, n, i, a, o) => {
			K(y, `${t.call.index ?? ""} of ${e ?? ""}`), K(S, `${n ?? ""} `), K(T, i), te = gi(E, 1, "lists svelte-182syzp", null, te, { "two-columns": r() }), K(k, `Context changes · ${a ?? ""} · ${o ?? ""}`);
		}, [
			() => Q(t.indexed.analysis.modelCalls.length),
			() => t.call.usage.placeholder ? "Unavailable" : Z(t.call.reportedPromptTokens),
			() => t.call.usage.placeholder ? "Unavailable" : Xl(t.call.costAssessment),
			() => g(t.call.addedItemIds.length, "added", H(l)),
			() => g(t.call.droppedItemIds.length, "dropped", H(u))
		]), G(e, n);
	};
	q(w, (e) => {
		t.call ? e(T, -1) : e(ee);
	}), M(v), V(() => K(x, t.call ? n() ? "Latest call" : `Call ${t.call.index}` : "Latest call")), G(e, v), Ve();
}
kr(["click"]);
//#endregion
//#region src/lib/state/session-sections.ts
var Sv = [
	"summary",
	"call",
	"chart",
	"details",
	"lifespans"
], Cv = [
	"summary",
	"chart",
	"details",
	"lifespans"
], wv = [
	"summary",
	"call",
	"chart",
	"details",
	"lifespans"
];
function Tv(e, t = Cv) {
	let n = [];
	for (let r of e ?? t) Sv.includes(r) && !n.includes(r) && n.push(r);
	return t.forEach((e, r) => {
		if (n.includes(e)) return;
		let i = t.slice(0, r).reverse().find((e) => n.includes(e));
		n.splice(i === void 0 ? 0 : n.indexOf(i) + 1, 0, e);
	}), n;
}
var Ev = /* @__PURE__ */ new Set(["summary", "call"]);
function Dv(e) {
	let t = /* @__PURE__ */ new Map(), n = e.indexOf("details"), r = (e) => e !== void 0 && !Ev.has(e), i = n >= 0 && (r(e[n - 1]) || r(e[n + 1])), a = i ? e.filter((e) => e !== "details") : e;
	if (a.forEach((e, n) => t.set(e, {
		column: Ev.has(e) || e === "details" ? "1 / -1" : "1",
		row: String(n + 1)
	})), !i) return t;
	let o = r(e[n - 1]) ? e[n - 1] : e[n + 1], s = a.indexOf(o), c = s;
	for (; s > 0 && r(a[s - 1]);) --s;
	for (; c < a.length - 1 && r(a[c + 1]);) c += 1;
	return t.set("details", {
		column: "2",
		row: `${s + 1} / span ${c - s + 1}`
	}), t;
}
//#endregion
//#region src/lib/components/SessionView.svelte
var Ov = /* @__PURE__ */ W("<div class=\"summary-section svelte-okw1rh\"><!></div>"), kv = /* @__PURE__ */ W("<div class=\"call-section svelte-okw1rh\"><!></div>"), Av = /* @__PURE__ */ W("<button type=\"button\" aria-label=\"Copy view link\"> </button>"), jv = /* @__PURE__ */ W("<p class=\"river-pending svelte-okw1rh\" role=\"status\">Drawing the River…</p>"), Mv = /* @__PURE__ */ W("<div class=\"selection-location-note svelte-okw1rh\" role=\"status\"><span>The selected item has no presence in the current River view.</span> <button type=\"button\">Reveal in River</button> <button type=\"button\">Clear item</button></div>"), Nv = /* @__PURE__ */ W("<div class=\"item-hover-position svelte-okw1rh\"><!></div>"), Pv = /* @__PURE__ */ W("<!> <div class=\"chart-area svelte-okw1rh\"><!> <!> <!></div>", 1), Fv = /* @__PURE__ */ W("<div class=\"no-model-calls svelte-okw1rh\"><h3 class=\"svelte-okw1rh\">No model calls</h3> <p class=\"svelte-okw1rh\">This session has no completed assistant model responses on its current branch.</p> <p class=\"svelte-okw1rh\">Terminal compaction summaries, if present, remain available in Context lifespans.</p></div>"), Iv = /* @__PURE__ */ W("<section class=\"panel river-panel svelte-okw1rh\"><div class=\"panel-head svelte-okw1rh\"><div class=\"svelte-okw1rh\"><h2 class=\"svelte-okw1rh\"> </h2> <!></div> <div class=\"panel-actions svelte-okw1rh\"><!> <a class=\"mobile-view-details svelte-okw1rh\" href=\"#selected-item-summary\" aria-label=\"View details\"> </a> <button type=\"button\"> </button></div></div> <div class=\"visualization-tabs svelte-okw1rh\" role=\"tablist\" aria-label=\"Context visualization\"><button id=\"river-tab\" type=\"button\" role=\"tab\" aria-controls=\"river-panel\" class=\"svelte-okw1rh\">River</button> <button id=\"composition-tab\" type=\"button\" role=\"tab\" aria-controls=\"composition-panel\" class=\"svelte-okw1rh\">Composition</button></div> <div id=\"river-panel\" class=\"visualization-panel svelte-okw1rh\" role=\"tabpanel\" aria-labelledby=\"river-tab\" tabindex=\"0\"><!></div> <div id=\"composition-panel\" class=\"visualization-panel svelte-okw1rh\" role=\"tabpanel\" aria-labelledby=\"composition-tab\" tabindex=\"0\"><!></div></section>"), Lv = /* @__PURE__ */ W("<aside id=\"inspector\" aria-label=\"Inspector\" tabindex=\"-1\"><!></aside>"), Rv = /* @__PURE__ */ W("<section class=\"panel lifespan-panel svelte-okw1rh\"><!></section>"), zv = /* @__PURE__ */ W("<div class=\"session-view\" role=\"presentation\"><div></div></div>"), Bv = {
	hash: "svelte-okw1rh",
	code: ".panel.svelte-okw1rh {background:var(--surface);border:0;border-radius:var(--radius);padding:var(--panel-padding);margin-top:14px;min-width:0;}.panel-head.svelte-okw1rh {display:flex;justify-content:space-between;gap:16px;align-items:start;margin-bottom:10px;min-width:0;}.panel-head.svelte-okw1rh > :where(.svelte-okw1rh) {min-width:0;}.river-panel.svelte-okw1rh > .panel-head:where(.svelte-okw1rh) > div:where(.svelte-okw1rh):first-child {display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;}h2.svelte-okw1rh {font-size:var(--text-lg);margin:0;}.panel-actions.svelte-okw1rh {display:flex;align-items:center;gap:8px;flex-wrap:wrap;}.mobile-view-details.svelte-okw1rh {display:none;padding:var(--control-padding);border:1px solid var(--separator);border-radius:var(--control-radius);background:var(--surface);color:var(--text);text-decoration:none;white-space:nowrap;}.mobile-view-details.svelte-okw1rh:hover {background:var(--surface-raised);}#inspector.svelte-okw1rh {scroll-margin-top:16px;}.selected-item-summary {scroll-margin:16px;}\n  /* Sections follow their order in one column. A wide view with a selection places them with the\n     positions from wideSectionPlacement, which put the details in a second column. */.exploration-grid.svelte-okw1rh {display:grid;min-width:0;grid-template-columns:minmax(0, 1fr);align-items:start;gap:var(--panel-gap);}.exploration-grid.svelte-okw1rh > :where(.svelte-okw1rh) {grid-column:1;min-width:0;margin-top:0;}\n  @container highwater (min-width: 1051px) {.exploration-grid.occupied.svelte-okw1rh {grid-template-columns:minmax(0, 1fr) 320px;}.exploration-grid.occupied.svelte-okw1rh > :where(.svelte-okw1rh) {grid-column:var(--wide-column);grid-row:var(--wide-row);}.exploration-grid.occupied.svelte-okw1rh > .inspector-column.beside:where(.svelte-okw1rh) {position:sticky;top:16px;max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);overflow-y:auto;overscroll-behavior:contain;scrollbar-color:var(--control-border) var(--plot);scrollbar-width:thin;}\n  }.visualization-tabs.svelte-okw1rh {display:flex;gap:6px;margin:0 0 10px;border-bottom:1px solid var(--separator);}.visualization-tabs.svelte-okw1rh button:where(.svelte-okw1rh) {background:transparent;border:0;border-bottom:2px solid transparent;border-radius:0;}.visualization-tabs.svelte-okw1rh button[aria-selected='true']:where(.svelte-okw1rh) {border-color:var(--accent);background:transparent;color:var(--accent);}.visualization-panel.svelte-okw1rh {min-width:0;}.visualization-panel[hidden].svelte-okw1rh {display:none;}.no-model-calls.svelte-okw1rh {padding:12px;border:1px solid var(--separator);border-radius:var(--radius);background:var(--plot);}.no-model-calls.svelte-okw1rh h3:where(.svelte-okw1rh) {margin:0;color:var(--text-strong);font-size:14px;}.no-model-calls.svelte-okw1rh p:where(.svelte-okw1rh) {margin:4px 0 0;color:var(--secondary);font-size:var(--text-sm);}.inspector-column.svelte-okw1rh {display:grid;align-self:start;gap:var(--panel-gap);min-width:0;}.chart-area.svelte-okw1rh {position:relative;min-width:0;}.river-pending.svelte-okw1rh {min-height:360px;margin:0;padding:24px;color:var(--text);}.selection-location-note.svelte-okw1rh {display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px;color:var(--text);font-size:var(--text-sm);}.item-hover-position.svelte-okw1rh {position:fixed;z-index:5;pointer-events:none;}\n  @container highwater (max-width: 1050px) {.mobile-view-details.svelte-okw1rh {display:inline-flex;align-items:center;}\n  }\n  @container highwater (max-width: 850px) {.item-hover-position.svelte-okw1rh {display:none;}\n  }"
};
function Vv(e, t) {
	Be(t, !0), li(e, Bv);
	let n = X(t, "sessions", 19, () => []), r = X(t, "sessionReference", 3, null), i = X(t, "presentation", 31, () => en(Gi())), a = X(t, "viewState", 15, null), o = X(t, "riverSessionId", 15, null), s = X(t, "onPreferencesChange", 3, () => {}), c = X(t, "copyDisabled", 3, !1), l = X(t, "keyboardScope", 3, "window"), u = X(t, "onPin", 3, () => {}), d = X(t, "sections", 3, Cv), f = X(t, "following", 3, !1), p = Tv(yr(() => d())), m = Dv(p), h = /* @__PURE__ */ P(() => f() && p.includes("call"));
	function g(e) {
		let t = m.get(e);
		return `--wide-column:${t.column};--wide-row:${t.row}`;
	}
	let _ = /* @__PURE__ */ P(() => r() ?? t.indexed.analysis.session.id), v = /* @__PURE__ */ F(Hi()), y = /* @__PURE__ */ F(Hi()), b = null, x = null, S = /* @__PURE__ */ F(0), C = /* @__PURE__ */ F(0), w = /* @__PURE__ */ F(null);
	function ee(e) {
		i(e), s()(e);
	}
	let T = /* @__PURE__ */ F(Qi()), E, te = /* @__PURE__ */ F("river"), D = /* @__PURE__ */ F("cumulative"), O = /* @__PURE__ */ F(""), k = /* @__PURE__ */ F(null), ne = /* @__PURE__ */ F(null), re = 0, ie = 0, ae = /* @__PURE__ */ F(null), oe = 0, se = () => ({
		ready: !1,
		isFitAll: !0,
		zoomFactor: 1,
		canZoomIn: !1,
		canZoomOut: !1,
		totalCallCount: 0,
		firstVisibleCallIndex: null,
		lastVisibleCallIndex: null,
		hasOverflow: !1
	}), ce = /* @__PURE__ */ F(se()), le = /* @__PURE__ */ F(null), ue = /* @__PURE__ */ F(null), de = /* @__PURE__ */ F(null), fe = /* @__PURE__ */ F(null), pe = /* @__PURE__ */ F(!1), me = /* @__PURE__ */ F(!1);
	function he(e) {
		let t = e > 0 && (H(pe) ? e <= 540 : e <= 520);
		t !== H(pe) && I(pe, t, !0);
		let n = e > 0 && (H(me) ? e <= 780 : e <= 760);
		n !== H(me) && I(me, n, !0);
	}
	function ge(e) {
		e !== o() && requestAnimationFrame(() => setTimeout(() => {
			(r() ?? t.indexed.analysis.session.id) !== e || Se || o(e);
		}));
	}
	let _e = /* @__PURE__ */ P(() => H(T).pinnedCallIndex === null ? null : t.indexed?.callByIndex.get(H(T).pinnedCallIndex) ?? null), A = /* @__PURE__ */ P(() => H(T).selectedItemId ? t.indexed?.itemById.get(H(T).selectedItemId) ?? null : null), ve = /* @__PURE__ */ P(() => H(A) !== null && H(A).presence.length > 0 && H(ue)?.itemId === H(A).id && !H(ue).visible), j = /* @__PURE__ */ P(() => H(T).hoveredItemId ? t.indexed?.itemById.get(H(T).hoveredItemId) ?? null : null), ye = /* @__PURE__ */ P(() => t.indexed?.analysis.modelCalls.map((e) => e.index) ?? []), be = /* @__PURE__ */ P(() => H(te) === "river" ? "Context River" : "Composition");
	Tn(() => {
		let e = t.indexed, n = H(_);
		yr(() => {
			let t = x;
			if (t === e) {
				ge(n);
				return;
			}
			if (t && t.analysis.session.id === e.analysis.session.id) {
				let n = H(T).pinnedCallIndex;
				I(T, ta(H(T), t, e)), n !== null && H(T).pinnedCallIndex === null && H(D) === "cumulative" && I(O, "The pinned call is no longer available; cumulative scope now covers the whole session."), H(ae) && !e.itemById.has(H(ae).itemId) && I(ae, null), H(k)?.kind === "reveal-item" && (!e.itemById.has(H(k).itemId) || H(T).selectedItemId !== H(k).itemId ? I(k, null) : I(k, {
					...H(k),
					referenceCallIndex: H(T).pinnedCallIndex
				}));
			} else t && (I(T, Qi()), I(v, Hi()), I(y, Hi()), I(te, "river"), I(D, "cumulative"), I(O, ""), I(k, null), I(ae, null), I(ue, null), ke(), I(w, null), I(S, 0), I(C, 0));
			x = e, ge(n);
		});
	}), Tn(() => {
		a({
			linkedView: {
				session: H(_),
				view: H(te),
				display: i().river.display,
				scope: H(D),
				pin: H(T).pinnedCallIndex,
				item: H(T).selectedItemId,
				range: H(w) ? H(w).range : ua(H(ce), H(ye))
			},
			navigationRevision: H(C),
			riverReady: o() === H(_),
			settled: H(te) === "composition" || H(ye).length === 0 || H(ce).ready && (!H(k) || H(S) === H(k).id)
		});
	}), Tn(() => {
		t.indexed?.analysis.modelCalls.length === 0 && (H(k) !== null || H(ce).ready || !H(ce).isFitAll || H(ce).totalCallCount !== 0) && (I(k, null), ke());
	}), Tn(() => {
		H(T), H(te), t.indexed, H(_e), H(A), o(), b = Vi(E).activeElement;
	}), Cn(() => {
		H(T), H(te), t.indexed, H(_e), H(A), o(), yr(xe);
	});
	function xe() {
		b && !b.isConnected && (Vi(E).activeElement === document.body || Vi(E).activeElement === null || !Vi(E).activeElement?.isConnected) && (Vi(E).getElementById("selected-item-summary") ?? Vi(E).getElementById("pinned-call-summary") ?? Vi(E).getElementById(H(te) === "river" ? "river-tab" : "composition-tab"))?.focus({ preventScroll: !0 });
	}
	Cn(() => {
		H(le), H(j), H(de), yr(Ge);
	});
	let Se = !1;
	zi(() => {
		l() === "window" && window.addEventListener("keydown", Xe);
		let e = typeof ResizeObserver > "u" ? null : new ResizeObserver(([e]) => {
			let t = e.contentRect.width;
			requestAnimationFrame(() => {
				Se || he(t);
			});
		});
		return e?.observe(E), () => {
			Se = !0, e?.disconnect(), l() === "window" && window.removeEventListener("keydown", Xe);
		};
	});
	function Ce(e) {
		return e.session !== H(_) || o() !== H(_) ? !1 : (I(T, {
			...Qi(),
			selectedItemId: e.item,
			pinnedCallIndex: e.pin
		}), I(te, e.view, !0), i({
			...i(),
			river: {
				...i().river,
				display: e.display
			}
		}), I(D, e.scope, !0), I(O, ""), I(w, { range: e.range }), I(k, t.indexed.analysis.modelCalls.length ? e.range ? {
			id: ++re,
			kind: "range",
			startCallIndex: e.range[0],
			endCallIndex: e.range[1]
		} : {
			id: ++re,
			kind: "fit"
		} : null), H(k) || I(w, null), !0);
	}
	function we() {
		let e = H(ye)[H(ye).length - 1];
		if (e !== void 0 && p.includes("call")) {
			I(T, {
				...H(T),
				pinnedCallIndex: e
			}), I(O, ""), I(C, H(C) + 1), I(k, {
				id: ++re,
				kind: "recent",
				minCallSpacing: 4
			});
			return;
		}
		ze("latest");
	}
	function Te() {
		u()(), I(T, {
			...H(T),
			pinnedCallIndex: null
		});
	}
	function Ee() {
		gr().then(() => {
			let e = Vi(E).getElementById("pinned-call-summary");
			e?.scrollIntoView({ block: "start" }), e?.focus({ preventScroll: !0 });
		});
	}
	function De() {
		I(te, "composition"), I(D, "atCall"), gr().then(() => {
			let e = Vi(E).getElementById("composition-tab");
			e?.scrollIntoView({ block: "start" }), e?.focus({ preventScroll: !0 });
		});
	}
	function Oe(e) {
		I(S, e, !0), e === H(k)?.id && I(w, null);
	}
	function ke() {
		I(ce, se());
	}
	function Ae(e) {
		H(T).hoveredCallIndex !== e && I(T, {
			...H(T),
			hoveredCallIndex: e
		});
	}
	function je(e) {
		u()(), I(T, {
			...H(T),
			pinnedCallIndex: e
		}), I(O, "");
	}
	function Me(e) {
		I(D, e, !0);
	}
	function Ne(e) {
		H(te) === "river" && I(ce, e);
	}
	function Pe(e) {
		(e?.itemId !== H(ue)?.itemId || e?.visible !== H(ue)?.visible) && I(ue, e);
	}
	function Fe(e) {
		t.indexed?.itemById.has(e) && H(ye).length !== 0 && (I(C, H(C) + 1), I(te, "river"), I(k, {
			id: ++re,
			kind: "reveal-item",
			itemId: e,
			referenceCallIndex: H(T).pinnedCallIndex
		}));
	}
	function N(e) {
		t.indexed?.itemById.has(e) && I(ae, {
			requestId: ++oe,
			itemId: e
		});
	}
	function Ie() {
		let e = H(_), n = H(A)?.id ?? null, r = ++ie;
		if (n === null) {
			let e = Vi(E).getElementById("inspector");
			if (!e) return;
			e.scrollIntoView({ block: "start" }), e.focus({ preventScroll: !0 });
			return;
		}
		gr().then(() => {
			if (r !== ie || e !== H(_) || H(T).selectedItemId !== n || !t.indexed?.itemById.has(n)) return;
			let i = Vi(E).getElementById("inspector"), a = Vi(E).getElementById("selected-item-summary");
			if (i && a) {
				if (getComputedStyle(i).overflowY !== "visible" && i.scrollHeight > i.clientHeight) {
					let e = i.getBoundingClientRect(), t = a.getBoundingClientRect();
					t.top < e.top + 12 ? i.scrollTop -= e.top + 12 - t.top : t.bottom > e.bottom - 12 && (i.scrollTop += t.bottom - (e.bottom - 12)), a.focus({ preventScroll: !0 });
				} else a.scrollIntoView({ block: "start" }), a.focus({ preventScroll: !0 });
			}
		});
	}
	function Le(e) {
		if (!t.indexed?.callByIndex.has(e)) return;
		let n = H(_), r = t.indexed.callByIndex.get(e)?.sourceRecordId, i = H(T).selectedItemId, a = ++ie;
		je(e), gr().then(() => {
			if (a !== ie || n !== H(_) || H(T).selectedItemId !== i || H(_e)?.sourceRecordId !== r) return;
			let e = Vi(E).getElementById("pinned-call-summary");
			e?.scrollIntoView({ block: "nearest" }), e?.focus({ preventScroll: !0 });
		});
	}
	function Re() {
		if (H(h)) {
			Ke(null);
			return;
		}
		u()(), I(T, Qi()), I(O, ""), I(k, null);
	}
	function ze(e) {
		(e === "fit" || e === "latest") && I(C, H(C) + 1), I(k, {
			id: ++re,
			kind: e
		});
	}
	function He(e) {
		je(e), I(k, {
			id: ++re,
			kind: "ensure-call",
			callIndex: e
		});
	}
	function Ue(e) {
		let t;
		if (e.key === "Home") t = "river";
		else if (e.key === "End") t = "composition";
		else if (e.key === "ArrowLeft" || e.key === "ArrowRight") t = H(te) === "river" ? "composition" : "river";
		else return;
		e.preventDefault(), I(te, t, !0);
		let n = t === "river" ? "river-tab" : "composition-tab";
		Vi(E).getElementById(n)?.focus();
	}
	function We(e, t) {
		e === null ? (I(le, null), I(fe, null)) : t && I(le, {
			x: t.clientX,
			y: t.clientY
		}), H(T).hoveredItemId !== e && I(T, {
			...H(T),
			hoveredItemId: e
		});
	}
	function Ge() {
		if (!H(de) || !H(le)) return;
		let e = H(de).getBoundingClientRect();
		if (e.width === 0 || e.height === 0) return;
		let { x: t, y: n } = H(le), r = t + 14, i = n + 14, a = r + e.width <= window.innerWidth - 12 ? r : t - 14 - e.width, o = i + e.height <= window.innerHeight - 12 ? i : n - 14 - e.height, s = {
			left: Math.round(Math.min(Math.max(12, a), Math.max(12, window.innerWidth - e.width - 12))),
			top: Math.round(Math.min(Math.max(12, o), Math.max(12, window.innerHeight - e.height - 12)))
		};
		(s.left !== H(fe)?.left || s.top !== H(fe)?.top) && I(fe, s);
	}
	function Ke(e) {
		H(k)?.kind === "reveal-item" && H(k).itemId !== e && I(k, null), H(ae) && H(ae).itemId !== e && I(ae, null), I(T, {
			...H(T),
			selectedItemId: e
		});
	}
	function qe(e, t) {
		Ke(e), t !== void 0 && je(t);
	}
	function Je(e) {
		H(k)?.kind === "reveal-item" && I(k, null), u()(), I(T, {
			...H(T),
			pinnedCallIndex: e
		});
	}
	function Ye() {
		let e = Vi(E).activeElement?.closest("details[open]") ?? Vi(E).querySelector(".view-options[open]");
		if (e instanceof HTMLDetailsElement) return e.open = !1, e.querySelector("summary")?.focus(), !0;
		if (H(ne)?.dismissEconomics()) return !0;
		if (H(T).selectedItemId !== null || H(T).pinnedCallIndex !== null && !H(h)) {
			let e = H(T).pinnedCallIndex;
			return I(T, $i(H(T))), H(T).pinnedCallIndex !== e && u()(), H(k)?.kind === "reveal-item" && H(T).selectedItemId !== H(k).itemId && I(k, null), !0;
		}
		return !H(ce).isFitAll && (ze("fit"), !0);
	}
	function Xe(e) {
		if (e.key === "Escape" && !e.defaultPrevented) {
			(Ye() || l() === "window") && e.preventDefault();
			return;
		}
		if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || H(te) !== "river") return;
		let n = e.key === "ArrowLeft" || e.key === "h" ? -1 : e.key === "ArrowRight" || e.key === "l" ? 1 : null;
		if (n === null) return;
		let r = e.target;
		if (!(r instanceof Element)) return;
		let i = l() === "window" && r === document.body && document.querySelectorAll("main").length === 1, a = t.keyboardOwner ?? E;
		if (!i && !a?.contains(r) || (e.key === "h" || e.key === "l") && i || r.closest("input, textarea, select, [contenteditable]:not([contenteditable=\"false\"]), [role=\"tab\"], [role=\"slider\"], [role=\"spinbutton\"], [role=\"combobox\"], [role=\"listbox\"], [role=\"menu\"], [role=\"radio\"]")) return;
		let o = l() === "root" ? r.closest("[data-call-index]")?.getAttribute("data-call-index") : null, s = na(H(ye), o ? Number(o) : H(T).pinnedCallIndex, H(ce), n);
		e.preventDefault(), s !== null && (i && E.querySelector(".river-scroll")?.focus({ preventScroll: !0 }), He(s), l() === "root" && r.closest(".call-target") && gr().then(() => E.querySelector(`.call-target[aria-label="Pin model call ${s}"]`)?.focus({ preventScroll: !0 })));
	}
	var Ze = {
		restoreView: Ce,
		followLatest: we
	}, Qe = zv();
	Or("resize", rn, Ge);
	var $e = L(Qe);
	let et;
	return J($e, 20, () => p, (e) => e, (e, r) => {
		var a = Br(), s = R(a), u = (e) => {
			var i = Ov();
			Qr(L(i), () => H(_), (e) => {
				lp(e, {
					get indexed() {
						return t.indexed;
					},
					get sessionId() {
						return H(_);
					},
					get sessions() {
						return n();
					},
					get compact() {
						return H(me);
					}
				});
			}), M(i), V((e) => vi(i, e), [() => g(r)]), G(e, i);
		}, d = (e) => {
			var n = kv(), i = L(n);
			{
				let e = /* @__PURE__ */ P(() => !H(me));
				xv(i, {
					get indexed() {
						return t.indexed;
					},
					get call() {
						return H(_e);
					},
					get following() {
						return f();
					},
					get twoColumns() {
						return H(e);
					},
					onSelectItem: (e) => {
						Ke(e), Ie();
					},
					onViewDetails: Ee,
					onShowComposition: De
				});
			}
			M(n), V((e) => vi(n, e), [() => g(r)]), G(e, n);
		}, p = (e) => {
			var n = Iv(), a = L(n), s = L(a), u = L(s), d = z(u, !0), f = B(u, 2), p = (e) => {
				{
					let n = /* @__PURE__ */ P(() => H(te) === "river");
					pp(e, {
						get isVisible() {
							return H(n);
						},
						get source() {
							return t.indexed.analysis.session.source;
						},
						get compact() {
							return H(pe);
						}
					});
				}
			};
			q(f, (e) => {
				H(te) === "river" && e(p);
			}), M(s);
			var m = B(s, 2), v = L(m), y = (e) => {
				var n = Av(), r = z(n, !0);
				V(() => {
					n.disabled = c(), K(r, H(pe) ? "Copy link" : "Copy view link");
				}), U("click", n, function(...e) {
					t.onCopyViewLink?.apply(this, e);
				}), G(e, n);
			};
			q(v, (e) => {
				t.onCopyViewLink && e(y);
			});
			var b = B(v, 2), x = z(b, !0), S = B(b, 2), C = z(S, !0);
			M(m), M(a);
			var w = B(a, 2), E = L(w), re = B(E, 2);
			M(w);
			var ie = B(w, 2), ae = L(ie), oe = (e) => {
				var n = Pv(), r = R(n);
				Qr(r, () => H(_), (e) => {
					{
						let t = /* @__PURE__ */ P(() => H(te) === "river");
						$s(e, {
							get compact() {
								return H(pe);
							},
							get isVisible() {
								return H(t);
							},
							get viewport() {
								return H(ce);
							},
							get callIndices() {
								return H(ye);
							},
							get pinnedCallIndex() {
								return H(T).pinnedCallIndex;
							},
							onSelectCall: He,
							onLatest: () => ze("latest"),
							onFitAll: () => ze("fit"),
							onZoomIn: () => ze("zoom-in"),
							onZoomOut: () => ze("zoom-out")
						});
					}
				});
				var a = B(r, 2), s = L(a), c = (e) => {
					G(e, jv());
				}, u = (e) => {
					var n = Br();
					Qr(R(n), () => H(_), (e) => {
						{
							let n = /* @__PURE__ */ P(() => H(te) === "river"), r = /* @__PURE__ */ P(() => l() === "window");
							Li(iv(e, {
								get indexed() {
									return t.indexed;
								},
								get preferences() {
									return i();
								},
								onPreferencesChange: ee,
								get pinnedCallIndex() {
									return H(T).pinnedCallIndex;
								},
								get hoveredCallIndex() {
									return H(T).hoveredCallIndex;
								},
								get selectedItemId() {
									return H(T).selectedItemId;
								},
								get hoveredItemId() {
									return H(T).hoveredItemId;
								},
								get navigationCommand() {
									return H(k);
								},
								get isVisible() {
									return H(n);
								},
								onViewportChange: Ne,
								onNavigationSettled: Oe,
								onSelectionVisibility: Pe,
								onHoverCall: Ae,
								onPinCall: je,
								onHoverItem: We,
								onSelectItem: Ke,
								onEmptyClick: Je,
								onEscape: Ye,
								get consumeUnhandledEscape() {
									return H(r);
								},
								get compact() {
									return H(pe);
								}
							}), (e) => I(ne, e, !0), () => H(ne));
						}
					}), G(e, n);
				};
				q(s, (e) => {
					o() === H(_) ? e(u, -1) : e(c);
				});
				var d = B(s, 2), f = (e) => {
					var t = Mv(), n = B(L(t), 2), r = B(n, 2);
					M(t), U("click", n, () => Fe(H(A).id)), U("click", r, () => Ke(null)), G(e, t);
				};
				q(d, (e) => {
					H(ve) && H(A) && e(f);
				});
				var p = B(d, 2), m = (e) => {
					var n = Nv();
					If(L(n), {
						get item() {
							return H(j);
						},
						get indexed() {
							return t.indexed;
						}
					}), M(n), Li(n, (e) => I(de, e), () => H(de)), V(() => vi(n, `left:${H(fe)?.left ?? 12}px;top:${H(fe)?.top ?? 12}px`)), G(e, n);
				};
				q(p, (e) => {
					H(j) && H(T).selectedItemId !== H(T).hoveredItemId && e(m);
				}), M(a), G(e, n);
			}, se = (e) => {
				G(e, Fv());
			};
			q(ae, (e) => {
				t.indexed.analysis.modelCalls.length > 0 ? e(oe) : e(se, -1);
			}), M(ie);
			var le = B(ie, 2);
			Qr(L(le), () => H(_), (e) => {
				{
					let n = /* @__PURE__ */ P(() => H(te) === "composition");
					Ls(e, {
						get indexed() {
							return t.indexed;
						},
						get pinnedCallIndex() {
							return H(T).pinnedCallIndex;
						},
						get selectedItemId() {
							return H(T).selectedItemId;
						},
						get isVisible() {
							return H(n);
						},
						get scope() {
							return H(D);
						},
						get endpointNotice() {
							return H(O);
						},
						onScopeChange: Me,
						onPinCall: je,
						onUnpinCall: Te,
						onSelectItem: Ke,
						onRevealInRiver: Fe,
						onViewDetails: Ie,
						onFindInLifespans: N,
						get compact() {
							return H(pe);
						}
					});
				}
			}), M(le), M(n), V((e) => {
				vi(n, e), K(d, H(be)), K(x, H(pe) ? "Details" : "View details"), Y(S, "aria-label", H(h) ? "Clear selected item" : "Clear selected item and pinned call"), Y(S, "title", H(h) ? "Clears the selected item. The latest call stays pinned while following." : "Clears the selected item and pinned call"), S.disabled = H(T).selectedItemId === null && (H(h) || H(T).pinnedCallIndex === null), K(C, H(pe) ? "Clear" : "Clear selection"), Y(E, "aria-selected", H(te) === "river"), Y(E, "tabindex", H(te) === "river" ? 0 : -1), Y(re, "aria-selected", H(te) === "composition"), Y(re, "tabindex", H(te) === "composition" ? 0 : -1), Y(ie, "hidden", H(te) !== "river"), Y(le, "hidden", H(te) !== "composition");
			}, [() => g(r)]), U("click", b, (e) => {
				e.preventDefault(), Ie();
			}), U("click", S, Re), U("click", E, () => I(te, "river")), U("keydown", E, Ue), U("click", re, () => I(te, "composition")), U("keydown", re, Ue), G(e, n);
		}, b = (e) => {
			var i = Lv();
			let a;
			var o = L(i);
			{
				let e = /* @__PURE__ */ P(() => H(ye).length > 0);
				Af(o, {
					get indexed() {
						return t.indexed;
					},
					get sessions() {
						return n();
					},
					get pinnedCall() {
						return H(_e);
					},
					get selectedItem() {
						return H(A);
					},
					get callSections() {
						return H(y);
					},
					get itemSections() {
						return H(v);
					},
					get pinnedCallIndex() {
						return H(T).pinnedCallIndex;
					},
					get hoveredCallIndex() {
						return H(T).hoveredCallIndex;
					},
					get hasCalls() {
						return H(e);
					},
					onClosePinnedCall: Te,
					onCloseItem: () => Ke(null),
					onSelectItem: Ke,
					onPinCall: je,
					onInspectCall: Le,
					onRevealInRiver: Fe
				});
			}
			M(i), V((e, t) => {
				a = gi(i, 1, "inspector-column svelte-okw1rh", null, a, {
					beside: e,
					empty: !H(_e) && !H(A)
				}), vi(i, t);
			}, [() => m.get("details")?.column === "2", () => g(r)]), G(e, i);
		}, x = (e) => {
			var n = Rv();
			Qr(L(n), () => H(_), (e) => {
				qc(e, {
					get indexed() {
						return t.indexed;
					},
					get selectedItemId() {
						return H(T).selectedItemId;
					},
					get pinnedCallIndex() {
						return H(T).pinnedCallIndex;
					},
					onSelectItem: qe,
					onHoverItem: We,
					get findRequest() {
						return H(ae);
					},
					get compact() {
						return H(pe);
					}
				});
			}), M(n), V((e) => vi(n, e), [() => g(r)]), G(e, n);
		};
		q(s, (e) => {
			r === "summary" ? e(u) : r === "call" ? e(d, 1) : r === "chart" ? e(p, 2) : r === "details" ? e(b, 3) : r === "lifespans" && e(x, 4);
		}), G(e, a);
	}), M($e), M(Qe), Li(Qe, (e) => E = e, () => E), V(() => et = gi($e, 1, "exploration-grid svelte-okw1rh", null, et, { occupied: H(A) !== null || H(_e) !== null })), U("keydown", Qe, function(...e) {
		(l() === "root" ? Xe : void 0)?.apply(this, e);
	}), G(e, Qe), Ve(Ze);
}
kr(["keydown", "click"]);
//#endregion
//#region src/lib/economics-validation.ts
var Hv = /* @__PURE__ */ new Set([
	"piModelRates",
	"sourceModelRates",
	"providerReported",
	"unknown"
]), Uv = /* @__PURE__ */ new Set([
	"complete",
	"partial",
	"missing",
	"unsupported"
]), Wv = /* @__PURE__ */ new Set([
	"reported",
	"notReported",
	"notRetainedByPi",
	"unsupported"
]), Gv = .25, Kv = .5, qv = "adjacent-cache-read-share-v1", Jv = 1e3;
function Yv(e, t) {
	if (e !== null && (!Number.isFinite(e) || e < 0 || e > 1)) throw new $(`${t} is outside 0..1`);
}
function Xv(e, t, n, r) {
	if (n === 0) {
		if (e !== null || t !== 0) throw new $(`${r} has an invalid zero denominator`);
		return;
	}
	let i = t / n;
	if (e === null || Math.abs(e - i) > Math.max(1e-12, i * 1e-9)) throw new $(`${r} disagrees with its reported token buckets`);
}
function Zv(e) {
	let t = e.economics;
	if (!t || typeof t != "object") throw new $(`Call ${e.index} has no economics record`);
	if (!Uv.has(t.usageCompleteness) || !Uv.has(t.costCompleteness) || !Wv.has(t.cacheWriteStatus)) throw new $(`Call ${e.index} has an unsupported economics status`);
	if (!Array.isArray(t.explanationCodes) || t.explanationCodes.some((e) => typeof e != "string")) throw new $(`Call ${e.index} has invalid economics explanations`);
	Sl(t.promptTokens, `Call ${e.index} economics promptTokens`);
	for (let [t, n] of [
		["input", e.usage.input],
		["output", e.usage.output],
		["recordedOutput", e.usage.recordedOutput],
		["cacheRead", e.usage.cacheRead],
		["cacheWrite", e.usage.cacheWrite],
		["cacheWrite1h", e.usage.cacheWrite1h],
		["reasoning", e.usage.reasoning],
		["totalTokens", e.usage.totalTokens],
		["reportedPromptTokens", e.reportedPromptTokens],
		["reportedCompletionTokens", e.reportedCompletionTokens],
		["reportedTotalTokens", e.reportedTotalTokens],
		["cumulativeReportedPromptTokens", e.cumulativeReportedPromptTokens],
		["cumulativeReportedCompletionTokens", e.cumulativeReportedCompletionTokens],
		["cumulativeReportedReasoningTokens", e.cumulativeReportedReasoningTokens]
	]) Sl(n, `Call ${e.index} ${t}`);
	if (![
		"includesReasoning",
		"excludesReasoning",
		"unknown"
	].includes(e.usage.outputReasoningRelationship)) throw new $(`Call ${e.index} has an unsupported output/reasoning relationship`);
	let n = e.usage.placeholder;
	if (n !== null) {
		if (!n || typeof n != "object" || Array.isArray(n) || n.reason !== "failedAttempt") throw new $(`Call ${e.index} has invalid usage placeholder evidence`);
		for (let t of [
			n.input,
			n.output,
			n.cacheRead,
			n.cacheWrite,
			n.totalTokens
		]) if (t !== 0) throw new $(`Call ${e.index} has nonzero or missing placeholder counters`);
		for (let t of [n.cacheWrite1h, n.reasoning]) if (t !== null && t !== 0) throw new $(`Call ${e.index} has invalid placeholder breakdowns`);
		if (n.cost !== null) {
			let t = n.cost;
			if (!t || typeof t != "object" || Array.isArray(t) || [
				t.input,
				t.output,
				t.cacheRead,
				t.cacheWrite,
				t.total
			].some((e) => e !== null && e !== 0)) throw new $(`Call ${e.index} has invalid placeholder cost`);
		}
		if ([
			e.usage.input,
			e.usage.output,
			e.usage.recordedOutput,
			e.usage.cacheRead,
			e.usage.cacheWrite,
			e.usage.cacheWrite1h,
			e.usage.reasoning,
			e.usage.totalTokens,
			e.reportedPromptTokens,
			e.reportedCompletionTokens,
			e.reportedTotalTokens
		].some((e) => e !== null) || e.cost !== null) throw new $(`Call ${e.index} treats placeholder counters as measured usage`);
	}
	let r = e.cost ? [
		e.cost.input,
		e.cost.output,
		e.cost.cacheRead,
		e.cost.cacheWrite,
		e.cost.total
	] : [];
	for (let t of r) if (t !== null && !Number.isFinite(t)) throw new $(`Call ${e.index} has a non-finite raw cost`);
	if (r.some((e) => e !== null && e < 0) && t.costCompleteness === "complete") throw new $(`Call ${e.index} marks negative cost components as complete`);
	for (let [n, r] of [
		["cacheReadRatio", t.cacheReadRatio],
		["cacheWriteRatio", t.cacheWriteRatio],
		["freshRatio", t.freshRatio]
	]) Yv(r, `Call ${e.index} economics ${n}`);
	if (Qv(e), t.piPromptCost !== null && (!Number.isFinite(t.piPromptCost) || t.piPromptCost < 0)) throw new $(`Call ${e.index} has an invalid calculated prompt cost`);
	let i = t.policyId === null ? null : gu[t.policyId];
	if (t.policyId === null) {
		if (t.usageCompleteness !== "unsupported" || t.costCompleteness !== "unsupported" || t.cacheWriteStatus !== "unsupported" || t.promptTokens !== null || t.cacheReadRatio !== null || t.cacheWriteRatio !== null || t.freshRatio !== null || t.piPromptCost !== null || t.cacheRatioDiscontinuity !== null) throw new $(`Call ${e.index} has economics without a supported policy`);
		return;
	}
	if (!i || e.provider !== i.provider || e.api !== i.api || t.cacheWriteStatus !== i.cacheWriteStatus) throw new $(`Call ${e.index} has an unsupported economics policy`);
	if (t.usageCompleteness === "unsupported" || t.costCompleteness === "unsupported") throw new $(`Call ${e.index} marks a supported policy as unsupported`);
	if (t.piPromptCost !== null && t.costCompleteness !== "complete") throw new $(`Call ${e.index} has a prompt cost with incomplete components`);
	if (t.usageCompleteness !== "complete") {
		if (t.promptTokens !== null || t.cacheReadRatio !== null || t.cacheWriteRatio !== null || t.freshRatio !== null) throw new $(`Call ${e.index} derives ratios from incomplete usage`);
		return;
	}
	if (t.promptTokens === null) throw new $(`Call ${e.index} has complete usage without prompt tokens`);
	let a = e.usage.input, o = e.usage.cacheRead, s = e.usage.cacheWrite;
	if (Sl(a, `Call ${e.index} input`), Sl(o, `Call ${e.index} cacheRead`), Sl(s, `Call ${e.index} cacheWrite`), a === null || o === null || i.hasWriteRatio && s === null) throw new $(`Call ${e.index} has incomplete normalized prompt buckets`);
	if (BigInt(a) + BigInt(o) + BigInt(i.hasWriteRatio ? s : 0) !== BigInt(t.promptTokens)) throw new $(`Call ${e.index} prompt tokens disagree with normalized buckets`);
	if (Xv(t.cacheReadRatio, o, t.promptTokens, `Call ${e.index} cacheReadRatio`), i.hasWriteRatio) Xv(t.cacheWriteRatio, s, t.promptTokens, `Call ${e.index} cacheWriteRatio`);
	else if (t.cacheWriteRatio !== null) throw new $(`Call ${e.index} has an unsupported cache-write ratio`);
	if (i.hasFreshRatio) Xv(t.freshRatio, a, t.promptTokens, `Call ${e.index} freshRatio`);
	else if (t.freshRatio !== null) throw new $(`Call ${e.index} has an unsupported fresh-input ratio`);
	if (t.costCompleteness === "complete" && t.usageCompleteness === "complete" && i.hasFreshRatio && t.piPromptCost === null) throw new $(`Call ${e.index} is missing a complete prompt cost`);
}
function Qv(e) {
	let t = e.economics.cacheRatioDiscontinuity;
	if (t === null) return;
	if (!t || typeof t != "object" || !Number.isSafeInteger(t.previousCallIndex) || t.previousCallIndex < 0 || !["drop", "rise"].includes(t.direction) || !["notable", "large"].includes(t.magnitude) || t.method !== qv || !Number.isFinite(t.previousRatio) || !Number.isFinite(t.currentRatio) || !Number.isFinite(t.delta) || t.delta < Gv || t.delta > 1 || t.compactionBefore !== null && typeof t.compactionBefore != "string") throw new $(`Call ${e.index} has invalid cache-ratio change data`);
	Sl(t.previousPromptTokens, `Call ${e.index} previous prompt tokens`), Sl(t.currentPromptTokens, `Call ${e.index} current prompt tokens`), Yv(t.previousRatio, `Call ${e.index} previous cache-read ratio`), Yv(t.currentRatio, `Call ${e.index} current cache-read ratio`);
	let n = Math.abs(t.currentRatio - t.previousRatio);
	if (Math.abs(n - t.delta) > Math.max(1e-12, n * 1e-9) || t.direction !== (t.currentRatio < t.previousRatio ? "drop" : "rise") || t.magnitude !== (t.delta >= Kv ? "large" : "notable") || t.compactionBefore !== e.compactionBefore) throw new $(`Call ${e.index} has inconsistent cache-ratio change data`);
}
function $v(e) {
	let t = [...e].sort((e, t) => e.index - t.index);
	for (let e = 0; e < t.length; e += 1) {
		let n = t[e], r = n.economics.cacheRatioDiscontinuity;
		if (r === null) continue;
		let i = t[e - 1];
		if (!i || i.index + 1 !== n.index || r.previousCallIndex !== i.index || r.previousPromptTokens !== i.economics.promptTokens || r.currentPromptTokens !== n.economics.promptTokens || i.economics.usageCompleteness !== "complete" || n.economics.usageCompleteness !== "complete" || i.economics.policyId === null || i.economics.policyId !== n.economics.policyId || i.provider !== n.provider || i.model !== n.model || i.api !== n.api || i.economics.cacheReadRatio !== r.previousRatio || n.economics.cacheReadRatio !== r.currentRatio || (i.economics.promptTokens ?? 0) < Jv || (n.economics.promptTokens ?? 0) < Jv) throw new $(`Call ${n.index} has an ineligible cache-ratio change`);
	}
}
function ey(e, t) {
	if (!e || !Hv.has(e.costBasis)) throw new $("Analysis has an unsupported economics cost basis");
	if (!Array.isArray(e.supportedPolicyIds)) throw new $("Analysis has invalid supported economics policies");
	xl(e.supportedPolicyIds, "economics policy ID");
	for (let t of e.supportedPolicyIds) if (typeof t != "string" || !Object.prototype.hasOwnProperty.call(gu, t)) throw new $(`Analysis has an unsupported economics policy ${String(t)}`);
	for (let [t, n] of [["usage", e.usageCompleteness], ["cost", e.costCompleteness]]) {
		if (!n || typeof n != "object") throw new $(`Analysis has invalid ${t} economics coverage`);
		for (let e of [
			"complete",
			"partial",
			"missing",
			"unsupported"
		]) if (!Number.isSafeInteger(n[e]) || n[e] < 0) throw new $(`Analysis has invalid ${t} economics ${e} count`);
	}
	if (!Number.isSafeInteger(e.cacheReadEligibleCalls) || e.cacheReadEligibleCalls < 0 || e.cacheReadEligibleCalls > t.length) throw new $("Analysis has invalid cache-read coverage count");
	if (Sl(e.cacheReadPromptTokens, "Analysis cache-read prompt token total"), Sl(e.cacheReadTokens, "Analysis cache-read token total"), Yv(e.cacheReadRatio, "Analysis cache-read ratio"), !Array.isArray(e.explanationCodes) || e.explanationCodes.some((e) => typeof e != "string")) throw new $("Analysis has invalid economics explanations");
	for (let n of t) if (Zv(n), n.economics.policyId !== null && !e.supportedPolicyIds.includes(n.economics.policyId)) throw new $(`Call ${n.index} economics policy is missing from the summary`);
	if ($v(t), e.cacheReadPromptTokens === null != (e.cacheReadTokens === null)) throw new $("Analysis has incomplete cache-read token totals");
	if (e.cacheReadPromptTokens !== null && e.cacheReadTokens !== null) {
		if (e.cacheReadRatio === null && e.cacheReadPromptTokens > 0) throw new $("Analysis is missing a cache-read ratio for covered tokens");
		Xv(e.cacheReadRatio, e.cacheReadTokens, e.cacheReadPromptTokens, "Analysis cache-read ratio");
	} else if (e.cacheReadRatio !== null) throw new $("Analysis has a cache-read ratio without covered tokens");
}
//#endregion
//#region src/lib/timing-validation.ts
var ty = /* @__PURE__ */ new Set([
	"openai-codex-responses",
	"openai-responses",
	"openai-completions",
	"anthropic-messages",
	"google-generative-ai",
	"google-vertex",
	"azure-openai-responses",
	"bedrock-converse-stream",
	"pi-messages"
]);
function ny(e, t) {
	let n = t === "pi", r = e.timing, i = () => {
		throw new $(`Call ${e.index} has invalid response timing`);
	};
	if (!r || typeof r != "object") return i();
	for (let e of [r.startedAtMs, r.recordedAtMs]) e !== null && (!Number.isSafeInteger(e) || !Number.isFinite(new Date(e).getTime())) && i();
	let { durationMs: a, effectiveOutputTokensPerSecond: o, basis: s } = r;
	if (a === null) {
		(o !== null || s !== null) && i();
		return;
	}
	let c = e.usage.output;
	c !== null && (!Number.isSafeInteger(c) || c < 0) && i();
	let l = (e) => {
		e === null ? o !== null && i() : (o === null || !Number.isFinite(o) || o < 0 || Math.abs(o - e) > Math.max(1, Math.abs(e)) * 1e-9) && i();
	};
	if (s === "vscode-copilot-trace-spans") {
		(t !== "vscode-copilot" || !Number.isSafeInteger(a) || a <= 0 || r.startedAtMs === null || r.recordedAtMs === null || r.recordedAtMs - r.startedAtMs !== a) && i(), l(c === null ? null : c * 1e3 / a);
		return;
	}
	(!Number.isSafeInteger(a) || a <= 0 || s !== "pi-message-timestamps" || !n || !ty.has(e.api ?? "") || ![
		"stop",
		"toolUse",
		"length",
		"error",
		"aborted"
	].includes(e.stopReason ?? "") || r.startedAtMs === null || r.recordedAtMs === null || r.recordedAtMs - r.startedAtMs !== a) && i(), l([
		"stop",
		"toolUse",
		"length"
	].includes(e.stopReason ?? "") && c !== null ? c * 1e3 / a : null);
}
//#endregion
//#region src/lib/cost-validation.ts
var ry = /* @__PURE__ */ new Set([
	"recorded",
	"estimated",
	"apiEquivalent",
	"free",
	"unknown"
]), iy = /* @__PURE__ */ new Set([
	"recordedCost",
	"billingModeTable",
	"opencodeZeroWithListedPrice",
	"perTokenDefault",
	"failedAttempt",
	"missingTime",
	"noPrice",
	"missingUsage"
]), ay = /* @__PURE__ */ new Set([
	"documented",
	"firstObserved",
	"modelsDevCommit"
]), oy = (e) => typeof e == "number" && Number.isFinite(e) && e >= 0, sy = (e) => typeof e == "number" && Number.isSafeInteger(e) && e >= 0;
function cy(e) {
	let t = e.costAssessment, n = (t) => {
		throw new $(`Model call ${e.index} cost ${t}`);
	};
	(!t || !ry.has(t.kind)) && n("has an unknown kind"), iy.has(t.classificationRule) || n("has an unknown classification rule"), t.amount !== null && !oy(t.amount) && n("has an invalid amount"), t.kind === "unknown" != (t.amount === null) && n("amount disagrees with its kind"), t.amountHigh !== null && (!oy(t.amountHigh) || t.amount === null || t.amountHigh < t.amount) && n("has an invalid range"), t.recordedByHarness !== null && !oy(t.recordedByHarness) && n("has an invalid recorded value"), t.billingMode !== null && !["perToken", "subscription"].includes(t.billingMode) && n("has an unknown billing mode"), t.kind === "apiEquivalent" != (t.billingMode === "subscription" && t.amount !== null) && n("is API-equivalent without a subscription, or the reverse");
	let r = t.rate;
	r !== null && ((typeof r.provider != "string" || typeof r.model != "string" || typeof r.labEquivalent != "boolean" || typeof r.source != "string" || !ay.has(r.startBasis) || r.validFrom !== null && Number.isNaN(Date.parse(r.validFrom))) && n("has an invalid rate"), r.labEquivalent && t.kind !== "apiEquivalent" && n("uses a lab rate outside a subscription")), (t.kind === "estimated" || t.kind === "apiEquivalent") && r === null && n("is calculated without a rate");
}
function ly(e, t) {
	let n = () => {
		throw new $(`Session ${t} cost subtotal is inconsistent`);
	};
	(!e || !sy(e.calls)) && n();
	let { low: r, high: i, calls: a } = e;
	if (a === 0) {
		(r !== null || i !== null) && n();
		return;
	}
	(r !== null || i !== null) && (!oy(r) || !oy(i) || i < r) && n();
}
function uy(e) {
	if (!e) throw new $("Session has no cost summary");
	if (ly(e.billed, "billed"), ly(e.apiEquivalent, "API-equivalent"), !sy(e.unknownCalls) || !sy(e.failedAttemptCalls)) throw new $("Session cost summary has invalid call counts");
	let t = e.priceData;
	if (!t || typeof t.modelsDevCommit != "string" || typeof t.modelsDevCommittedAt != "string" || t.amendmentsImportedFrom !== null && typeof t.amendmentsImportedFrom != "string") throw new $("Session cost summary has no price data source");
}
function dy(e) {
	if (e !== null && (!e || !oy(e.totalUsd) || e.sinceMs !== null && !(Number.isSafeInteger(e.sinceMs) && e.sinceMs >= 0))) throw new $("Session has an invalid harness session cost");
}
//#endregion
//#region src/lib/analysis-ordering.ts
function fy(e) {
	let t = /* @__PURE__ */ new Map(), n = 0;
	for (let r of e.modelCalls) for (let e of r.contextItemIds) t.has(e) || t.set(e, n++);
	let r = /* @__PURE__ */ new Map();
	for (let n of e.contextItems) {
		let e = t.get(n.id) ?? (2 ** 53 - 1) / 2;
		n.kind === "system" ? r.set(n.id, -2e6 + e) : n.kind === "toolDefinition" ? r.set(n.id, -1e6 + e) : r.set(n.id, e);
	}
	let i = /* @__PURE__ */ new Map(), a = (e, t) => {
		let n = t === void 0 ? void 0 : r.get(t);
		n !== void 0 && (r.set(e, n), i.set(e, t));
	}, o = [...mc(e.contextItems)].sort(([, e], [, t]) => e.number - t.number);
	for (let [e, t] of o) a(e, t.previousId ?? void 0);
	let s = e.contextItems.filter((e) => e.kind === "unrecordedContext" && e.presence.length > 0).sort((e, t) => e.firstModelCall - t.firstModelCall);
	for (let [e, t] of s.entries()) a(t.id, s[e - 1]?.id);
	let c = new Map(e.contextItems.map((e) => [e.id, e])), l = (e, t) => (r.get(e.id) ?? 0) - (r.get(t.id) ?? 0) || e.id.localeCompare(t.id);
	for (let t of e.compactions) {
		let n = py(t.sourceItemIds.flatMap((e) => c.get(e) ?? []), l), r = py(e.contextItems.filter((e) => e.firstModelCall === t.beforeModelCall), l);
		for (let [e, t] of r) {
			let r = n.get(e) ?? [];
			for (let [e, n] of t.entries()) a(n.id, r[e]?.id);
		}
	}
	for (let t of e.compactions) {
		let e = t.sourceItemIds.map((e) => r.get(e)).filter((e) => e !== void 0).sort((e, t) => e - t);
		if (e.length === 0) continue;
		let n = Math.floor(e.length / 2), i = e.length % 2 == 0 ? (e[n - 1] + e[n]) / 2 : e[n];
		r.set(t.summaryItemId, i + 1e-4);
	}
	return {
		orderedItemIds: e.contextItems.map((e) => e.id).sort((e, t) => (r.get(e) ?? 0) - (r.get(t) ?? 0) || e.localeCompare(t)),
		takesPlaceOf: i
	};
}
function py(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let t of e) {
		if (t.kind !== "customMessage") continue;
		let e = n.get(t.label);
		e ? e.push(t) : n.set(t.label, [t]);
	}
	for (let e of n.values()) e.sort(t);
	return n;
}
//#endregion
//#region src/lib/analysis-structure.ts
function my(e, t, n) {
	let r = e.get(t);
	r ? r.push(n) : e.set(t, [n]);
}
function hy(e) {
	xl(e.contextItems.map((e) => e.id), "context item ID");
	let t = e.modelCalls.map((e) => e.index);
	if (new Set(t).size !== t.length) throw new $("Duplicate model-call index");
	let n = new Map(e.contextItems.map((e) => [e.id, e])), r = new Map(e.modelCalls.map((e) => [e.index, e])), i = new Map(e.modelCalls.map((e) => [e.index, new Set(e.contextItemIds)])), a = /* @__PURE__ */ new Map();
	for (let t of e.contextItems) a.set(t.id, new Map(t.tokenEstimates.map((e) => [e.profileId, e])));
	let { orderedItemIds: o, takesPlaceOf: s } = fy(e), c = new Map(o.map((e, t) => [e, t])), l = new Map(e.modelCalls.map((e) => [e.index, [...e.contextItemIds].sort((e, t) => (c.get(e) ?? 0) - (c.get(t) ?? 0))])), u = e.modelCalls[0]?.index ?? 0, d = e.modelCalls[e.modelCalls.length - 1]?.index ?? 0, f = d + 1, p = new Set(e.compactions.map((e) => e.summaryItemId)), m = new Set(e.compactions.filter((e) => e.beforeModelCall === f).map((e) => e.summaryItemId)), h = /* @__PURE__ */ new Map();
	for (let t of e.contextItems) {
		if (!Number.isFinite(t.displayWeight) || t.displayWeight < 0) throw new $(`Item ${t.id} has an invalid display weight`);
		if (t.ageAtFinalModelCall !== null && (!Number.isSafeInteger(t.ageAtFinalModelCall) || t.ageAtFinalModelCall < 0)) throw new $(`Item ${t.id} has an invalid final age`);
		if (t.preview !== null) {
			if (![
				"text",
				"toolCall",
				"toolResult",
				"summary",
				"image",
				"unavailable"
			].includes(t.preview.kind)) throw new $(`Item ${t.id} has an unsupported preview kind`);
			if (typeof t.preview.text != "string" || typeof t.preview.truncated != "boolean" || typeof t.preview.expandedText != "string" || typeof t.preview.expandedTruncated != "boolean" || [...t.preview.text].length > 160 || [...t.preview.expandedText].length > 640) throw new $(`Item ${t.id} has an invalid preview`);
		}
		xl(t.tokenEstimates.map((e) => e.profileId), `token estimate profile for item ${t.id}`);
		for (let e of t.tokenEstimates) {
			if (e.tokens !== null && (!Number.isSafeInteger(e.tokens) || e.tokens < 0)) throw new $(`Item ${t.id} has an invalid token estimate`);
			if (![
				"modelTokenizer",
				"apiSerializationEstimate",
				"characterHeuristic",
				"reportedUsage",
				"unavailable"
			].includes(e.method)) throw new $(`Item ${t.id} has an unsupported tokenization method`);
			if (![
				"complete",
				"partial",
				"unavailable"
			].includes(e.coverage)) throw new $(`Item ${t.id} has an unsupported token coverage`);
		}
		if (t.presenceCallCount !== t.presence.reduce((e, t) => e + t.endCall - t.startCall + 1, 0)) throw new $(`Item ${t.id} has an invalid presence call count`);
		let e = m.has(t.id);
		if (t.presence.length === 0) {
			if (!p.has(t.id) || t.firstModelCall !== 0 || t.lastModelCall !== 0) throw new $(`Item ${t.id} has no presence ranges`);
			h.set(t.id, /* @__PURE__ */ new Set());
			continue;
		}
		if (e) throw new $(`Terminal compaction summary ${t.id} has presence ranges`);
		let n = /* @__PURE__ */ new Set(), r = 0;
		for (let e of t.presence) {
			if (!Number.isInteger(e.startCall) || !Number.isInteger(e.endCall) || e.startCall > e.endCall || e.startCall < u || e.endCall > d) throw new $(`Item ${t.id} has an invalid presence range`);
			if (e.startCall <= r) throw new $(`Item ${t.id} has overlapping or unsorted presence ranges`);
			r = e.endCall;
			for (let r = e.startCall; r <= e.endCall; r += 1) if (n.add(r), !i.get(r)?.has(t.id)) throw new $(`Item ${t.id} presence disagrees with model call ${r}`);
		}
		if (t.firstModelCall !== t.presence[0].startCall || t.lastModelCall !== r) throw new $(`Item ${t.id} lifetime does not match its presence ranges`);
		h.set(t.id, n);
	}
	for (let [t, r] of e.modelCalls.entries()) {
		let o = i.get(r.index) ?? /* @__PURE__ */ new Set();
		for (let [e, t] of [
			["context", r.contextItemIds],
			["added", r.addedItemIds],
			["dropped", r.droppedItemIds]
		]) {
			xl(t, `${e} item reference in call ${r.index}`);
			for (let e of t) if (!n.has(e)) throw new $(`Call ${r.index} references unknown item ${e}`);
		}
		if (["calculatedTokens", "estimatedTokens"].includes(e.displayWeightUnit)) {
			if (r.tokenizationProfileId === null) throw new $(`Call ${r.index} has no tokenization profile`);
			for (let e of r.contextItemIds) {
				let t = a.get(e)?.get(r.tokenizationProfileId);
				if (!t || t.tokens === null) throw new $(`Call ${r.index} is missing a token weight for ${e}`);
			}
		}
		let s = t === 0 ? /* @__PURE__ */ new Set() : i.get(e.modelCalls[t - 1].index) ?? /* @__PURE__ */ new Set(), c = r.contextItemIds.filter((e) => !s.has(e)), l = [...s].filter((e) => !o.has(e));
		if (c.join("\0") !== r.addedItemIds.join("\0") || l.join("\0") !== r.droppedItemIds.join("\0")) throw new $(`Call ${r.index} has invalid context deltas`);
		let u = r.contextItemIds.length - c.length;
		if (r.transitionItemCounts.added !== c.length || r.transitionItemCounts.retained !== u || r.transitionItemCounts.dropped !== l.length) throw new $(`Call ${r.index} has invalid transition counts`);
		for (let e of r.contextItemIds) if (!h.get(e)?.has(r.index)) throw new $(`Model call ${r.index} references item ${e} outside its presence ranges`);
	}
	let g = /* @__PURE__ */ new Map(), _ = /* @__PURE__ */ new Map(), v = /* @__PURE__ */ new Map(), y = /* @__PURE__ */ new Map(), b = /* @__PURE__ */ new Map();
	for (let t of e.compactions) {
		if (g.has(t.id)) throw new $(`Duplicate compaction ID ${t.id}`);
		if (!Number.isInteger(t.beforeModelCall) || t.beforeModelCall < (u || 1) || t.beforeModelCall > f) throw new $(`Compaction ${t.id} has an invalid call boundary`);
		if (!n.has(t.summaryItemId)) throw new $(`Compaction ${t.id} references a missing summary`);
		for (let e of [...t.sourceItemIds, ...t.retainedItemIds]) if (!n.has(e)) throw new $(`Compaction ${t.id} references unknown item ${e}`);
		g.set(t.id, t), _.set(t.summaryItemId, t), my(v, t.summaryItemId, t);
		for (let e of t.sourceItemIds) my(y, e, t);
		for (let e of t.retainedItemIds) my(b, e, t);
	}
	let x = /* @__PURE__ */ new Map(), S = /* @__PURE__ */ new Map();
	for (let t of e.lineage) {
		if (!n.has(t.from) || !n.has(t.to)) throw new $(`Lineage references missing item ${t.from} → ${t.to}`);
		if (t.kind !== "frameworkCompaction") throw new $(`Unsupported lineage kind ${String(t.kind)}`);
		my(x, t.from, t), my(S, t.to, t);
	}
	return {
		analysis: e,
		itemById: n,
		callByIndex: r,
		outgoingLineage: x,
		incomingLineage: S,
		compactionById: g,
		compactionBySummaryId: _,
		compactionsBySummaryId: v,
		compactionBySourceId: y,
		compactionsByRetainedId: b,
		itemEstimateByProfile: a,
		contextSetByCall: i,
		orderedItemIdsByCall: l,
		itemColorSlotById: Da(e.contextItems, o, l, s),
		versionByItemId: mc(e.contextItems)
	};
}
//#endregion
//#region src/lib/analysis.ts
var gy = /* @__PURE__ */ new Set([
	"system",
	"toolDefinition",
	"userMessage",
	"assistantMessage",
	"toolResult",
	"compactionSummary",
	"customMessage",
	"branchSummary",
	"thinking",
	"unrecordedContext",
	"other"
]);
function _y(e) {
	return gy.has(e) ? e : "other";
}
function vy(e) {
	let t = e.contextItems.map((e) => e.id), n = (e, n, r) => {
		if (!Array.isArray(e)) throw new $(`Model call ${n} has no ${r} list`);
		return e.map((e) => {
			if (typeof e != "number" || !Number.isSafeInteger(e) || e < 0 || e >= t.length) throw new $(`Model call ${n} ${r} references an unknown item position`);
			return t[e];
		});
	}, r = {
		contextItemIndexes: "contextItemIds",
		addedItemIndexes: "addedItemIds",
		droppedItemIndexes: "droppedItemIds"
	};
	return {
		...e,
		modelCalls: e.modelCalls.map((e) => Object.fromEntries(Object.entries(e).map(([t, i]) => t in r ? [r[t], n(i, e.index, t)] : [t, i])))
	};
}
function yy(e) {
	if (e.displayWeightUnit !== e.tokenAnalysis.chartUnit) throw new $("Chart unit disagrees with token-analysis metadata");
	if (![
		"calculatedTokens",
		"estimatedTokens",
		"unavailable"
	].includes(e.displayWeightUnit)) throw new $(`Unsupported chart unit ${String(e.displayWeightUnit)}`);
	Tl(e);
	for (let t of e.modelCalls) if (typeof t.tokenAnalysis.metricsIncludePartialEstimates != "boolean") throw new $(`Model call ${t.index} does not say whether its metrics include partial estimates`);
	if (ey(e.economics, e.modelCalls), e.modelCalls.forEach((t) => ny(t, e.session.source)), e.modelCalls.forEach(cy), uy(e.session.costSummary), dy(e.session.harnessSessionCost), e.session.reportedCostTotal !== null && (!Number.isFinite(e.session.reportedCostTotal) || e.session.reportedCostTotal < 0)) throw new $("Analysis has an invalid calculated session cost total");
	if (by(e.session.reportedCostCoverage, "Session cost"), by(e.session.reportedUsageCoverage, "Session usage"), e.session.reportedCostCoverage.recordedCalls === 0 && e.session.reportedCostTotal !== null) throw new $("Session cost subtotal has no recorded calls");
	if (e.session.reportedUsageCoverage.recordedCalls === 0 && e.session.reportedPromptTokens !== null) throw new $("Session prompt subtotal has no recorded calls");
}
function by(e, t) {
	let n = e ? [
		e.recordedCalls,
		e.failedAttemptCalls,
		e.missingCalls
	] : [];
	if (n.length !== 3 || !n.every((e) => Number.isSafeInteger(e) && e >= 0)) throw new $(`${t} coverage is not a set of call counts`);
}
function xy(e) {
	return {
		...e,
		modelCalls: [...e.modelCalls].sort((e, t) => e.index - t.index),
		contextItems: e.contextItems.map((e) => ({
			...e,
			kind: _y(e.kind),
			presence: [...e.presence],
			metadata: { ...e.metadata }
		})),
		compactions: [...e.compactions].sort((e, t) => e.beforeModelCall - t.beforeModelCall || e.id.localeCompare(t.id)),
		lineage: [...e.lineage].sort((e, t) => e.to.localeCompare(t.to) || e.from.localeCompare(t.from) || e.kind.localeCompare(t.kind))
	};
}
function Sy(e) {
	if (e.schemaVersion !== 1) throw new $(`Unsupported analysis schema ${String(e.schemaVersion)}`);
	let t = vy(e);
	return yy(t), hy(xy(t));
}
//#endregion
//#region src/lib/embed/analysis-controller.ts
function Cy(e) {
	let t = {
		indexed: null,
		loading: !1,
		error: "",
		revision: 0,
		kind: null
	}, n = tt(t), r = null, i = null, a = !1;
	function o(e) {
		t = {
			...t,
			...e
		}, n.set(t);
	}
	async function s() {
		if (a) return;
		i?.abort();
		let n = new AbortController();
		i = n;
		let s = () => !a && i === n && !n.signal.aborted;
		o({
			loading: !0,
			error: ""
		});
		try {
			let i = await e(n.signal, r);
			if (!s()) return;
			if (i.status === "notModified") {
				if (!t.indexed) throw Error("Not modified without a previous analysis");
				r = i.etag ?? r;
			} else {
				let e = Sy(i.analysis);
				if (!s()) return;
				let n = t.indexed?.analysis.session.id === e.analysis.session.id ? "replacement" : "selection";
				r = i.etag, o({
					indexed: e,
					kind: n,
					revision: t.revision + 1
				});
			}
		} catch (e) {
			if (!s()) return;
			o({ error: e instanceof $ ? `Analysis is inconsistent: ${e.message}` : e instanceof Error ? e.message : String(e) });
		} finally {
			s() && (i = null, o({ loading: !1 }));
		}
	}
	function c() {
		a = !0, i?.abort(), i = null;
	}
	return {
		...nt(n),
		refresh: s,
		dispose: c
	};
}
//#endregion
//#region src/lib/embed/EmbeddedSession.svelte
var wy = /* @__PURE__ */ W("<button type=\"button\">Retry</button>"), Ty = /* @__PURE__ */ W("<p role=\"alert\" class=\"svelte-11525tj\"> <!></p>"), Ey = /* @__PURE__ */ W("<p>Analysing session…</p>"), Dy = /* @__PURE__ */ W("<div class=\"embedded-session svelte-11525tj\"><header class=\"svelte-11525tj\"><button type=\"button\" class=\"follow svelte-11525tj\">Follow latest</button> <span role=\"status\" class=\"svelte-11525tj\"> </span> <!></header> <!> <!></div>"), Oy = {
	hash: "svelte-11525tj",
	code: ".embedded-session.svelte-11525tj {min-width:0;padding:12px;}header.svelte-11525tj {display:flex;align-items:center;flex-wrap:wrap;gap:8px;}.follow[aria-pressed='true'].svelte-11525tj {border-color:var(--accent);background-color:var(--action);color:var(--active-text);}header.svelte-11525tj span:where(.svelte-11525tj) {color:var(--secondary);font-size:var(--text-sm);}p[role='alert'].svelte-11525tj {color:var(--error);}"
};
function ky(e, t) {
	Be(t, !0), li(e, Oy);
	let n = () => ot(o, "$controller", r), [r, i] = st(), a = X(t, "defaultVerticalScale", 3, "session"), o = Cy((e, n) => yr(() => t.loadAnalysis(e, n))), s = /* @__PURE__ */ F(yr(() => {
		let e = Gi();
		return e.river.verticalScale = a(), Yi(void 0, t.preferencesKey, e);
	})), c = /* @__PURE__ */ F(!0), l = 0, u = 0, d = /* @__PURE__ */ F(void 0), f = !1;
	function p(e) {
		Xi(e, void 0, t.preferencesKey);
	}
	function m() {
		I(c, !1), u += 1;
	}
	function h() {
		I(c, !0), H(d)?.followLatest();
	}
	Cn(() => {
		let e = n().revision;
		if (e !== l && (l = e, n().kind === "selection" && I(c, !0), H(c))) {
			let e = ++u;
			gr().then(() => {
				!f && H(c) && e === u && H(d)?.followLatest();
			});
		}
	}), zi(() => (o.refresh(), () => {
		f = !0, o.dispose();
	}));
	function g() {
		o.refresh();
	}
	var _ = { refresh: g }, v = Dy(), y = L(v), b = L(y), x = B(b, 2), S = z(x, !0), C = B(x, 2), w = (e) => {
		var t = wy();
		U("click", t, () => o.refresh()), G(e, t);
	};
	q(C, (e) => {
		n().error && e(w);
	}), M(y);
	var ee = B(y, 2), T = (e) => {
		var t = Ty(), r = L(t, !0), i = B(r), a = (e) => {
			G(e, zr("Showing the previous analysis."));
		};
		q(i, (e) => {
			n().indexed && e(a);
		}), M(t), V(() => K(r, n().error)), G(e, t);
	};
	q(ee, (e) => {
		n().error && e(T);
	});
	var E = B(ee, 2), te = (e) => {
		Li(Vv(e, {
			get indexed() {
				return n().indexed;
			},
			keyboardScope: "root",
			onPreferencesChange: p,
			onPin: m,
			get sections() {
				return t.sections;
			},
			get following() {
				return H(c);
			},
			get presentation() {
				return H(s);
			},
			set presentation(e) {
				I(s, e);
			}
		}), (e) => I(d, e, !0), () => H(d));
	}, D = (e) => {
		G(e, Ey());
	};
	q(E, (e) => {
		n().indexed ? e(te) : n().loading && e(D, 1);
	}), M(v), V(() => {
		Y(b, "aria-pressed", H(c)), Y(b, "title", H(c) ? "Following new calls. Select to stop following." : "Select to follow new calls."), K(S, n().loading ? "Updating…" : n().error ? "Update failed" : "Live");
	}), U("click", b, () => H(c) ? m() : h()), G(e, v);
	var O = Ve(_);
	return i(), O;
}
kr(["click"]);
//#endregion
//#region scripts/theme-html.ts
function Ay(e) {
	let t = Object.entries(e.tokens).map(([e, t]) => `--${e}:${t};`), n = Object.entries(e.itemTypes).map(([e, t]) => `--item-type-${e}:${t};`), r = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5l5 5 5-5' fill='none' stroke='${e.tokens.secondary.replace("#", "%23")}' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;
	return `color-scheme:${e.colorScheme};${t.join("")}${n.join("")}--chevron:${r};`;
}
function jy(e = Object.values(va), t = "html") {
	let n = t === "html" ? ":root" : ":host", r = t === "html" ? "html{background:var(--page)}" : "", i = (e) => t === "html" ? `html[data-theme="${e}"]` : `:host([data-theme="${e}"])`;
	return `${n}{${Ay(va.dark)}}${r}${e.map((e) => `${i(e.id)}{${Ay(e)}}`).join("")}`;
}
//#endregion
//#region src/lib/styles/workspace.css?inline
var My = ":root,:host{--text-xs:11px;--text-sm:12px;--text-md:13px;--text-lg:15px;--radius:8px;--control-radius:6px;--radius-small:2px;--space-1:4px;--space-2:8px;--space-3:12px;--space-4:16px;--space-5:24px;--space-6:32px;--control-padding:7px 9px;--control-size:32px;--toggle-height:30px;--toggle-padding:4px 9px;--panel-padding:15px;--panel-gap:14px}*{box-sizing:border-box}button,select{background-color:var(--surface);border:1px solid var(--control-border);color:var(--text);border-radius:var(--control-radius);padding:var(--control-padding)}button{cursor:pointer}button:hover{background-color:var(--surface-raised)}:focus-visible{outline:2px solid var(--accent);outline-offset:3px}summary:focus-visible{border-radius:var(--radius-small)}.sr-only{clip:rect(0, 0, 0, 0);white-space:nowrap;border:0;width:1px;height:1px;margin:-1px;padding:0;position:absolute;overflow:hidden}.toggle-group{flex-wrap:wrap;align-items:center;gap:5px;display:flex}.toggle-label{color:var(--text);margin-right:3px;font-weight:650}.toggle-group>button{min-height:var(--toggle-height);padding:var(--toggle-padding);border:1px solid var(--separator);background-color:var(--surface);color:var(--text);font:inherit}.toggle-group>button[aria-pressed=true]{border-color:var(--accent);background-color:var(--action);color:var(--active-text)}input{color:var(--text);background:var(--plot);border:1px solid var(--control-border)}summary{cursor:pointer}.disclosure{width:fit-content;color:var(--secondary);cursor:pointer;align-items:center;gap:7px;font-size:13px;list-style:none;display:inline-flex}.disclosure::-webkit-details-marker{display:none}.disclosure:before{content:\"\";border-top:4px solid #0000;border-bottom:4px solid #0000;border-left:6px solid;transition:transform .12s}details[open]>.disclosure:before,.disclosure[aria-expanded=true]:before{transform:rotate(90deg)}select{appearance:none;background-image:var(--chevron);background-position:right 12px center;background-repeat:no-repeat;background-size:12px 8px}@media (prefers-reduced-motion:reduce){*,:before,:after{scroll-behavior:auto!important}}", Ny = {
	standard: Cv,
	panel: wv
}, Py = /* @__PURE__ */ new WeakMap();
function Fy(e) {
	let { target: t } = e, n = Py.get(t) ?? t.attachShadow({ mode: "open" });
	if (n.hasChildNodes()) throw Error("Highwater is already mounted in this target");
	Py.set(t, n);
	let r = t.getAttribute("data-theme"), i = document.createElement("style");
	i.textContent = jy(void 0, ":host") + My + "\n    :host { display:block; background:var(--page); color:var(--text);\n      font:14px/1.45 Inter,ui-sans-serif,system-ui,sans-serif; }\n    .highwater-embed-root { container-type:inline-size; container-name:highwater; min-width:0; }\n    .highwater-embed-root.compact { font-size:13px; --control-padding:4px 8px; --control-size:24px;\n      --toggle-height:24px; --toggle-padding:3px 8px; --panel-padding:12px; --panel-gap:10px; }\n    .highwater-embed-root.compact :is(button:not(.step-call), select, input, summary) { font-size:12px; }\n  ";
	let a = document.createElement("div");
	a.className = e.density === "compact" ? "highwater-embed-root compact" : "highwater-embed-root", n.append(i, a);
	let o = !1;
	function s(e) {
		o || (t.dataset.theme = e, ja.setPalette(e));
	}
	s(e.theme);
	let c;
	try {
		c = Gr(ky, {
			target: a,
			props: {
				loadAnalysis: e.loadAnalysis,
				preferencesKey: e.preferencesKey,
				sections: e.sections,
				defaultVerticalScale: e.defaultVerticalScale
			}
		});
	} catch (e) {
		throw n.replaceChildren(), r === null ? t.removeAttribute("data-theme") : t.setAttribute("data-theme", r), e;
	}
	return {
		refresh: () => {
			o || c.refresh();
		},
		setTheme: s,
		destroy: () => {
			o || (o = !0, Yr(c), n.replaceChildren(), r === null ? t.removeAttribute("data-theme") : t.setAttribute("data-theme", r));
		}
	};
}
//#endregion
export { Fy as mountHighwater, Ny as sectionPresets };
