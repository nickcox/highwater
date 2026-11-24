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
var h = 1024, g = 2048, _ = 4096, v = 8192, y = 16384, b = 32768, x = 1 << 25, S = 65536, ee = 1 << 19, C = 1 << 20, w = 1 << 25, T = 65536, E = 1 << 21, D = 1 << 22, O = 1 << 23, k = Symbol("$state"), te = Symbol("component"), A = Symbol("legacy props"), ne = Symbol(""), re = Symbol("attributes"), ie = Symbol("class"), ae = Symbol("style"), oe = Symbol("text"), se = Symbol("form reset"), ce = new class extends Error {
	name = "StaleReactionError";
	message = "The reaction that called `getAbortSignal()` was re-run or destroyed";
}(), le = !!globalThis.document?.contentType && /* @__PURE__ */ globalThis.document.contentType.includes("xml"), ue = {}, de = Symbol("uninitialized"), fe = "http://www.w3.org/1999/xhtml";
function pe() {
	console.warn("https://svelte.dev/e/derived_inert");
}
function me(e) {
	console.warn("https://svelte.dev/e/hydration_mismatch");
}
function he() {
	console.warn("https://svelte.dev/e/select_multiple_invalid_value");
}
function ge() {
	console.warn("https://svelte.dev/e/svelte_boundary_reset_noop");
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/hydration.js
var j = !1;
function _e(e) {
	j = e;
}
var M;
function ve(e) {
	if (e === null) throw me(), ue;
	return M = e;
}
function ye() {
	return ve(/* @__PURE__ */ dn(M));
}
function N(e) {
	if (j) {
		if (/* @__PURE__ */ dn(M) !== null) throw me(), ue;
		M = e;
	}
}
function be(e = 1) {
	if (j) {
		for (var t = e, n = M; t--;) n = /* @__PURE__ */ dn(n);
		M = n;
	}
}
function xe(e = !0) {
	for (var t = 0, n = M;;) {
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
function Se(e) {
	if (!e || e.nodeType !== 8) throw me(), ue;
	return e.data;
}
//#endregion
//#region node_modules/svelte/src/internal/client/reactivity/equality.js
function Ce(e) {
	return e === this.v;
}
function we(e, t) {
	return e == e ? e !== t || typeof e == "object" && !!e || typeof e == "function" : t == t;
}
function Te(e) {
	return !we(e, this.v);
}
function Ee(e) {
	throw Error("https://svelte.dev/e/lifecycle_outside_component");
}
//#endregion
//#region node_modules/svelte/src/internal/client/errors.js
function De() {
	throw Error("https://svelte.dev/e/async_derived_orphan");
}
function Oe(e, t, n) {
	throw Error("https://svelte.dev/e/each_key_duplicate");
}
function ke(e) {
	throw Error("https://svelte.dev/e/effect_in_teardown");
}
function Ae() {
	throw Error("https://svelte.dev/e/effect_in_unowned_derived");
}
function je(e) {
	throw Error("https://svelte.dev/e/effect_orphan");
}
function Me() {
	throw Error("https://svelte.dev/e/effect_update_depth_exceeded");
}
function Ne(e) {
	throw Error("https://svelte.dev/e/props_invalid_value");
}
function Pe() {
	throw Error("https://svelte.dev/e/state_descriptors_fixed");
}
function Fe() {
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
	return i(e, te, { value: !0 }), e;
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
		if (we(e, t) && (e = t, n)) {
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
			if (!e.defaultPrevented) for (let t of e.target.elements) t[se]?.();
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
	let i = e[se];
	e[se] = i ? () => {
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
	return Xn !== null && (Xn.f |= ee), {
		ctx: Re,
		deps: null,
		effects: null,
		equals: Ce,
		f: t,
		fn: e,
		reactions: null,
		rv: 0,
		v: de,
		wv: 0,
		parent: Xn,
		ac: null
	};
}
var vt = Symbol("obsolete");
/*#__NO_SIDE_EFFECTS__*/
function yt(e, t, n) {
	let r = Xn;
	r === null && De();
	var i = void 0, a = Jt(de), o = !qn, s = /* @__PURE__ */ new Set();
	return On(() => {
		var t = Xn, n = p();
		i = n.promise;
		try {
			Promise.resolve(e()).then(n.resolve, (e) => {
				e !== ce && n.reject(e);
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
			l?.(), s.delete(n), t !== vt && (c.activate(), t ? (a.f |= O, Xt(a, t)) : (a.f & 8388608 && (a.f ^= O), Xt(a, e)), c.deactivate());
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
	return t.equals = Te, t;
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
	if (!Gn && r !== null && e.v !== de && r.f & 24576) return pe(), e.v;
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
		t.ac.abort(ce), t.ac = null;
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
		e.v !== de && !this.previous.has(e) && this.previous.set(e, e.v), e.f & 8388608 || (this.current.set(e, [t, n]), kt?.set(e, t)), this.is_fork || (e.v = t);
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
		Me();
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
		equals: Ce,
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
	return t || (r.equals = Te), r;
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
	if (typeof t != "object" || !t || k in t || te in t) return t;
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
			(!("value" in n) || n.configurable === !1 || n.enumerable === !1 || n.writable === !1) && Pe();
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
					let e = f(() => /* @__PURE__ */ F(de, u));
					r.set(t, e), Qt(o);
				}
			} else I(n, de), Qt(o);
			return !0;
		},
		get(e, n, i) {
			if (n === k) return t;
			var o = r.get(n), s = n in e;
			if (o === void 0 && (!s || a(e, n)?.writable) && (o = f(() => /* @__PURE__ */ F(en(s ? e[n] : de), u)), r.set(n, o)), o !== void 0) {
				var c = H(o);
				return c === de ? void 0 : c;
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
				if (a !== void 0 && o !== de) return {
					enumerable: !0,
					configurable: !0,
					value: o,
					writable: !0
				};
			}
			return n;
		},
		has(e, t) {
			if (t === k) return !0;
			var n = r.get(t), i = n !== void 0 && n.v !== de || Reflect.has(e, t);
			return (n !== void 0 || Xn !== null && (!i || a(e, t)?.writable)) && (n === void 0 && (n = f(() => /* @__PURE__ */ F(i ? en(e[t]) : de, u)), r.set(t, n)), H(n) === de) ? !1 : i;
		},
		set(e, t, n, s) {
			var c = r.get(t), l = t in e;
			if (i && t === "length") for (var d = n; d < c.v; d += 1) {
				var p = r.get(d + "");
				p === void 0 ? d in e && (p = f(() => /* @__PURE__ */ F(de, u)), r.set(d + "", p)) : I(p, de);
			}
			if (c === void 0) (!l || a(e, t)?.writable) && (c = f(() => /* @__PURE__ */ F(void 0, u)), I(c, en(n)), r.set(t, c));
			else {
				l = c.v !== de;
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
				return t === void 0 || t.v !== de;
			});
			for (var [n, i] of r) i.v !== de && !(n in e) && t.push(n);
			return t;
		},
		setPrototypeOf() {
			Fe();
		}
	});
}
function tn(e) {
	try {
		if (typeof e == "object" && e && k in e) return e[k];
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
		on = a(t, "firstChild").get, sn = a(t, "nextSibling").get, u(e) && (e[ie] = void 0, e[re] = null, e[ae] = void 0, e.__e = void 0), u(n) && (n[oe] = void 0);
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
	if (!j) return /* @__PURE__ */ un(e);
	var n = /* @__PURE__ */ un(M);
	if (n === null) n = M.appendChild(ln());
	else if (t && n.nodeType !== 3) {
		var r = ln();
		return n?.before(r), ve(r), r;
	}
	return t && hn(n), ve(n), n;
}
function R(e, t = !1) {
	if (!j) {
		var n = /* @__PURE__ */ un(e);
		return n instanceof Comment && n.data === "" ? /* @__PURE__ */ dn(n) : n;
	}
	if (t) {
		if (M?.nodeType !== 3) {
			var r = ln();
			return M?.before(r), ve(r), r;
		}
		hn(M);
	}
	return M;
}
function z(e, t = !1) {
	if (!j) return /* @__PURE__ */ un(e);
	var n = L(e, t);
	return N(e), n;
}
function B(e, t = 1, n = !1) {
	let r = j ? M : e;
	for (var i; t--;) i = r, r = /* @__PURE__ */ dn(r);
	if (!j) return r;
	if (n) {
		if (r?.nodeType !== 3) {
			var a = ln();
			return r === null ? i?.after(a) : r.before(a), ve(a), a;
		}
		hn(r);
	}
	return ve(r), r;
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
	if (t === null) return qn.f |= O, e;
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
	Xn === null && (qn === null && je(e), Ae()), Gn && ke(e);
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
	return bn(4 | C, e);
}
function Tn(e) {
	return vn("$effect.pre"), bn(8 | C, e);
}
function En(e) {
	Lt.ensure();
	let t = bn(64 | ee, e);
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
	return bn(D | ee, e);
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
	return bn(32 | ee, e);
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
			e.abort(ce);
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
		e.ac.abort(ce);
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
		return e.f & 8388608 && (e.f ^= O), d;
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
		s.f & 512 && (s.f ^= 512, s.f &= ~T), s.v !== de && Xe(s), s.ac !== null && dt(() => {
			s.ac.abort(ce), s.ac = null, Ye(s, g);
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
	if (e.v === de) return !0;
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
		if (k in e) xr(e);
		else if (!Array.isArray(e)) for (let t in e) {
			let n = e[t];
			typeof n == "object" && n && k in n && xr(n);
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
		if (j) return Ir(M, null), M;
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
		if (j) return Ir(M, null), M;
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
	if (!j) {
		var t = ln(e + "");
		return Ir(t, t), t;
	}
	var n = M;
	return n.nodeType === 3 ? hn(n) : (n.before(n = ln()), ve(n)), Ir(n, n), n;
}
function Br() {
	if (j) return Ir(M, null), M;
	var e = document.createDocumentFragment(), t = document.createComment(""), n = ln();
	return e.append(t, n), Ir(t, n), e;
}
function G(e, t) {
	if (j) {
		var n = Xn;
		(!(n.f & 32768) || n.nodes.end === null) && (n.nodes.end = M), ye();
		return;
	}
	e !== null && e.before(t);
}
function Vr() {
	if (j && M && M.nodeType === 8 && M.textContent?.startsWith("$")) {
		let e = M.textContent.substring(1);
		return ye(), e;
	}
	return (window.__svelte ??= {}).uid ??= 1, `c${window.__svelte.uid++}`;
}
//#endregion
//#region node_modules/svelte/src/reactivity/create-subscriber.js
function Hr(e) {
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
var Ur = S | ee;
function Wr(e, t, n, r) {
	new Gr(e, t, n, r);
}
var Gr = class {
	parent;
	is_pending = !1;
	transform_error;
	#e;
	#t = j ? M : null;
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
	#h = Hr(() => (this.#m = Jt(this.#l), () => {
		this.#m = null;
	}));
	constructor(e, t, n, r) {
		this.#e = e, this.#n = t, this.#r = (e) => {
			var t = Xn;
			t.b = this, t.f |= 128, n(e);
		}, this.parent = Xn.b, this.transform_error = r ?? this.parent?.transform_error ?? ((e) => e), this.#i = An(() => {
			if (j) {
				let e = this.#t;
				ye();
				let t = e.data === "[!";
				if (e.data.startsWith("[?")) {
					let t = JSON.parse(e.data.slice(2));
					this.#_(t);
				} else t ? this.#y() : this.#g();
			} else this.#b();
		}, Ur), j && (this.#e = M);
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
				ge();
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
		this.#a &&= (Fn(this.#a), null), this.#o &&= (Fn(this.#o), null), this.#s &&= (Fn(this.#s), null), j && (ve(this.#t), be(), ve(xe()));
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
	n !== (e[oe] ??= e.nodeValue) && (e[oe] = n, e.nodeValue = `${n}`);
}
function Kr(e, t) {
	return Jr(e, t);
}
var qr = /* @__PURE__ */ new Map();
function Jr(e, { target: t, anchor: n, props: i = {}, events: a, context: o, intro: s = !0, transformError: c }) {
	cn();
	var l = void 0, u = En(() => {
		var s = n ?? t.appendChild(ln());
		Wr(s, { pending: () => {} }, (t) => {
			Be({});
			var n = Re;
			if (o && (n.c = o), a && (i.$$events = a), j && Ir(t, null), l = e(t, i) || He(), j && (Xn.nodes.end = M, M === null || M.nodeType !== 8 || M.data !== "]")) throw me(), ue;
			Ve();
		}, c);
		var u = /* @__PURE__ */ new Set(), d = (e) => {
			for (var n = 0; n < e.length; n++) {
				var r = e[n];
				if (!u.has(r)) {
					u.add(r);
					var i = Cr(r);
					for (let e of [t, document]) {
						var a = qr.get(e);
						a === void 0 && (a = /* @__PURE__ */ new Map(), qr.set(e, a));
						var o = a.get(r);
						o === void 0 ? (e.addEventListener(r, Mr, { passive: i }), a.set(r, 1)) : a.set(r, o + 1);
					}
				}
			}
		};
		return d(r(Tr)), Er.add(d), () => {
			for (var e of u) for (let n of [t, document]) {
				var r = qr.get(n), i = r.get(e);
				--i == 0 ? (n.removeEventListener(e, Mr), r.delete(e), r.size === 0 && qr.delete(n)) : r.set(e, i);
			}
			Er.delete(d), s !== n && s.parentNode?.removeChild(s);
		};
	});
	return Yr.set(l, u), l;
}
var Yr = /* @__PURE__ */ new WeakMap();
function Xr(e, t) {
	let n = Yr.get(e);
	return n ? (Yr.delete(e), n(t)) : Promise.resolve();
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/blocks/branches.js
var Zr = class {
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
		} else j && (this.anchor = M), this.#a(n);
	}
};
//#endregion
//#region node_modules/svelte/src/internal/client/dom/blocks/if.js
function q(e, t, n = !1) {
	var r;
	j && (r = M, ye());
	var i = new Zr(e), a = n ? S : 0;
	function o(e, t) {
		if (j) {
			var n = Se(r);
			if (e !== parseInt(n.substring(1))) {
				var a = xe();
				ve(a), i.anchor = a, _e(!1), i.ensure(e, t), _e(!0);
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
var Qr = Symbol("NaN");
function $r(e, t, n) {
	j && ye();
	var r = new Zr(e), i = !Ue();
	An(() => {
		var e = t();
		e !== e && (e = Qr), i && typeof e == "object" && e && (e = {}), r.ensure(e, n);
	});
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/blocks/each.js
function ei(e, t) {
	return t;
}
function ti(e, t, n) {
	for (var i = [], a = t.length, o, s = t.length, c = 0; c < a; c++) {
		let n = t[c];
		Rn(n, () => {
			if (o) {
				if (o.pending.delete(n), o.done.add(n), o.pending.size === 0) {
					var t = e.outrogroups;
					ni(e, r(o.done)), t.delete(o), t.size === 0 && (e.outrogroups = null);
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
		ni(e, t, !l);
	} else o = {
		pending: new Set(t),
		done: /* @__PURE__ */ new Set()
	}, (e.outrogroups ??= /* @__PURE__ */ new Set()).add(o);
}
function ni(e, t, n = !0) {
	var r;
	if (e.pending.size > 0) {
		r = /* @__PURE__ */ new Set();
		for (let t of e.pending.values()) for (let n of t) r.add(e.items.get(n).e);
	}
	for (var i = 0; i < t.length; i++) {
		var a = t[i];
		r?.has(a) ? (a.f |= w, Hn(a, document.createDocumentFragment())) : Fn(t[i], n);
	}
}
var ri;
function J(t, n, i, a, o, s = null) {
	var c = t, l = /* @__PURE__ */ new Map();
	if (n & 4) {
		var u = t;
		c = j ? ve(/* @__PURE__ */ un(u)) : u.appendChild(ln());
	}
	j && ye();
	var d = null, f = /* @__PURE__ */ bt(() => {
		var t = i();
		return e(t) ? t : t == null ? [] : r(t);
	}), p, m = /* @__PURE__ */ new Map(), h = !0;
	function g(e) {
		v.effect.f & 16384 || (v.pending.delete(e), v.fallback = d, ai(v, p, c, n, a), d !== null && (p.length === 0 ? d.f & 33554432 ? (d.f ^= w, si(d, null, c)) : Bn(d) : Rn(d, () => {
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
			j && Se(c) === "[!" != (e === 0) && (c = xe(), ve(c), _e(!1), t = !0);
			for (var r = /* @__PURE__ */ new Set(), u = Dt, v = pn(), y = 0; y < e; y += 1) {
				j && M.nodeType === 8 && M.data === "]" && (c = M, t = !0, _e(!1));
				var b = p[y], x = a(b, y), S = h ? null : l.get(x);
				S ? (S.v && Xt(S.v, b), S.i && Xt(S.i, y), v && u.unskip_effect(S.e)) : (S = oi(l, h ? c : ri ??= ln(), b, x, y, o, n, i), h || (S.e.f |= w), l.set(x, S)), r.add(x);
			}
			if (e === 0 && s && !d && (h ? d = jn(() => s(c)) : (d = jn(() => s(ri ??= ln())), d.f |= w)), e > r.size && Oe("", "", ""), j && e > 0 && ve(xe()), !h) {
				if (m.set(u, r), v) {
					for (let [e, t] of l) r.has(e) || u.skip_effect(t.e);
					u.oncommit(g), u.ondiscard(_);
				} else g(u);
			}
			t && _e(!0), H(f);
		}),
		flags: n,
		items: l,
		pending: m,
		outrogroups: null,
		fallback: d
	};
	h = !1, j && (c = M);
}
function ii(e) {
	for (; e !== null && !(e.f & 32);) e = e.next;
	return e;
}
function ai(e, t, n, i, a) {
	var o = !!(i & 8), s = t.length, c = e.items, l = ii(e.effect.first), u, d = null, f, p = [], m = [], h, g, _, v;
	if (o) for (v = 0; v < s; v += 1) h = t[v], g = a(h, v), _ = c.get(g).e, _.f & 33554432 || (_.nodes?.a?.measure(), (f ??= /* @__PURE__ */ new Set()).add(_));
	for (v = 0; v < s; v += 1) {
		if (h = t[v], g = a(h, v), _ = c.get(g).e, e.outrogroups !== null) for (let t of e.outrogroups) t.pending.delete(_), t.done.delete(_);
		if (_.f & 8192 && (Bn(_), o && (_.nodes?.a?.unfix(), (f ??= /* @__PURE__ */ new Set()).delete(_))), _.f & 33554432) {
			if (_.f ^= w, _ === l) si(_, null, n);
			else {
				var y = d ? d.next : l;
				_ === e.effect.last && (e.effect.last = _.prev), _.prev && (_.prev.next = _.next), _.next && (_.next.prev = _.prev), ci(e, d, _), ci(e, _, y), si(_, y, n), d = _, p = [], m = [], l = ii(d.next);
				continue;
			}
		}
		if (_ !== l) {
			if (u !== void 0 && u.has(_)) {
				if (p.length < m.length) {
					var b = m[0], x;
					d = b.prev;
					var S = p[0], ee = p[p.length - 1];
					for (x = 0; x < p.length; x += 1) si(p[x], b, n);
					for (x = 0; x < m.length; x += 1) u.delete(m[x]);
					ci(e, S.prev, ee.next), ci(e, d, S), ci(e, ee, b), l = b, d = ee, --v, p = [], m = [];
				} else u.delete(_), si(_, l, n), ci(e, _.prev, _.next), ci(e, _, d === null ? e.effect.first : d.next), ci(e, d, _), d = _;
				continue;
			}
			for (p = [], m = []; l !== null && l !== _;) (u ??= /* @__PURE__ */ new Set()).add(l), m.push(l), l = ii(l.next);
			if (l === null) continue;
		}
		_.f & 33554432 || p.push(_), d = _, l = ii(_.next);
	}
	if (e.outrogroups !== null) {
		for (let t of e.outrogroups) t.pending.size === 0 && (ni(e, r(t.done)), e.outrogroups?.delete(t));
		e.outrogroups.size === 0 && (e.outrogroups = null);
	}
	if (l !== null || u !== void 0) {
		var C = [];
		if (u !== void 0) for (_ of u) _.f & 8192 || C.push(_);
		for (; l !== null;) !(l.f & 8192) && l !== e.fallback && C.push(l), l = ii(l.next);
		var T = C.length;
		if (T > 0) {
			var E = i & 4 && s === 0 ? n : null;
			if (o) {
				for (v = 0; v < T; v += 1) C[v].nodes?.a?.measure();
				for (v = 0; v < T; v += 1) C[v].nodes?.a?.fix();
			}
			ti(e, C, E);
		}
	}
	o && Ke(() => {
		if (f !== void 0) for (_ of f) _.nodes?.a?.apply();
	});
}
function oi(e, t, n, r, i, a, o, s) {
	var c = o & 1 ? o & 16 ? Jt(n) : /* @__PURE__ */ Yt(n, !1, !1) : null, l = o & 2 ? Jt(i) : null;
	return {
		v: c,
		i: l,
		e: jn(() => (a(t, c ?? n, l ?? i, s), () => {
			e.delete(r);
		}))
	};
}
function si(e, t, n) {
	if (e.nodes) for (var r = e.nodes.start, i = e.nodes.end, a = t && !(t.f & 33554432) ? t.nodes.start : n; r !== null;) {
		var o = /* @__PURE__ */ dn(r);
		if (a.before(r), r === i) return;
		r = o;
	}
}
function ci(e, t, n) {
	t === null ? e.effect.first = n : t.next = n, n === null ? e.effect.last = t : n.prev = t;
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/blocks/snippet.js
function li(e, t, ...n) {
	var r = new Zr(e);
	An(() => {
		let e = t() ?? null;
		r.ensure(e, e && ((t) => e(t, ...n)));
	}, S);
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/css.js
function ui(e, t) {
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
function di(e, t, n) {
	Dn(() => {
		var r = yr(() => t(e, n?.()) || {});
		if (n && r?.update) {
			var i = !1, a = {};
			kn(() => {
				var e = n();
				br(e), i && we(a, e) && (a = e, r.update(e));
			}), i = !0;
		}
		if (r?.destroy) return () => r.destroy();
	});
}
//#endregion
//#region node_modules/svelte/src/internal/shared/attributes.js
var fi = [..." 	\n\r\f\xA0\v﻿"];
function pi(e, t, n) {
	var r = e == null ? "" : "" + e;
	if (t && (r = r ? r + " " + t : t), n) {
		for (var i of Object.keys(n)) if (n[i]) r = r ? r + " " + i : i;
		else if (r.length) for (var a = i.length, o = 0; (o = r.indexOf(i, o)) >= 0;) {
			var s = o + a;
			(o === 0 || fi.includes(r[o - 1])) && (s === r.length || fi.includes(r[s])) ? r = (o === 0 ? "" : r.substring(0, o)) + r.substring(s + 1) : o = s;
		}
	}
	return r === "" ? null : r;
}
function mi(e, t = !1) {
	var n = t ? " !important;" : ";", r = "";
	for (var i of Object.keys(e)) {
		var a = e[i];
		a != null && a !== "" && (r += " " + i + ": " + a + n);
	}
	return r;
}
function hi(e) {
	return e[0] !== "-" || e[1] !== "-" ? e.toLowerCase() : e;
}
function gi(e, t) {
	if (t) {
		var n = "", r, i;
		if (Array.isArray(t) ? (r = t[0], i = t[1]) : r = t, e) {
			e = String(e).replaceAll(/\/\*.*?\*\//g, "").trim();
			var a = !1, o = 0, s = !1, c = [];
			r && c.push(...Object.keys(r).map(hi)), i && c.push(...Object.keys(i).map(hi));
			var l = 0, u = -1;
			let t = e.length;
			for (var d = 0; d < t; d++) {
				var f = e[d];
				if (s ? f === "/" && e[d - 1] === "*" && (s = !1) : a ? a === f && (a = !1) : f === "/" && e[d + 1] === "*" ? s = !0 : f === "\"" || f === "'" ? a = f : f === "(" ? o++ : f === ")" && o--, !s && a === !1 && o === 0) {
					if (f === ":" && u === -1) u = d;
					else if (f === ";" || d === t - 1) {
						if (u !== -1) {
							var p = hi(e.substring(l, u).trim());
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
		return r && (n += mi(r)), i && (n += mi(i, !0)), n = n.trim(), n === "" ? null : n;
	}
	return e == null ? null : String(e);
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/elements/class.js
function _i(e, t, n, r, i, a) {
	var o = e[ie];
	if (j || o !== n || o === void 0) {
		var s = pi(n, r, a);
		(!j || s !== e.getAttribute("class")) && (s == null ? e.removeAttribute("class") : t ? e.className = s : e.setAttribute("class", s)), e[ie] = n;
	} else if (a && i !== a) for (var c in a) {
		var l = !!a[c];
		(i == null || l !== !!i[c]) && e.classList.toggle(c, l);
	}
	return a;
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/elements/style.js
function vi(e, t = {}, n, r) {
	for (var i in n) {
		var a = n[i];
		t[i] !== a && (n[i] == null ? e.style.removeProperty(i) : e.style.setProperty(i, a, r));
	}
}
function yi(e, t, n, r) {
	var i = e[ae];
	if (j || i !== t) {
		var a = gi(t, r);
		(!j || a !== e.getAttribute("style")) && (a == null ? e.removeAttribute("style") : e.style.cssText = a), e[ae] = t;
	} else r && (Array.isArray(r) ? (vi(e, n?.[0], r[0]), vi(e, n?.[1], r[1], "important")) : vi(e, n, r));
	return r;
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/elements/bindings/select.js
function bi(e, t) {
	t ? e.hasAttribute("selected") || e.setAttribute("selected", "") : e.removeAttribute("selected");
}
function xi(t, n) {
	var r = t.__defaultValue, i = t.multiple, a = i ? r ?? [] : null;
	if (!i || e(a)) {
		var o = t.selectedIndex, s = n && i ? new Set(t.selectedOptions) : null;
		for (var c of t.options) {
			var l = Ti(c);
			bi(c, i ? a.includes(l) : nn(l, r));
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
function Si(t, n, r = !1) {
	if (t.multiple) {
		if (n == null) return;
		if (!e(n)) return he();
		for (var i of t.options) i.selected = n.includes(Ti(i));
		return;
	}
	for (i of t.options) if (nn(Ti(i), n)) {
		i.selected = !0;
		return;
	}
	(!r || n !== void 0) && (t.selectedIndex = -1);
}
function Ci(e) {
	var t = new MutationObserver((t) => {
		t.every(Ei) || ("__defaultValue" in e && xi(e, !1), "__value" in e && Si(e, e.__value));
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
function wi(e, t, n = t) {
	var r = /* @__PURE__ */ new WeakSet(), i = !0;
	ft(e, "change", (t) => {
		var i = t ? "[selected]" : ":checked", a;
		if (e.multiple) a = [].map.call(e.querySelectorAll(i), Ti);
		else {
			var o = e.querySelector(i) ?? e.querySelector("option:not([disabled])");
			a = o && Ti(o);
		}
		n(a), e.__value = a, Dt !== null && r.add(Dt);
	}), Dn(() => {
		var a = t();
		if (e === document.activeElement) {
			var o = Dt;
			if (r.has(o)) return;
		}
		if (Si(e, a, i), i && a === void 0) {
			var s = e.querySelector(":checked");
			s !== null && (a = Ti(s), n(a));
		}
		e.__value = a, i = !1;
	});
}
function Ti(e) {
	return "__value" in e ? e.__value : e.value;
}
function Ei(e) {
	if (e.target.closest("selectedcontent") !== null) return !0;
	if (e.type === "childList") {
		var t = [...e.addedNodes, ...e.removedNodes];
		return t.length > 0 && t.every((e) => e.nodeName === "SELECTEDCONTENT");
	}
	return !1;
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/elements/attributes.js
var Di = Symbol("is custom element"), Oi = Symbol("is html"), ki = le ? "link" : "LINK";
function Ai(e) {
	if (j) {
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
		e[se] = n, Ke(n), ut();
	}
}
function Y(e, t, n, r) {
	var i = ji(e);
	j && (i[t] = e.getAttribute(t), t === "src" || t === "srcset" || t === "href" && e.nodeName === ki) || i[t] !== (i[t] = n) && (t === "loading" && (e[ne] = n), n == null ? e.removeAttribute(t) : typeof n != "string" && Ni(e).has(t) ? e[t] = n : e.setAttribute(t, n));
}
function ji(e) {
	return e[re] ??= {
		[Di]: e.nodeName.includes("-"),
		[Oi]: e.namespaceURI === fe
	};
}
var Mi = /* @__PURE__ */ new Map();
function Ni(e) {
	var t = e.getAttribute("is") || e.nodeName, n = Mi.get(t);
	if (n) return n;
	Mi.set(t, n = /* @__PURE__ */ new Set());
	for (var r, i = e, a = Element.prototype; a !== i;) {
		for (var s in r = o(i), r) r[s].set && s !== "innerHTML" && s !== "textContent" && s !== "innerText" && n.add(s);
		i = l(i);
	}
	return n;
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/elements/bindings/input.js
function Pi(e, t, n = t) {
	var r = /* @__PURE__ */ new WeakSet();
	ft(e, "input", async (i) => {
		var a = i ? e.defaultValue : e.value;
		if (a = Fi(e) ? Ii(a) : a, n(a), Dt !== null && r.add(Dt), await gr(), a !== (a = t())) {
			var o = e.selectionStart, s = e.selectionEnd, c = e.value.length;
			if (e.value = a ?? "", s !== null) {
				var l = e.value.length;
				o === s && s === c && l > c ? (e.selectionStart = l, e.selectionEnd = l) : (e.selectionStart = o, e.selectionEnd = Math.min(s, l));
			}
		}
	}), (j && e.defaultValue !== e.value || yr(t) == null && e.value) && (n(Fi(e) ? Ii(e.value) : e.value), Dt !== null && r.add(Dt)), kn(() => {
		var n = t();
		if (e === document.activeElement) {
			var i = Dt;
			if (r.has(i)) return;
		}
		Fi(e) && n === Ii(e.value) || (e.type !== "date" || n || e.value) && n !== e.value && (e.value = n ?? "");
	});
}
function Fi(e) {
	var t = e.type;
	return t === "number" || t === "range";
}
function Ii(e) {
	return e === "" ? null : +e;
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/elements/bindings/this.js
function Li(e, t) {
	return e === t || e?.[k] === t;
}
function Ri(e = He(), t, n, r) {
	var i = Re.r, a = Xn;
	return Dn(() => {
		var o, s;
		return kn(() => {
			o = s, s = r?.() || [], yr(() => {
				Li(n(...s), e) || (t(e, ...s), o && Li(n(...o), e) && t(null, ...o));
			});
		}), () => {
			let r = a;
			for (; r !== i && r.parent !== null && r.parent.f & 33554432;) r = r.parent;
			let o = () => {
				s && Li(n(...s), e) && t(null, ...s);
			}, c = r.teardown;
			r.teardown = () => {
				o(), c?.();
			};
		};
	}), e;
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/elements/bindings/universal.js
function zi(e, t, n, r, i) {
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
		var p = k in e || A in e;
		f = a(e, t)?.set ?? (p && t in e ? (n) => e[t] = n : void 0);
	}
	var m, h = !1;
	o ? [m, h] = ct(() => e[t]) : m = e[t], m === void 0 && r !== void 0 && (m = d(), f && (i && Ne(t), f(m)));
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
function Bi(e) {
	Re === null && Ee("onMount"), Cn(() => {
		let t = yr(e);
		if (typeof t == "function") return t;
	});
}
function Vi(e) {
	Re === null && Ee("onDestroy"), Bi(() => () => yr(e));
}
//#endregion
//#region node_modules/svelte/src/internal/disclose-version.js
typeof window < "u" && ((window.__svelte ??= {}).v ??= /* @__PURE__ */ new Set()).add("5");
//#endregion
//#region src/lib/dom-root.ts
function Hi(e) {
	let t = e?.getRootNode();
	return t instanceof Document || t instanceof ShadowRoot ? t : e?.ownerDocument ?? document;
}
//#endregion
//#region src/lib/state/inspector-sections.ts
function Ui() {
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
function Wi(e, t) {
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
var Gi = "highwater.presentation.v1";
function Ki() {
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
var qi = () => typeof window > "u" ? null : window.localStorage, Ji = (e) => typeof e == "object" && !!e && !Array.isArray(e);
function Yi(e, t = Ki()) {
	let n = {
		version: 1,
		river: { ...t.river },
		economics: { ...t.economics }
	};
	if (!e || e.length > 4096) return n;
	try {
		let t = JSON.parse(e);
		if (!Ji(t) || t.version !== 1) return n;
		Ji(t.river) && ((t.river.verticalScale === "session" || t.river.verticalScale === "visible") && (n.river.verticalScale = t.river.verticalScale), (t.river.display === "items" || t.river.display === "itemTypes") && (n.river.display = t.river.display)), Ji(t.economics) && (typeof t.economics.expanded == "boolean" && (n.economics.expanded = t.economics.expanded), (t.economics.lastMode === "cache" || t.economics.lastMode === "cost") && (n.economics.lastMode = t.economics.lastMode), (t.economics.cacheView === "tokens" || t.economics.cacheView === "share") && (n.economics.cacheView = t.economics.cacheView));
	} catch {}
	return n;
}
function Xi(e = qi, t = Gi, n = Ki()) {
	try {
		return Yi(e()?.getItem(t) ?? null, n);
	} catch {
		return Yi(null, n);
	}
}
function Zi(e, t = qi, n = Gi) {
	try {
		t()?.setItem(n, JSON.stringify(Yi(JSON.stringify(e))));
	} catch {}
}
//#endregion
//#region src/lib/state/interaction.ts
var Qi = {
	hoveredCallIndex: null,
	pinnedCallIndex: null,
	hoveredItemId: null,
	selectedItemId: null
};
function $i() {
	return { ...Qi };
}
function ea(e) {
	return e.selectedItemId === null ? e.pinnedCallIndex === null ? e : {
		...e,
		pinnedCallIndex: null
	} : {
		...e,
		selectedItemId: null
	};
}
function ta(e, t, n) {
	if (e === null) return null;
	let r = t.callByIndex.get(e);
	if (!r || t.analysis.modelCalls.filter((e) => e.sourceRecordId === r.sourceRecordId).length !== 1) return null;
	let i = n.analysis.modelCalls.filter((e) => e.sourceRecordId === r.sourceRecordId);
	return i.length === 1 ? i[0].index : null;
}
function na(e, t, n) {
	return {
		...e,
		pinnedCallIndex: ta(e.pinnedCallIndex, t, n),
		hoveredCallIndex: ta(e.hoveredCallIndex, t, n),
		hoveredItemId: e.hoveredItemId !== null && n.itemById.has(e.hoveredItemId) ? e.hoveredItemId : null,
		selectedItemId: e.selectedItemId !== null && n.itemById.has(e.selectedItemId) ? e.selectedItemId : null
	};
}
//#endregion
//#region src/lib/context-river/viewport.ts
function ra(e, t, n, r) {
	if (!n.ready || e.length === 0) return null;
	if (t === null && n.isFitAll) return r === 1 ? e[0] : null;
	let i = t ?? n.centerCallIndex, a = i == null ? -1 : e.indexOf(i);
	return a < 0 ? null : e[a + r] ?? null;
}
function ia(e, t, n, r) {
	let i = n * .15, a = e - t;
	return aa(a < i ? e - i : a > n - i ? e - n + i : t, r, n);
}
function aa(e, t, n) {
	let r = Number.isFinite(t) ? Math.max(0, t) : 0, i = Number.isFinite(n) ? Math.max(0, n) : 0;
	return Math.min(Math.max(0, Number.isFinite(e) ? e : 0), Math.max(0, r - i));
}
function oa(e, t, n, r = 0) {
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
function sa(e, t) {
	return aa(e, e, t);
}
function ca(e, t, n, r = 0) {
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
function la(e, t, n, r, i = 0) {
	let a = (e.sourceRecordId ? t.find((t) => t.sourceRecordId === e.sourceRecordId) : void 0) ?? t.find((t) => t.callIndex === e.callIndex);
	if (!a || !Number.isFinite(n)) return null;
	let o = e.nextSourceRecordId ? t.find((t) => t.sourceRecordId === e.nextSourceRecordId) : e.nextCallIndex === void 0 ? void 0 : t.find((t) => t.callIndex === e.nextCallIndex), s = Number.isFinite(e.fractionToNext) ? Math.min(1, Math.max(0, e.fractionToNext)) : 0;
	return aa(i + (o && Number.isFinite(o.x) ? a.x + (o.x - a.x) * s : a.x) - e.offsetFromViewportLeft, r, n);
}
function ua(e, t) {
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
function da(e, t) {
	if (!e.ready || e.isFitAll || t.length === 0) return null;
	if (e.firstVisibleCallIndex !== null && e.lastVisibleCallIndex !== null) return [e.firstVisibleCallIndex, e.lastVisibleCallIndex];
	let n = t.indexOf(e.centerCallIndex ?? -1);
	return n < 0 ? null : [t[Math.max(0, n - 1)], t[Math.min(t.length - 1, n + 1)]];
}
//#endregion
//#region src/lib/token-estimate.ts
var fa = {
	"ctok-claude-v3": "Claude 3 to Opus 4.6",
	"ctok-claude-v4.7": "Claude Opus 4.7",
	"ctok-claude-v4.8": "Claude Opus 4.8 and later"
};
function pa(e) {
	let t = e ? fa[e.tokenizerFamily] : void 0;
	return !e || !t ? null : e.rule === "assumed-latest-claude-ctok" ? `Reconstructed tokenizer (ctok) for the newest measured generation, ${t}; this model has not been measured` : `Reconstructed tokenizer (ctok) for ${t}`;
}
var ma = {
	modelTokenizer: "Model tokenizer",
	apiSerializationEstimate: "Estimated API serialization",
	characterHeuristic: "Character heuristic",
	reportedUsage: "From reported usage"
};
function ha(e, t = "Unavailable estimate method") {
	return e && ma[e] || t;
}
//#endregion
//#region src/lib/components/InfoPopover.svelte
var ga = /* @__PURE__ */ W("<span class=\"info svelte-jsd3h9\" role=\"presentation\"><button type=\"button\" class=\"info-trigger svelte-jsd3h9\">i</button> <div role=\"note\"><!></div></span>"), _a = {
	hash: "svelte-jsd3h9",
	code: ".info.svelte-jsd3h9 {display:inline-flex;vertical-align:middle;}.info-trigger.svelte-jsd3h9 {display:inline-grid;place-items:center;width:16px;height:16px;margin-left:5px;padding:0;border:1px solid var(--control-border);border-radius:50%;color:var(--secondary);background:transparent;font:italic 600 10px/1 Georgia,\n      serif;cursor:pointer;}.info-trigger.svelte-jsd3h9:hover,\n  .info-trigger[aria-expanded='true'].svelte-jsd3h9 {color:var(--text);background:var(--surface-raised);}.info-popover.svelte-jsd3h9 {position:fixed;z-index:20;left:0;top:0;box-sizing:border-box;width:min(320px, calc(100vw - 24px));padding:10px 12px;border:1px solid var(--control-border);border-radius:var(--radius);background:var(--surface);color:var(--text);box-shadow:0 10px 28px var(--shadow-strong);font-size:var(--text-sm);font-weight:normal;text-align:left;white-space:normal;}.info-popover[hidden].svelte-jsd3h9 {display:none;}.info-popover.placing.svelte-jsd3h9 {visibility:hidden;}"
};
function va(e, t) {
	Be(t, !0), ui(e, _a);
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
	var p = ga();
	Or("resize", rn, s), Or("scroll", rn, s), Or("pointerdown", rn, f);
	var m = L(p);
	Ri(m, (e) => I(n, e), () => H(n));
	var h = B(m, 2);
	let g;
	li(L(h), () => t.children ?? d), N(h), Ri(h, (e) => I(r, e), () => H(r)), N(p), V(() => {
		Y(m, "aria-label", t.label), Y(m, "aria-expanded", H(a)), Y(m, "aria-controls", t.id), Y(h, "id", t.id), g = _i(h, 1, "info-popover svelte-jsd3h9", null, g, { placing: !H(o) }), Y(h, "hidden", !H(a)), yi(h, H(i));
	}), U("keydown", p, u), U("click", m, () => H(a) ? l(!0) : c()), G(e, p), Ve();
}
kr(["keydown", "click"]);
var ya = {
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
}, ba = Object.values(ya).map((e) => e.id), xa = "highwater.theme.v1";
function Sa(e, t) {
	if (!e || e.length > 256) return "system";
	try {
		let n = JSON.parse(e);
		return typeof n == "string" && (n === "system" || t.includes(n)) ? n : "system";
	} catch {
		return "system";
	}
}
function Ca(e, t) {
	return ya[e === "system" ? t ? "dark" : "light" : e];
}
//#endregion
//#region src/lib/context-river/colors.ts
function wa(e, t) {
	return t.itemTypes[e] ?? t.itemTypes.other;
}
function Ta(e, t, n) {
	return n.items[e.itemColorSlotById.get(t) ?? 0] ?? n.items[0];
}
function Ea(e) {
	return Aa("#11171c", e) >= Aa("#ffffff", e) ? "#11171c" : "#ffffff";
}
function Da(e) {
	let t = 2166136261;
	for (let n of e) t = Math.imul(t ^ (n.codePointAt(0) ?? 0), 16777619);
	return (t >>> 0) % 10;
}
function Oa(e, t, n, r) {
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
		let i = Da(e), a = i;
		for (let e = 0, t = Infinity; e < 10 && t > 0; e += 1) {
			let r = (i + e) % 10, o = n.get(r) ?? 0;
			o < t && ([a, t] = [r, o]);
		}
		c.set(e, a);
	}
	return c;
}
function ka(e) {
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
function Aa(e, t) {
	let n = Math.max(ka(e), ka(t)), r = Math.min(ka(e), ka(t));
	return (n + .05) / (r + .05);
}
//#endregion
//#region src/lib/theme/controller.ts
function ja() {
	let e = tt("system"), t = tt(ya.dark), n = "system", r = null, i = null;
	function a() {
		let a = Ca(n, r?.matches ?? !0);
		e.set(n), t.set(a), i && (i.dataset.theme = a.id);
	}
	function o(e) {
		n = Sa(JSON.stringify(e), ba), a();
		try {
			window.localStorage.setItem(xa, JSON.stringify(n));
		} catch {}
	}
	function s(e) {
		t.set(ya[e]);
	}
	function c() {
		i = document.documentElement;
		let o = i.getAttribute("data-theme"), s = null;
		try {
			s = window.localStorage.getItem(xa);
		} catch {}
		n = Sa(s, ba);
		try {
			r = window.matchMedia("(prefers-color-scheme: dark)");
		} catch {
			r = null;
		}
		let c = () => {
			n === "system" && a();
		};
		return r?.addEventListener("change", c), a(), () => {
			r?.removeEventListener("change", c), o === null ? i?.removeAttribute("data-theme") : i?.setAttribute("data-theme", o), i = null, r = null, n = "system", e.set(n), t.set(ya.dark);
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
var Ma = ja(), Na = Ma.palette, Pa = new Intl.NumberFormat(void 0, {
	notation: "compact",
	maximumFractionDigits: 1
}), Fa = new Intl.NumberFormat(), Ia = new Intl.NumberFormat(void 0, {
	style: "currency",
	currency: "USD",
	currencyDisplay: "narrowSymbol",
	minimumFractionDigits: 2,
	maximumFractionDigits: 4
}), La = new Intl.NumberFormat(void 0, {
	style: "currency",
	currency: "USD",
	currencyDisplay: "narrowSymbol",
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});
function Z(e) {
	return e == null ? "Unknown" : Pa.format(e);
}
function Q(e) {
	return Fa.format(e);
}
var Ra = new Intl.NumberFormat(void 0, {
	style: "currency",
	currency: "USD",
	currencyDisplay: "narrowSymbol",
	maximumSignificantDigits: 2
});
function za(e) {
	return Ra.format(e);
}
function Ba(e) {
	return e == null ? "Unknown" : e > 0 && e < 1e-4 ? `<${Ia.format(1e-4)}` : Ia.format(e);
}
function Va(e) {
	return e == null ? "Unknown" : e > 0 && e < .01 ? `<${La.format(.01)}` : La.format(e);
}
function Ha(e) {
	return e == null ? "Unknown" : `${(e * 100).toFixed(+(e < .1))}%`;
}
function Ua(e) {
	return `${(e * 100).toFixed(1)}%`;
}
function Wa(e, t) {
	let n = t === "calculatedTokens" ? "calculated tokens" : t === "estimatedTokens" ? "estimated tokens" : t === "serializedBytes" ? "serialized bytes" : t === "unavailable" ? "unknown weight" : t;
	return `${Pa.format(e)} ${n}`;
}
function Ga(e) {
	return e === "calculatedTokens" ? "calculated tokens" : e === "estimatedTokens" ? "estimated tokens" : e === "unavailable" ? "token geometry unavailable" : e;
}
function Ka(e, t) {
	return e === null ? "Unknown" : t === "serializedBytes" || t === "bytes" ? `${Pa.format(e)} byte-calls` : `${Pa.format(e)} token-turns`;
}
function qa(e, t) {
	return `${Fa.format(e)} / ${Fa.format(t)}`;
}
//#endregion
//#region src/lib/components/CopyButton.svelte
var Ja = /* @__PURE__ */ W("<span class=\"copy-control svelte-1kw4msz\"><button type=\"button\" class=\"svelte-1kw4msz\">Copy</button> <span class=\"copy-status svelte-1kw4msz\" role=\"status\"> </span></span>"), Ya = {
	hash: "svelte-1kw4msz",
	code: ".copy-control.svelte-1kw4msz {display:inline-flex;flex-wrap:wrap;align-items:center;gap:5px 8px;min-width:0;}button.svelte-1kw4msz {background:var(--surface);border:1px solid var(--separator);border-radius:var(--control-radius);color:var(--text);cursor:pointer;padding:3px 7px;font:inherit;font-size:var(--text-xs);}.copy-status.svelte-1kw4msz {color:var(--secondary);font-size:var(--text-xs);}"
};
function Xa(e, t) {
	Be(t, !0), ui(e, Ya);
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
	var i = Ja(), a = L(i), o = z(B(a, 2), !0);
	N(i), V(() => {
		Y(a, "aria-label", `Copy ${t.label}`), K(o, H(n));
	}), U("click", a, r), G(e, i), Ve();
}
kr(["click"]);
//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/count.js
function Za(e) {
	var t = 0, n = e.children, r = n && n.length;
	if (!r) t = 1;
	else for (; --r >= 0;) t += n[r].value;
	e.value = t;
}
function Qa() {
	return this.eachAfter(Za);
}
//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/each.js
function $a(e, t) {
	let n = -1;
	for (let r of this) e.call(t, r, ++n, this);
	return this;
}
//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/eachBefore.js
function eo(e, t) {
	for (var n = this, r = [n], i, a, o = -1; n = r.pop();) if (e.call(t, n, ++o, this), i = n.children) for (a = i.length - 1; a >= 0; --a) r.push(i[a]);
	return this;
}
//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/eachAfter.js
function to(e, t) {
	for (var n = this, r = [n], i = [], a, o, s, c = -1; n = r.pop();) if (i.push(n), a = n.children) for (o = 0, s = a.length; o < s; ++o) r.push(a[o]);
	for (; n = i.pop();) e.call(t, n, ++c, this);
	return this;
}
//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/find.js
function no(e, t) {
	let n = -1;
	for (let r of this) if (e.call(t, r, ++n, this)) return r;
}
//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/sum.js
function ro(e) {
	return this.eachAfter(function(t) {
		for (var n = +e(t.data) || 0, r = t.children, i = r && r.length; --i >= 0;) n += r[i].value;
		t.value = n;
	});
}
//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/sort.js
function io(e) {
	return this.eachBefore(function(t) {
		t.children && t.children.sort(e);
	});
}
//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/path.js
function ao(e) {
	for (var t = this, n = oo(t, e), r = [t]; t !== n;) t = t.parent, r.push(t);
	for (var i = r.length; e !== n;) r.splice(i, 0, e), e = e.parent;
	return r;
}
function oo(e, t) {
	if (e === t) return e;
	var n = e.ancestors(), r = t.ancestors(), i = null;
	for (e = n.pop(), t = r.pop(); e === t;) i = e, e = n.pop(), t = r.pop();
	return i;
}
//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/ancestors.js
function so() {
	for (var e = this, t = [e]; e = e.parent;) t.push(e);
	return t;
}
//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/descendants.js
function co() {
	return Array.from(this);
}
//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/leaves.js
function lo() {
	var e = [];
	return this.eachBefore(function(t) {
		t.children || e.push(t);
	}), e;
}
//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/links.js
function uo() {
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
function* fo() {
	var e = this, t, n = [e], r, i, a;
	do
		for (t = n.reverse(), n = []; e = t.pop();) if (yield e, r = e.children) for (i = 0, a = r.length; i < a; ++i) n.push(r[i]);
	while (n.length);
}
//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/index.js
function po(e, t) {
	e instanceof Map ? (e = [void 0, e], t === void 0 && (t = go)) : t === void 0 && (t = ho);
	for (var n = new yo(e), r, i = [n], a, o, s, c; r = i.pop();) if ((o = t(r.data)) && (c = (o = Array.from(o)).length)) for (r.children = o, s = c - 1; s >= 0; --s) i.push(a = o[s] = new yo(o[s])), a.parent = r, a.depth = r.depth + 1;
	return n.eachBefore(vo);
}
function mo() {
	return po(this).eachBefore(_o);
}
function ho(e) {
	return e.children;
}
function go(e) {
	return Array.isArray(e) ? e[1] : null;
}
function _o(e) {
	e.data.value !== void 0 && (e.value = e.data.value), e.data = e.data.data;
}
function vo(e) {
	var t = 0;
	do
		e.height = t;
	while ((e = e.parent) && e.height < ++t);
}
function yo(e) {
	this.data = e, this.depth = this.height = 0, this.parent = null;
}
yo.prototype = po.prototype = {
	constructor: yo,
	count: Qa,
	each: $a,
	eachAfter: to,
	eachBefore: eo,
	find: no,
	sum: ro,
	sort: io,
	path: ao,
	ancestors: so,
	descendants: co,
	leaves: lo,
	links: uo,
	copy: mo,
	[Symbol.iterator]: fo
};
//#endregion
//#region node_modules/d3-hierarchy/src/accessors.js
function bo(e) {
	if (typeof e != "function") throw Error();
	return e;
}
//#endregion
//#region node_modules/d3-hierarchy/src/constant.js
function xo() {
	return 0;
}
function So(e) {
	return function() {
		return e;
	};
}
//#endregion
//#region node_modules/d3-hierarchy/src/treemap/round.js
function Co(e) {
	e.x0 = Math.round(e.x0), e.y0 = Math.round(e.y0), e.x1 = Math.round(e.x1), e.y1 = Math.round(e.y1);
}
//#endregion
//#region node_modules/d3-hierarchy/src/treemap/dice.js
function wo(e, t, n, r, i) {
	for (var a = e.children, o, s = -1, c = a.length, l = e.value && (r - t) / e.value; ++s < c;) o = a[s], o.y0 = n, o.y1 = i, o.x0 = t, o.x1 = t += o.value * l;
}
//#endregion
//#region node_modules/d3-hierarchy/src/treemap/slice.js
function To(e, t, n, r, i) {
	for (var a = e.children, o, s = -1, c = a.length, l = e.value && (i - n) / e.value; ++s < c;) o = a[s], o.x0 = t, o.x1 = r, o.y0 = n, o.y1 = n += o.value * l;
}
//#endregion
//#region node_modules/d3-hierarchy/src/treemap/squarify.js
var Eo = (1 + Math.sqrt(5)) / 2;
function Do(e, t, n, r, i, a) {
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
		}), c.dice ? wo(c, n, r, i, h ? r += m * g / h : a) : To(c, n, r, h ? n += p * g / h : i, a), h -= g, u = d;
	}
	return o;
}
var Oo = (function e(t) {
	function n(e, n, r, i, a) {
		Do(t, e, n, r, i, a);
	}
	return n.ratio = function(t) {
		return e((t = +t) > 1 ? t : 1);
	}, n;
})(Eo);
//#endregion
//#region node_modules/d3-hierarchy/src/treemap/index.js
function ko() {
	var e = Oo, t = !1, n = 1, r = 1, i = [0], a = xo, o = xo, s = xo, c = xo, l = xo;
	function u(e) {
		return e.x0 = e.y0 = 0, e.x1 = n, e.y1 = r, e.eachBefore(d), i = [0], t && e.eachBefore(Co), e;
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
		return arguments.length ? (e = bo(t), u) : e;
	}, u.padding = function(e) {
		return arguments.length ? u.paddingInner(e).paddingOuter(e) : u.paddingInner();
	}, u.paddingInner = function(e) {
		return arguments.length ? (a = typeof e == "function" ? e : So(+e), u) : a;
	}, u.paddingOuter = function(e) {
		return arguments.length ? u.paddingTop(e).paddingRight(e).paddingBottom(e).paddingLeft(e) : u.paddingTop();
	}, u.paddingTop = function(e) {
		return arguments.length ? (o = typeof e == "function" ? e : So(+e), u) : o;
	}, u.paddingRight = function(e) {
		return arguments.length ? (s = typeof e == "function" ? e : So(+e), u) : s;
	}, u.paddingBottom = function(e) {
		return arguments.length ? (c = typeof e == "function" ? e : So(+e), u) : c;
	}, u.paddingLeft = function(e) {
		return arguments.length ? (l = typeof e == "function" ? e : So(+e), u) : l;
	}, u;
}
//#endregion
//#region src/lib/kind-labels.ts
var Ao = {
	system: "System",
	toolDefinition: "Tool definition",
	userMessage: "User message",
	assistantMessage: "Assistant message",
	toolResult: "Tool result",
	compactionSummary: "Compaction summary",
	customMessage: "Agent-added context",
	branchSummary: "Branch summary",
	thinking: "Thinking",
	unrecordedContext: "Unrecorded request context",
	other: "Other"
}, jo = {
	system: "System",
	toolDefinition: "Tool definitions",
	userMessage: "User messages",
	assistantMessage: "Assistant messages",
	toolResult: "Tool results",
	compactionSummary: "Compaction summaries",
	customMessage: Ao.customMessage,
	branchSummary: "Branch summaries",
	thinking: "Thinking",
	unrecordedContext: "Unrecorded request context",
	other: "Other context"
};
function Mo(e) {
	return Ao[e];
}
function No(e) {
	return jo[e];
}
//#endregion
//#region src/lib/item-label.ts
var Po = {
	system: "System context",
	toolDefinition: "Tool definition",
	userMessage: "User message",
	assistantMessage: "Assistant message",
	toolResult: "Tool result",
	compactionSummary: "Compaction summary",
	customMessage: Mo("customMessage"),
	branchSummary: "Branch summary",
	thinking: "Thinking",
	unrecordedContext: "Unrecorded request context",
	other: "Context item"
};
function Fo(e, t = "Unlabelled context item") {
	let n = e?.label;
	if (e?.kind === "customMessage" && n === "Custom context message") return Po.customMessage;
	if (n && n.trim().length > 0) return n;
	let r = e?.preview?.text;
	if (r && r.trim().length > 0) return r;
	if (e) {
		let n = e.kind.trim();
		return (Po[n] ?? n.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^\w/, (e) => e.toUpperCase())) || t;
	}
	return t;
}
function Io(e) {
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
function Lo(e) {
	let t = e.map((e) => {
		let t = Fo(e);
		return {
			id: e.id,
			fullLabel: t,
			source: Io(t)
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
//#region src/lib/diagnostics.ts
var Ro = {
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
function zo(e) {
	return Ro[e] ?? null;
}
//#endregion
//#region src/lib/composition.ts
var Bo = [
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
], Vo = (e, t) => ({
	width: e,
	height: t,
	rectangles: [],
	groups: []
});
function Ho(e) {
	return typeof e == "number" && Number.isSafeInteger(e) && e >= 0 ? e : null;
}
function Uo(e) {
	return zo(e) ?? {
		title: "Additional estimate limitation",
		impact: "Select this item to inspect additional diagnostics."
	};
}
function Wo(e, t) {
	return e < t ? -1 : +(e > t);
}
function Go(e, t) {
	return e.tokens === null ? t.tokens === null ? 0 : 1 : t.tokens === null ? -1 : t.tokens - e.tokens;
}
function Ko(e) {
	return [...e].sort((e, t) => Go(e, t) || e.sourceOrder - t.sourceOrder || Wo(e.id, t.id));
}
function qo(e) {
	return Bo.flatMap((t) => {
		let n = Ko(e.filter((e) => e.kind === t));
		return n.length === 0 ? [] : [{
			kind: t,
			label: No(t),
			items: n
		}];
	});
}
function Jo(e, t) {
	return e === null || e > t ? null : t - e;
}
function Yo({ item: e, sourceOrder: t, tokens: n, ageAtCall: r, estimateMethods: i, estimateCoverage: a, explanations: o, knownContributionCount: s, missingContributionCount: c, partialEstimateContributionCount: l, unavailableCoverageContributionCount: u, scopePresenceCount: d, overflowed: f }) {
	return {
		id: e.id,
		kind: e.kind,
		kindLabel: Mo(e.kind),
		label: Fo(e),
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
function Xo(e, t) {
	if (!(t === null || t <= 0)) for (let n of e) n.tokens !== null && (n.share = n.tokens / t);
}
function Zo(e) {
	let t = qo(e.items), n = e.items.filter((e) => e.tokens !== null).length, r = e.items.length - n, i = e.items.reduce((e, t) => e + t.missingContributionCount, 0), a = e.items.reduce((e, t) => e + t.partialEstimateContributionCount, 0), o = e.items.reduce((e, t) => e + t.unavailableCoverageContributionCount, 0), s = e.totalOverflow || e.numericItemCallCount === 0 ? null : e.measuredTokenTotal, c = s !== null && s > 0, l = n > 0 && s === 0;
	return Xo(e.items, s), {
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
function Qo(e, t) {
	let n = e.callByIndex.get(t);
	if (!n) return null;
	let r = e.analysis.modelCalls, i = r.findIndex((e) => e.index === t), a = new Map(r.map((e, t) => [e.index, t])), o = /* @__PURE__ */ new Set(), s = 0, c = !1, l = 0, u = [];
	return n.contextItemIds.forEach((t, r) => {
		if (o.has(t)) return;
		o.add(t);
		let d = e.itemById.get(t);
		if (!d) return;
		let f = n.tokenizationProfileId ? e.itemEstimateByProfile.get(t)?.get(n.tokenizationProfileId) ?? null : null, p = Ho(f?.tokens), m = p === null ? 0 : 1, h = +(p === null), g = +(f?.coverage === "partial"), _ = +(f?.coverage === "unavailable");
		p !== null && (l += 1, s > 2 ** 53 - 1 - p ? c = !0 : s += p);
		let v = a.get(d.firstModelCall) ?? null, y = f ? [f.method] : [], b = p === null ? "unavailable" : f?.coverage ?? "unavailable";
		u.push(Yo({
			item: d,
			sourceOrder: r,
			tokens: p,
			ageAtCall: Jo(v, i),
			estimateMethods: y,
			estimateCoverage: b,
			explanations: (f?.noteCodes ?? []).map(Uo),
			knownContributionCount: m,
			missingContributionCount: h,
			partialEstimateContributionCount: g,
			unavailableCoverageContributionCount: _,
			scopePresenceCount: 1,
			overflowed: !1
		}));
	}), {
		...Zo({
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
function $o(e, t = null) {
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
			let m = Ho(p?.tokens);
			if (p?.coverage === "partial" && (f.partialEstimateContributionCount += 1), p?.coverage === "unavailable" && (f.unavailableCoverageContributionCount += 1), m === null || !p) {
				f.missingContributionCount += 1;
				continue;
			}
			u += 1, f.knownContributionCount += 1, f.totalTokens > 2 ** 53 - 1 - m ? f.overflowed = !0 : f.overflowed || (f.totalTokens += m), c > 2 ** 53 - 1 - m ? l = !0 : l || (c += m);
		}
	}
	let f = [...o.values()].sort((e, t) => e.sourceOrder - t.sourceOrder || Wo(e.item.id, t.item.id)).map((e) => {
		let t = e.overflowed, n = e.knownContributionCount === 0 || t ? null : e.totalTokens, i = e.knownContributionCount === 0 ? "unavailable" : e.missingContributionCount > 0 || e.partialEstimateContributionCount > 0 || e.unavailableCoverageContributionCount > 0 ? "partial" : "complete";
		return Yo({
			item: e.item,
			sourceOrder: e.sourceOrder,
			tokens: n,
			ageAtCall: Jo(e.firstPresencePosition, r),
			estimateMethods: [...e.methods].sort(),
			estimateCoverage: i,
			explanations: [...e.explanationCodes].sort().map(Uo),
			knownContributionCount: e.knownContributionCount,
			missingContributionCount: e.missingContributionCount,
			partialEstimateContributionCount: e.partialEstimateContributionCount,
			unavailableCoverageContributionCount: e.unavailableCoverageContributionCount,
			scopePresenceCount: e.scopePresenceCount,
			overflowed: t
		});
	}), p = [...s].sort();
	return {
		...Zo({
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
function es() {
	let e = null, t = /* @__PURE__ */ new Map();
	return {
		get retainedEntryCount() {
			return t.size;
		},
		get(n, r, i) {
			e !== n && (t.clear(), e = n);
			let a = t.get(r);
			if (a?.endpoint === i) return a.projection;
			let o = r === "atCall" ? i === null ? null : Qo(n, i) : $o(n, i);
			return t.set(r, {
				endpoint: i,
				projection: o
			}), o;
		}
	};
}
function ts(e, t, n = 10) {
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
function ns(e, t, n) {
	if (!Number.isFinite(t) || !Number.isFinite(n) || t <= 0 || n <= 0 || !e.hasPositiveWeights || e.totalOverflow) return Vo(Number.isFinite(t) && t > 0 ? t : 0, Number.isFinite(n) && n > 0 ? n : 0);
	let r = po({
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
	}).sum((e) => e.item?.tokens ?? 0), i = ko().size([t, n]).tile(Oo).paddingInner(2).paddingTop((e) => e.depth === 1 ? 15 : 0).round(!1)(r), a = new Map(Ko(e.items).map((e, t) => [e.id, t])), o = [], s = [];
	return i.each((e) => {
		let t = e.x1 - e.x0, n = e.y1 - e.y0;
		e.depth === 1 && e.data.kind && t > 0 && n > 0 && s.push({
			kind: e.data.kind,
			label: e.data.label,
			x: e.x0,
			y: e.y0,
			width: t,
			height: n,
			labelText: t >= 58 && n >= 17 ? ts(e.data.label, t, 9) : ""
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
			labelText: c ? ts(r.label, t, 10) : "",
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
var rs = /* @__PURE__ */ W("<div class=\"presentation-controls svelte-8fl9lq\" role=\"group\" aria-label=\"Composition presentation\"><button type=\"button\" class=\"svelte-8fl9lq\">Treemap</button> <button type=\"button\" class=\"svelte-8fl9lq\">List</button></div>"), is = /* @__PURE__ */ W("<div class=\"composition-controls svelte-8fl9lq\"><div class=\"scope-controls svelte-8fl9lq\" role=\"group\" aria-label=\"Composition scope\"><button type=\"button\" class=\"svelte-8fl9lq\">At call</button> <button type=\"button\" class=\"svelte-8fl9lq\">Cumulative</button></div> <!></div>"), as = /* @__PURE__ */ W("<div class=\"empty-state svelte-8fl9lq\"><h3 class=\"svelte-8fl9lq\">No model-call usage</h3> <p class=\"svelte-8fl9lq\">This session has no model calls. Terminal items remain available in Context lifespans.</p></div>"), os = /* @__PURE__ */ W("<div class=\"empty-state svelte-8fl9lq\"><p class=\"svelte-8fl9lq\">Pin a call to inspect its item estimates.</p> <button type=\"button\">Inspect latest call</button></div>"), ss = /* @__PURE__ */ W("<div class=\"empty-state svelte-8fl9lq\"><p class=\"svelte-8fl9lq\">Preparing composition…</p></div>"), cs = /* @__PURE__ */ W("<p class=\"endpoint-status svelte-8fl9lq\" role=\"status\"> </p>"), ls = /* @__PURE__ */ W("<button type=\"button\">Whole session</button>"), us = /* @__PURE__ */ W("<div class=\"endpoint-actions svelte-8fl9lq\"><div class=\"call-stepper svelte-8fl9lq\" role=\"group\" aria-label=\"Inspect adjacent calls\"><button type=\"button\" aria-label=\"Inspect previous call\">Previous call</button> <button type=\"button\" aria-label=\"Inspect next call\">Next call</button></div> <!></div>"), ds = /* @__PURE__ */ W("<p class=\"coverage-headline svelte-8fl9lq\"> </p>"), fs = /* @__PURE__ */ W("<span> </span>"), ps = /* @__PURE__ */ W("<li> <code class=\"svelte-8fl9lq\"> </code> <!></li>"), ms = /* @__PURE__ */ W("<ul class=\"svelte-8fl9lq\"></ul>"), hs = /* @__PURE__ */ W("<p class=\"svelte-8fl9lq\"><code class=\"svelte-8fl9lq\"> </code> <!></p>"), gs = /* @__PURE__ */ W("<p class=\"coverage-status svelte-8fl9lq\" role=\"status\"> </p>"), _s = /* @__PURE__ */ W("<p class=\"coverage-status svelte-8fl9lq\">All numeric item estimates are zero; no equal-area rectangles are substituted.</p>"), vs = /* @__PURE__ */ W("<p class=\"coverage-status svelte-8fl9lq\">No numeric item estimates are available in this scope; showing the complete List.</p>"), ys = /* @__PURE__ */ W("<p class=\"omission-note svelte-8fl9lq\" role=\"status\"> <button type=\"button\" class=\"svelte-8fl9lq\">View all in List</button></p>"), bs = /* @__PURE__ */ Rr("<clipPath><rect></rect></clipPath>"), xs = /* @__PURE__ */ Rr("<text class=\"svelte-8fl9lq\"> </text>"), Ss = /* @__PURE__ */ Rr("<g class=\"kind-group svelte-8fl9lq\"><title> </title><rect class=\"svelte-8fl9lq\"></rect><!></g>"), Cs = /* @__PURE__ */ Rr("<text class=\"tile-value svelte-8fl9lq\"> </text>"), ws = /* @__PURE__ */ Rr("<g aria-hidden=\"true\"><text class=\"svelte-8fl9lq\"> </text><!></g>"), Ts = /* @__PURE__ */ Rr("<g role=\"option\" tabindex=\"-1\"><title> </title><rect fill-opacity=\"1\"></rect><!></g>"), Es = /* @__PURE__ */ W("<!> <div class=\"treemap-frame svelte-8fl9lq\"><svg class=\"composition-treemap svelte-8fl9lq\" role=\"listbox\" tabindex=\"0\"><defs><!><!></defs><!><!></svg></div>", 1), Ds = /* @__PURE__ */ W("<small class=\"svelte-8fl9lq\"> </small>"), Os = /* @__PURE__ */ W("<div role=\"option\" tabindex=\"-1\"><span class=\"kind-mark svelte-8fl9lq\" aria-hidden=\"true\"></span> <span class=\"row-label svelte-8fl9lq\"><b class=\"svelte-8fl9lq\"> </b> <small class=\"svelte-8fl9lq\"> </small> <!> <!> <!></span> <span class=\"row-measures svelte-8fl9lq\"><b class=\"svelte-8fl9lq\"> </b> <small class=\"svelte-8fl9lq\"> </small> <small class=\"svelte-8fl9lq\"> </small></span></div>"), ks = /* @__PURE__ */ W("<div class=\"composition-list svelte-8fl9lq\" role=\"listbox\" tabindex=\"0\"></div>"), As = /* @__PURE__ */ W("<span class=\"svelte-8fl9lq\"> </span> <!>", 1), js = /* @__PURE__ */ W("<span class=\"svelte-8fl9lq\"> </span>"), Ms = /* @__PURE__ */ W("<button type=\"button\" class=\"svelte-8fl9lq\">Reveal in River</button>"), Ns = /* @__PURE__ */ W("<section class=\"selected-composition-item svelte-8fl9lq\" aria-label=\"Selected item in Composition\"><div class=\"selected-summary-copy svelte-8fl9lq\"><strong class=\"svelte-8fl9lq\"> </strong> <!></div> <div class=\"selected-item-actions svelte-8fl9lq\"><button type=\"button\" class=\"svelte-8fl9lq\">View details</button> <button type=\"button\" class=\"svelte-8fl9lq\">Find in lifespans</button> <!></div></section>"), Ps = /* @__PURE__ */ W("<details class=\"reconciliation svelte-8fl9lq\"><summary class=\"svelte-8fl9lq\">Compare with provider usage</summary> <p class=\"svelte-8fl9lq\">Comparison is informational; it does not validate request overhead or change composition\n          areas.</p> <dl class=\"svelte-8fl9lq\"><div><dt class=\"svelte-8fl9lq\">Provider prompt</dt> <dd class=\"svelte-8fl9lq\"> </dd></div> <div><dt class=\"svelte-8fl9lq\">Calculated visible context</dt> <dd class=\"svelte-8fl9lq\"> </dd></div> <div><dt class=\"svelte-8fl9lq\">Known request framing</dt> <dd class=\"svelte-8fl9lq\"> </dd></div> <div><dt class=\"svelte-8fl9lq\">Difference</dt> <dd class=\"svelte-8fl9lq\"> </dd></div></dl></details>"), Fs = /* @__PURE__ */ W("<!> <header class=\"composition-header svelte-8fl9lq\"><div class=\"scope-title svelte-8fl9lq\"><h3 class=\"svelte-8fl9lq\"> </h3> <p class=\"svelte-8fl9lq\"> </p></div> <!></header> <!> <div class=\"composition-totals svelte-8fl9lq\" aria-label=\"Composition totals and coverage\"><strong class=\"svelte-8fl9lq\"> <!></strong> <span> <!></span> <!></div> <details class=\"coverage-details svelte-8fl9lq\"><summary class=\"svelte-8fl9lq\">Diagnostics</summary> <p class=\"svelte-8fl9lq\"> </p> <!> <p class=\"svelte-8fl9lq\"> </p></details> <!> <!> <details class=\"composition-help svelte-8fl9lq\"><summary class=\"svelte-8fl9lq\">Composition help</summary> <div class=\"help-content svelte-8fl9lq\"><p class=\"svelte-8fl9lq\"><!></p> <p class=\"svelte-8fl9lq\">Areas are approximate because kind-group gutters reduce their space. Zero and unavailable\n          values are never enlarged. Item colors are stable identity cues shared with River, not\n          cache or cost states; labels, group boundaries, and selection also carry meaning.</p> <p class=\"svelte-8fl9lq\">Select a tile or use List to inspect an item; use River zoom/select to investigate its\n          call placement, and search or filter lifespans to compare persistence.</p></div></details> <!> <!> <!>", 1), Is = /* @__PURE__ */ W("<section class=\"composition svelte-8fl9lq\" aria-label=\"Context composition\"><!> <!></section>"), Ls = {
	hash: "svelte-8fl9lq",
	code: ".composition.svelte-8fl9lq {min-width:0;}.composition-controls.svelte-8fl9lq,\n  .scope-controls.svelte-8fl9lq,\n  .presentation-controls.svelte-8fl9lq,\n  .composition-header.svelte-8fl9lq,\n  .endpoint-actions.svelte-8fl9lq,\n  .call-stepper.svelte-8fl9lq {display:flex;flex-wrap:wrap;align-items:center;gap:8px;}.composition-controls.svelte-8fl9lq {justify-content:space-between;gap:8px 16px;margin-bottom:10px;}.scope-controls.svelte-8fl9lq button[aria-pressed='true']:where(.svelte-8fl9lq),\n  .presentation-controls.svelte-8fl9lq button[aria-pressed='true']:where(.svelte-8fl9lq) {border-color:var(--accent);background:var(--action);color:var(--active-text);}.composition-header.svelte-8fl9lq {justify-content:space-between;margin:8px 0;}.endpoint-status.svelte-8fl9lq {margin:6px 0;color:var(--warning);font-size:var(--text-sm);}.scope-title.svelte-8fl9lq {min-width:0;}h3.svelte-8fl9lq {margin:0;color:var(--text-strong);font-size:var(--text-lg);}.composition-header.svelte-8fl9lq p:where(.svelte-8fl9lq),\n  .empty-state.svelte-8fl9lq p:where(.svelte-8fl9lq) {margin:3px 0 0;color:var(--secondary);font-size:var(--text-sm);overflow-wrap:anywhere;}.endpoint-actions.svelte-8fl9lq {justify-content:flex-end;}.composition-totals.svelte-8fl9lq {display:flex;flex-wrap:wrap;gap:5px 14px;color:var(--text);font-size:var(--text-sm);font-variant-numeric:tabular-nums;}.composition-totals.svelte-8fl9lq strong:where(.svelte-8fl9lq) {color:var(--text-strong);}.coverage-headline.svelte-8fl9lq,\n  .coverage-status.svelte-8fl9lq,\n  .omission-note.svelte-8fl9lq {margin:6px 0;color:var(--warning);font-size:var(--text-sm);}.coverage-headline.svelte-8fl9lq {color:var(--text-strong);font-weight:650;}.coverage-details.svelte-8fl9lq {margin:6px 0;color:var(--secondary);font-size:var(--text-sm);}.coverage-details.svelte-8fl9lq p:where(.svelte-8fl9lq) {max-width:75ch;margin:5px 0;}.omission-note.svelte-8fl9lq button:where(.svelte-8fl9lq) {margin-left:7px;padding:3px 7px;font-size:var(--text-xs);}.composition-help.svelte-8fl9lq,\n  .reconciliation.svelte-8fl9lq {margin:8px 0;color:var(--secondary);font-size:var(--text-sm);}summary.svelte-8fl9lq {width:fit-content;color:var(--text);cursor:pointer;}.help-content.svelte-8fl9lq {max-width:75ch;padding:4px 0 0 12px;}.help-content.svelte-8fl9lq p:where(.svelte-8fl9lq),\n  .reconciliation.svelte-8fl9lq p:where(.svelte-8fl9lq),\n  .coverage-details.svelte-8fl9lq ul:where(.svelte-8fl9lq) {display:grid;gap:5px;padding-left:20px;overflow-wrap:anywhere;}.coverage-details.svelte-8fl9lq code:where(.svelte-8fl9lq) {overflow-wrap:anywhere;}.reconciliation.svelte-8fl9lq dl:where(.svelte-8fl9lq) {display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:6px 12px;margin:7px 0 0;}dt.svelte-8fl9lq {color:var(--muted);font-size:10px;}dd.svelte-8fl9lq {margin:2px 0 0;color:var(--text);font-size:var(--text-sm);font-variant-numeric:tabular-nums;overflow-wrap:anywhere;}.treemap-frame.svelte-8fl9lq {width:100%;overflow:auto;border:1px solid var(--separator);border-radius:var(--radius);background:var(--plot);}.composition-treemap.svelte-8fl9lq {display:block;max-width:100%;background:var(--plot);}.kind-group.svelte-8fl9lq rect:where(.svelte-8fl9lq) {fill:none;stroke:var(--text);stroke-opacity:0.52;stroke-width:1;pointer-events:none;}.kind-group.svelte-8fl9lq text:where(.svelte-8fl9lq) {fill:var(--text-strong);font-size:9px;font-weight:600;pointer-events:none;}.composition-treemap.svelte-8fl9lq g[role='option']:where(.svelte-8fl9lq) {cursor:pointer;}.composition-treemap.svelte-8fl9lq g[role='option']:where(.svelte-8fl9lq) rect:where(.svelte-8fl9lq) {stroke:var(--plot);stroke-width:1;}.composition-treemap.svelte-8fl9lq:focus g[role='option'].active:where(.svelte-8fl9lq) rect:where(.svelte-8fl9lq) {stroke:var(--accent);stroke-width:2;}.composition-treemap.svelte-8fl9lq g[role='option'].selected:where(.svelte-8fl9lq) rect:where(.svelte-8fl9lq) {stroke:var(--selection);stroke-width:2;}.composition-treemap.svelte-8fl9lq g[role='option']:where(.svelte-8fl9lq) rect.partial:where(.svelte-8fl9lq) {stroke:var(--warning);stroke-dasharray:3 2;}.composition-treemap.svelte-8fl9lq g[role='option']:where(.svelte-8fl9lq) text:where(.svelte-8fl9lq) {fill:var(--text);font-size:10px;pointer-events:none;}.composition-treemap.svelte-8fl9lq g[role='option']:where(.svelte-8fl9lq) text.tile-value:where(.svelte-8fl9lq) {fill:var(--text);font-size:9px;}.composition-list.svelte-8fl9lq {display:grid;gap:3px;max-height:390px;overflow:auto;padding:3px;border:1px solid var(--separator);border-radius:var(--radius);background:var(--plot);overscroll-behavior:contain;}.composition-row.svelte-8fl9lq {display:grid;grid-template-columns:10px minmax(0, 1fr) minmax(130px, 0.55fr);align-items:center;gap:8px;min-width:0;padding:7px;border:1px solid transparent;border-radius:var(--control-radius);cursor:pointer;}.composition-list.svelte-8fl9lq:focus .composition-row.active:where(.svelte-8fl9lq) {border-color:var(--accent);background:var(--surface-raised);}.composition-row.selected.svelte-8fl9lq {border-color:var(--selection);background:var(--action);}.composition-row.unavailable.svelte-8fl9lq {color:var(--secondary);}.kind-mark.svelte-8fl9lq {width:9px;height:9px;border-radius:var(--radius-small);}.row-label.svelte-8fl9lq,\n  .row-measures.svelte-8fl9lq {display:grid;min-width:0;gap:2px;}.row-label.svelte-8fl9lq b:where(.svelte-8fl9lq) {overflow-wrap:anywhere;color:var(--text-strong);font-size:var(--text-sm);}.row-label.svelte-8fl9lq small:where(.svelte-8fl9lq),\n  .row-measures.svelte-8fl9lq small:where(.svelte-8fl9lq) {color:var(--secondary);font-size:10px;overflow-wrap:anywhere;}.row-measures.svelte-8fl9lq {text-align:right;font-variant-numeric:tabular-nums;}.row-measures.svelte-8fl9lq b:where(.svelte-8fl9lq) {color:var(--text-strong);font-size:var(--text-sm);}.selected-composition-item.svelte-8fl9lq {display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 14px;min-height:46px;margin-top:9px;padding:var(--control-padding);border:1px solid var(--separator);border-radius:var(--control-radius);background:var(--plot);}.selected-summary-copy.svelte-8fl9lq {display:grid;min-width:0;gap:2px;}.selected-summary-copy.svelte-8fl9lq strong:where(.svelte-8fl9lq),\n  .selected-summary-copy.svelte-8fl9lq span:where(.svelte-8fl9lq),\n  .selected-summary-copy.svelte-8fl9lq small:where(.svelte-8fl9lq) {overflow-wrap:anywhere;}.selected-summary-copy.svelte-8fl9lq strong:where(.svelte-8fl9lq) {color:var(--text-strong);font-size:var(--text-sm);}.selected-summary-copy.svelte-8fl9lq span:where(.svelte-8fl9lq),\n  .selected-summary-copy.svelte-8fl9lq small:where(.svelte-8fl9lq) {color:var(--secondary);font-size:var(--text-xs);}.selected-item-actions.svelte-8fl9lq {display:flex;flex-wrap:wrap;gap:6px;}.selected-item-actions.svelte-8fl9lq button:where(.svelte-8fl9lq) {padding:5px 7px;font-size:var(--text-xs);}.empty-state.svelte-8fl9lq {padding:12px;border:1px solid var(--separator);border-radius:var(--radius);background:var(--plot);}\n  @container highwater (max-width: 650px) {.reconciliation.svelte-8fl9lq dl:where(.svelte-8fl9lq) {grid-template-columns:repeat(2, minmax(0, 1fr));}.composition-header.svelte-8fl9lq {align-items:flex-start;}\n  }\n  @container highwater (max-width: 440px) {.composition-row.svelte-8fl9lq {grid-template-columns:10px minmax(0, 1fr);}.row-measures.svelte-8fl9lq {grid-column:2;text-align:left;}\n  }"
};
function Rs(e, t) {
	Be(t, !0), ui(e, Ls);
	let n = () => ot(Na, "$activePalette", r), [r, i] = st(), a = X(t, "pinnedCallIndex", 3, null), o = X(t, "selectedItemId", 3, null), s = X(t, "isVisible", 3, !1), c = X(t, "scope", 7, "cumulative"), l = X(t, "endpointNotice", 3, ""), u = X(t, "onScopeChange", 3, null), d = X(t, "onUnpinCall", 3, () => {}), f = X(t, "onRevealInRiver", 3, () => {}), p = X(t, "onViewDetails", 3, () => {}), m = X(t, "onFindInLifespans", 3, () => {}), h = X(t, "compact", 3, !1), g = /* @__PURE__ */ F(void 0), _ = /* @__PURE__ */ F(null), v = /* @__PURE__ */ F(null), y = /* @__PURE__ */ F(800), b = /* @__PURE__ */ F(null), x = /* @__PURE__ */ P(() => H(b) ?? (h() ? "list" : "treemap")), S = /* @__PURE__ */ F(null), ee = es(), C = /* @__PURE__ */ P(() => t.indexed.analysis.modelCalls), w = /* @__PURE__ */ P(() => a() === null ? -1 : H(C).findIndex((e) => e.index === a())), T = /* @__PURE__ */ P(() => H(w) < 0 ? null : H(C)[H(w)]), E = /* @__PURE__ */ P(() => H(w) > 0 ? H(C)[H(w) - 1] : null), D = /* @__PURE__ */ P(() => H(w) >= 0 && H(w) < H(C).length - 1 ? H(C)[H(w) + 1] : null), O = /* @__PURE__ */ P(() => s() ? ee.get(t.indexed, c(), a()) : null), k = /* @__PURE__ */ P(() => H(O) ? Ko(H(O).items) : []), te = /* @__PURE__ */ P(() => H(O) !== null && H(O).hasPositiveWeights && !H(O).totalOverflow), A = /* @__PURE__ */ P(() => H(O) && H(te) ? ns(H(O), H(y), 360) : {
		width: H(y),
		height: 360,
		rectangles: [],
		groups: []
	}), ne = /* @__PURE__ */ P(() => new Set(H(A).rectangles.map(({ item: e }) => e.id))), re = /* @__PURE__ */ P(() => H(te) && H(A).rectangles.length > 0), ie = /* @__PURE__ */ P(() => H(re) ? H(x) : "list"), ae = /* @__PURE__ */ P(() => H(ie) === "treemap" ? H(k).filter((e) => H(ne).has(e.id)) : H(k));
	Tn(() => {
		H(ae).length > 0 && !H(ae).some((e) => e.id === H(S)) && I(S, H(ae)[0].id, !0);
	});
	let oe = /* @__PURE__ */ P(() => H(ae).findIndex((e) => e.id === H(S))), se = /* @__PURE__ */ P(() => H(k).findIndex((e) => e.id === H(S))), ce = /* @__PURE__ */ P(() => H(se) < 0 ? void 0 : Ee(H(se))), le = /* @__PURE__ */ P(() => o() ? t.indexed.itemById.get(o()) ?? null : null), ue = /* @__PURE__ */ P(() => H(O)?.items.find((e) => e.id === o()) ?? null), de = /* @__PURE__ */ P(() => H(le) !== null && H(le).presence.length > 0), fe = /* @__PURE__ */ P(() => (H(O)?.profileIds ?? []).map((e) => {
		let n = t.indexed.analysis.tokenAnalysis.profiles.find((t) => t.id === e);
		return {
			id: e,
			description: n ? `${n.provider} / ${n.model} · ${Oe(n.method)}` : "Tokenization profile unavailable"
		};
	})), pe = /* @__PURE__ */ P(() => H(fe).length === 0 ? "Token estimate method unavailable" : H(fe).length === 1 ? H(fe)[0].description : `Mixed profiles across ${Z(H(fe).length)} call profiles`), me = /* @__PURE__ */ P(() => c() === "atCall" ? H(T) ? `Context composition · Call ${H(T).index}` : "Context composition · No call selected" : H(O)?.scopeEndCallIndex === null || H(O)?.scopeEndCallIndex === void 0 || a() === null ? "Cumulative context usage · Whole session" : `Cumulative context usage · Calls ${H(O).scopeStartCallIndex}–${H(O).scopeEndCallIndex}`), he = /* @__PURE__ */ P(() => c() === "atCall" ? `${Z(H(O)?.items.length ?? 0)} present items` : `${Z(H(O)?.scopeCallCount ?? 0)} model calls included`), ge = /* @__PURE__ */ P(() => c() === "atCall" ? "Estimated tokens" : "Estimated token-turns"), j = /* @__PURE__ */ P(() => c() === "atCall" ? "estimated item tokens" : "estimated token-turns"), _e = /* @__PURE__ */ P(() => (H(O)?.missingItemCallCount ?? 0) > 0 || (H(O)?.partialItemCallCount ?? 0) > 0 || (H(O)?.unavailableCoverageItemCallCount ?? 0) > 0), M = /* @__PURE__ */ P(() => H(O)?.numericItemCallCount ?? 0), ve = /* @__PURE__ */ P(() => H(O)?.totalItemCallCount ?? 0), ye = /* @__PURE__ */ P(() => H(O)?.items.filter((e) => e.tokens === 0).length ?? 0), xe = /* @__PURE__ */ P(() => H(O)?.items.filter((e) => e.tokens === null && !e.overflowed).length ?? 0), Se = /* @__PURE__ */ P(() => H(O)?.items.filter((e) => e.overflowed).length ?? 0), Ce = /* @__PURE__ */ P(() => H(O)?.items.filter((e) => (e.tokens ?? 0) > 0).length ?? 0), we = /* @__PURE__ */ P(() => H(A).rectangles.length), Te = /* @__PURE__ */ P(() => Math.max(0, H(Ce) - H(we)));
	function Ee(e) {
		return `composition-option-${c()}-${a() ?? "whole"}-${e}`;
	}
	function De(e) {
		return `composition-tile-clip-${c()}-${a() ?? "whole"}-${e}`;
	}
	function Oe(e) {
		return ha(e, "Mixed or unavailable estimate method");
	}
	function ke(e) {
		let t = e.tokens === null ? e.overflowed ? "safe subtotal unavailable because the sum overflowed" : "token estimate unavailable" : `${Z(e.tokens)} estimated ${c() === "atCall" ? "tokens" : "token-turns"}`, n = e.share === null ? "" : `${Ha(e.share)} of ${H(_e) ? "available-estimate subset" : "numeric item estimates"}`, r = e.estimateMethods.length > 1 ? "mixed estimate methods" : Oe(e.estimateMethod), i = `estimate coverage ${e.estimateCoverage}`, a = c() === "cumulative" ? `${e.knownContributionCount} of ${e.scopePresenceCount} item-call contributions have numeric estimates; ${e.missingContributionCount} unavailable` : "", o = e.explanations.map((e) => `${e.title}: ${e.impact}`).join("; "), s = e.ageAtCall === null ? "age unavailable" : `age ${e.ageAtCall} calls at the ${c() === "atCall" ? "inspected call" : "scope endpoint"}`;
		return `${e.label}, ${e.kindLabel}, ${t}, ${r}, ${i}${n ? `, ${n}` : ""}${a ? `, ${a}` : ""}${o ? `, ${o}` : ""}, ${s}`;
	}
	function Ae(e) {
		I(S, e.id, !0), t.onSelectItem(e.id);
	}
	async function je() {
		if (await gr(), H(ie) !== "list" || !H(_) || !H(ce)) return;
		let e = Hi(H(_)).getElementById(H(ce));
		if (!e || !H(_).contains(e)) return;
		let t = H(_).getBoundingClientRect(), n = e.getBoundingClientRect();
		n.top < t.top ? H(_).scrollTop += n.top - t.top : n.bottom > t.bottom && (H(_).scrollTop += n.bottom - t.bottom);
	}
	function Me(e) {
		if (H(ae).length === 0) return;
		let t = H(oe) < 0 ? 0 : H(oe);
		if (e.key === "ArrowDown" || e.key === "ArrowRight") t = Math.min(H(ae).length - 1, t + 1);
		else if (e.key === "ArrowUp" || e.key === "ArrowLeft") t = Math.max(0, t - 1);
		else if (e.key === "Home") t = 0;
		else if (e.key === "End") t = H(ae).length - 1;
		else if (e.key === "Enter" || e.key === " ") {
			let n = H(ae)[t];
			n && Ae(n), e.preventDefault();
			return;
		} else return;
		e.preventDefault(), I(S, H(ae)[t]?.id ?? null, !0), je();
	}
	function Ne(e) {
		I(b, e, !0);
	}
	function Pe(e) {
		c() !== e && (c(e), u()?.(e));
	}
	function Fe(e) {
		e.key === "Escape" && H(v)?.open && (e.preventDefault(), e.stopPropagation(), H(v).open = !1, H(v).querySelector("summary")?.focus());
	}
	function Ie(e) {
		return e.tokens === null ? e.overflowed ? "Subtotal exceeds safe range" : "Unavailable" : `${Z(e.tokens)} ${c() === "atCall" ? "estimated tokens" : "estimated token-turns"}`;
	}
	function Le(e) {
		return e.share === null ? "Share unavailable" : `${Ha(e.share)} of ${H(_e) ? "available-estimate subset" : "numeric estimates"}`;
	}
	function Re() {
		return !H(O) || H(ve) === 0 ? "No item appearances are in this scope" : H(M) === H(ve) ? "Numeric estimates available for all item appearances in this scope" : `Numeric estimates available for ${Z(H(M))} of ${Z(H(ve))} item appearances in this scope`;
	}
	function ze() {
		let e = [];
		return H(ye) > 0 && e.push(`${Z(H(ye))} zero-valued items`), H(xe) > 0 && e.push(`${Z(H(xe))} unavailable estimates`), H(Se) > 0 && e.push(`${Z(H(Se))} overflowed subtotals`), H(Te) > 0 && e.push(`${Z(H(Te))} positive items too small to render at this layout size`), e.join("; ");
	}
	function He() {
		if (!H(O)) return "";
		let e = [];
		return H(O).totalOverflow && e.push("The safe integer range was exceeded; shares and areas are withheld."), H(O).missingItemCallCount > 0 && e.push(`${Z(H(O).missingItemCallCount)} of ${Z(H(O).totalItemCallCount)} item-call contributions have no numeric estimate; subtotals and shares use the available-estimate subset.`), H(O).partialItemCallCount > 0 && e.push(`${Z(H(O).partialItemCallCount)} item-call estimates have partial payload coverage; subtotals remain qualified.`), H(O).unavailableCoverageItemCallCount > 0 && e.push(`${Z(H(O).unavailableCoverageItemCallCount)} item-call estimates have unavailable semantic coverage; any numeric contributions remain usable but qualified.`), e.join(" ");
	}
	function Ue() {
		if (!H(g) || !s()) return;
		let e = H(g).clientWidth;
		e > 0 && Math.abs(e - H(y)) > .5 && I(y, e, !0);
	}
	Cn(() => {
		s() && yr(Ue);
	}), Bi(() => {
		Ue();
		let e = typeof ResizeObserver > "u" ? null : new ResizeObserver((e) => {
			let t = e[0]?.contentRect.width;
			s() && t && Math.abs(t - H(y)) > .5 && I(y, t, !0);
		});
		return H(g) && e?.observe(H(g)), window.addEventListener("resize", Ue), () => {
			e?.disconnect(), window.removeEventListener("resize", Ue);
		};
	});
	var We = Is(), Ge = L(We), Ke = (e) => {
		var t = is(), n = L(t), r = L(n), i = B(r, 2);
		N(n);
		var a = B(n, 2), o = (e) => {
			var t = rs(), n = L(t), r = B(n, 2);
			N(t), V(() => {
				Y(n, "aria-pressed", H(x) === "treemap"), Y(r, "aria-pressed", H(x) === "list");
			}), U("click", n, () => Ne("treemap")), U("click", r, () => Ne("list")), G(e, t);
		};
		q(a, (e) => {
			H(O) && (c() !== "atCall" || H(T) !== null) && e(o);
		}), N(t), V(() => {
			Y(r, "aria-pressed", c() === "atCall"), Y(i, "aria-pressed", c() === "cumulative");
		}), U("click", r, () => Pe("atCall")), U("click", i, () => Pe("cumulative")), G(e, t);
	};
	q(Ge, (e) => {
		H(C).length > 0 && e(Ke);
	});
	var qe = B(Ge, 2), Je = (e) => {
		G(e, as());
	}, Ye = (e) => {
		var n = os(), r = B(L(n), 2);
		N(n), U("click", r, () => t.onPinCall(H(C)[H(C).length - 1].index)), G(e, n);
	}, Xe = (e) => {
		G(e, ss());
	}, Ze = (e) => {
		let r = /* @__PURE__ */ P(He);
		var i = Fs(), s = R(i), u = (e) => {
			var t = cs(), n = z(t, !0);
			V(() => K(n, l())), G(e, t);
		};
		q(s, (e) => {
			l() && c() === "cumulative" && a() === null && e(u);
		});
		var h = B(s, 2), g = L(h), y = L(g), b = z(y, !0), x = z(B(y, 2));
		N(g);
		var ee = B(g, 2), C = (e) => {
			var n = us(), r = L(n), i = L(r), a = B(i, 2);
			N(r);
			var o = B(r, 2), s = (e) => {
				var t = ls();
				U("click", t, function(...e) {
					d()?.apply(this, e);
				}), G(e, t);
			};
			q(o, (e) => {
				c() === "cumulative" && e(s);
			}), N(n), V(() => {
				i.disabled = H(E) === null, a.disabled = H(D) === null;
			}), U("click", i, () => H(E) && t.onPinCall(H(E).index)), U("click", a, () => H(D) && t.onPinCall(H(D).index)), G(e, n);
		};
		q(ee, (e) => {
			a() !== null && e(C);
		}), N(h);
		var w = B(h, 2), te = (e) => {
			var t = ds(), n = z(t, !0);
			V((e) => K(n, e), [() => Re()]), G(e, t);
		};
		q(w, (e) => {
			(H(ve) === 0 || H(M) !== H(ve)) && e(te);
		});
		var ne = B(w, 2), re = L(ne), ae = L(re), oe = B(ae), se = (e) => {
			va(e, {
				id: "composition-totals-note",
				label: "About these totals",
				children: (e, t) => {
					be(), G(e, zr("Totals and shares use only the item appearances with numeric estimates. Some\n            appearances have no estimate or are only partly counted, so the totals can be lower than\n            the true figure."));
				},
				$$slots: { default: !0 }
			});
		};
		q(oe, (e) => {
			H(_e) && e(se);
		}), N(re);
		var ye = B(re, 2), xe = L(ye), Se = B(xe), Ce = (e) => {
			var t = zr();
			V((e) => K(t, `· ${e ?? ""} with numeric estimates`), [() => Z(H(O).measuredItemCount)]), G(e, t);
		};
		q(Se, (e) => {
			H(O).unmeasuredItemCount > 0 && e(Ce);
		}), N(ye);
		var we = B(ye, 2), Te = (e) => {
			var t = fs(), n = z(t);
			V((e) => K(n, `${e ?? ""} items unavailable`), [() => Z(H(O).unmeasuredItemCount)]), G(e, t);
		};
		q(we, (e) => {
			H(O).unmeasuredItemCount > 0 && e(Te);
		}), N(ne);
		var je = B(ne, 2), Pe = B(L(je), 2), Be = z(Pe), Ve = B(Pe, 2), Ue = (e) => {
			var t = ms();
			J(t, 21, () => H(fe), (e) => e.id, (e, t) => {
				var n = ps(), r = L(n), i = B(r), a = z(i, !0);
				Xa(B(i, 2), {
					get value() {
						return H(t).id;
					},
					label: "profile ID"
				}), N(n), V(() => {
					K(r, `${H(t).description ?? ""} · `), K(a, H(t).id);
				}), G(e, n);
			}), N(t), G(e, t);
		}, We = (e) => {
			var t = hs(), n = L(t), r = z(n, !0);
			Xa(B(n, 2), {
				get value() {
					return H(T).tokenizationProfileId;
				},
				label: "profile ID"
			}), N(t), V(() => K(r, H(T).tokenizationProfileId)), G(e, t);
		};
		q(Ve, (e) => {
			c() === "cumulative" && H(fe).length > 0 ? e(Ue) : c() === "atCall" && H(T)?.tokenizationProfileId && e(We, 1);
		});
		var Ge = z(B(Ve, 2));
		N(je);
		var Ke = B(je, 2), qe = (e) => {
			var t = gs(), n = z(t, !0);
			V(() => K(n, H(r))), G(e, t);
		};
		q(Ke, (e) => {
			H(r) && e(qe);
		});
		var Je = B(Ke, 2), Ye = (e) => {
			G(e, _s());
		}, Xe = (e) => {
			G(e, vs());
		};
		q(Je, (e) => {
			H(O).allMeasuredZero ? e(Ye) : H(O).measuredItemCount === 0 && e(Xe, 1);
		});
		var Ze = B(Je, 2), Qe = L(Ze), $e = B(Qe, 2), et = L($e), tt = L(et), nt = (e) => {
			G(e, zr("Token-turns count an item's estimated tokens each time it appears in a model call. This\n            is input-context exposure, not unique content, provider usage, billed tokens, or cost."));
		}, rt = (e) => {
			G(e, zr("Areas use only this call's applicable item estimates. Shares use the numeric-estimate\n            subset; unknown estimates are not inferred from provider totals."));
		};
		q(tt, (e) => {
			c() === "cumulative" ? e(nt) : e(rt, -1);
		}), N(et), be(4), N($e), N(Ze), Ri(Ze, (e) => I(v, e), () => H(v));
		var it = B(Ze, 2), at = (e) => {
			var r = Es(), i = R(r), a = (e) => {
				var t = ys(), n = L(t), r = B(n);
				N(t), V((e, t, r) => K(n, `Treemap shows ${e ?? ""} of ${t ?? ""} items. ${r ?? ""}. `), [
					() => Z(H(A).rectangles.length),
					() => Z(H(O).items.length),
					() => ze()
				]), U("click", r, () => Ne("list")), G(e, t);
			};
			q(i, (e) => {
				H(A).rectangles.length < H(O).items.length && e(a);
			});
			var s = B(i, 2), c = L(s);
			Y(c, "height", 360);
			var l = L(c), u = L(l);
			J(u, 17, () => H(A).groups, (e) => e.kind, (e, t) => {
				var n = bs(), r = L(n);
				Y(r, "height", 13), N(n), V((e) => {
					Y(n, "id", `composition-group-clip-${H(t).kind}`), Y(r, "x", H(t).x + 3), Y(r, "y", H(t).y + 1), Y(r, "width", e);
				}, [() => Math.max(0, H(t).width - 6)]), G(e, n);
			}), J(B(u), 17, () => H(A).rectangles, (e) => e.item.id, (e, t) => {
				var n = bs(), r = z(n);
				V((e, i, a) => {
					Y(n, "id", e), Y(r, "x", H(t).x + 4), Y(r, "y", H(t).y + 3), Y(r, "width", i), Y(r, "height", a);
				}, [
					() => De(H(t).optionIndex),
					() => Math.max(0, H(t).width - 8),
					() => Math.max(0, H(t).height - 6)
				]), G(e, n);
			}), N(l);
			var d = B(l);
			J(d, 17, () => H(A).groups, (e) => e.kind, (e, t) => {
				var n = Ss(), r = L(n), i = z(r, !0), a = B(r), o = B(a), s = (e) => {
					var n = xs(), r = z(n, !0);
					V(() => {
						Y(n, "x", H(t).x + 5), Y(n, "y", H(t).y + 11), Y(n, "clip-path", `url(#composition-group-clip-${H(t).kind})`), K(r, H(t).labelText);
					}), G(e, n);
				};
				q(o, (e) => {
					H(t).labelText && e(s);
				}), N(n), V(() => {
					Y(n, "aria-label", `${H(t).label} group`), K(i, H(t).label), Y(a, "x", H(t).x), Y(a, "y", H(t).y), Y(a, "width", H(t).width), Y(a, "height", H(t).height);
				}), G(e, n);
			}), J(B(d), 17, () => H(A).rectangles, (e) => e.item.id, (e, r) => {
				var i = Ts();
				let a;
				var s = L(i), c = z(s, !0), l = B(s);
				let u;
				var d = B(l), f = (e) => {
					var i = ws(), a = L(i);
					let o;
					var s = z(a, !0), c = B(a), l = (e) => {
						var i = Cs();
						let a;
						var o = z(i);
						V((e, t, n) => {
							Y(i, "x", H(r).x + 5), Y(i, "y", H(r).y + 31), a = yi(i, "", a, { fill: e }), K(o, `${t ?? ""}${n ?? ""}`);
						}, [
							() => Ea(Ta(t.indexed, H(r).item.id, n())),
							() => Z(H(r).item.tokens),
							() => H(r).item.share === null ? "" : ` · ${Ha(H(r).item.share)}`
						]), G(e, i);
					};
					q(c, (e) => {
						H(r).height >= 49 && e(l);
					}), N(i), V((e, t) => {
						Y(i, "clip-path", e), Y(a, "x", H(r).x + 5), Y(a, "y", H(r).y + 16), o = yi(a, "", o, { fill: t }), K(s, H(r).labelText);
					}, [() => `url(#${De(H(r).optionIndex)})`, () => Ea(Ta(t.indexed, H(r).item.id, n()))]), G(e, i);
				};
				q(d, (e) => {
					H(r).labelFits && H(r).labelText && e(f);
				}), N(i), V((e, t, n, s) => {
					Y(i, "id", e), Y(i, "aria-selected", o() === H(r).item.id), Y(i, "aria-label", t), Y(i, "data-composition-item", H(r).item.id), a = _i(i, 0, "svelte-8fl9lq", null, a, {
						selected: o() === H(r).item.id,
						active: H(S) === H(r).item.id
					}), K(c, n), Y(l, "x", H(r).x), Y(l, "y", H(r).y), Y(l, "width", H(r).width), Y(l, "height", H(r).height), Y(l, "fill", s), u = _i(l, 0, "svelte-8fl9lq", null, u, { partial: H(r).item.estimateCoverage !== "complete" });
				}, [
					() => Ee(H(r).optionIndex),
					() => ke(H(r).item),
					() => ke(H(r).item),
					() => Ta(t.indexed, H(r).item.id, n())
				]), U("pointerup", i, () => Ae(H(r).item)), G(e, i);
			}), N(c), N(s), V(() => {
				Y(c, "width", H(A).width), Y(c, "viewBox", `0 0 ${H(A).width} 360`), Y(c, "aria-label", `${H(me)} treemap; ${H(A).rectangles.length} visible tiles of ${H(O).items.length} items; use arrow keys to inspect`), Y(c, "aria-activedescendant", H(ce));
			}), U("keydown", c, Me), G(e, r);
		}, ot = (e) => {
			var r = ks();
			J(r, 23, () => H(k), (e) => e.id, (e, r, i) => {
				var a = Os();
				let s;
				var l = L(a), u = B(l, 2), d = L(u), f = z(d, !0), p = B(d, 2), m = z(p), h = B(p, 2), g = (e) => {
					var t = Ds(), n = z(t);
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
					var t = Ds(), n = z(t);
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
					var n = Ds(), r = z(n);
					V(() => K(r, `${H(t).title ?? ""}: ${H(t).impact ?? ""}`)), G(e, n);
				}), N(u);
				var y = B(u, 2), b = L(y), x = z(b, !0), ee = B(b, 2), C = z(ee, !0), w = z(B(ee, 2), !0);
				N(y), N(a), V((e, t, n, i, u, d) => {
					Y(a, "id", e), s = _i(a, 1, "composition-row svelte-8fl9lq", null, s, {
						selected: o() === H(r).id,
						active: H(S) === H(r).id,
						unavailable: H(r).tokens === null
					}), Y(a, "aria-selected", o() === H(r).id), Y(a, "aria-label", t), Y(a, "data-composition-item", H(r).id), yi(l, n), K(f, H(r).label), K(m, `${H(r).kindLabel ?? ""} · ${i ?? ""} · ${H(r).estimateCoverage ?? ""} estimate coverage`), K(x, u), K(C, d), K(w, H(r).ageAtCall === null ? "Age unavailable" : `${H(r).ageAtCall} calls old at ${c() === "atCall" ? "this call" : "scope endpoint"}`);
				}, [
					() => Ee(H(i)),
					() => ke(H(r)),
					() => `background:${Ta(t.indexed, H(r).id, n())}`,
					() => H(r).estimateMethods.length > 1 ? "Mixed estimate methods" : Oe(H(r).estimateMethod),
					() => Ie(H(r)),
					() => Le(H(r))
				]), U("pointerup", a, () => Ae(H(r))), G(e, a);
			}), N(r), Ri(r, (e) => I(_, e), () => H(_)), V(() => {
				Y(r, "aria-label", `${H(me)} items ranked by estimated contribution; ${H(k).length} items`), Y(r, "aria-activedescendant", H(ce));
			}), U("keydown", r, Me), G(e, r);
		};
		q(it, (e) => {
			H(ie) === "treemap" ? e(at) : e(ot, -1);
		});
		var st = B(it, 2), ct = (e) => {
			var t = Ns(), n = L(t), r = L(n), i = z(r, !0), a = B(r, 2), o = (e) => {
				var t = As(), n = R(t), r = z(n), i = B(n, 2), a = (e) => {
					var t = Ds(), n = z(t);
					V((e, t, r) => K(n, `Known subtotal; ${e ?? ""} item-call
                estimates unavailable, ${t ?? ""} partial-coverage, and ${r ?? ""} unavailable-semantic.`), [
						() => Z(H(ue).missingContributionCount),
						() => Z(H(ue).partialEstimateContributionCount),
						() => Z(H(ue).unavailableCoverageContributionCount)
					]), G(e, t);
				};
				q(i, (e) => {
					(H(ue).missingContributionCount > 0 || H(ue).partialEstimateContributionCount > 0 || H(ue).unavailableCoverageContributionCount > 0) && e(a);
				}), V((e, t) => K(r, `${e ?? ""} · ${t ?? ""}`), [() => Ie(H(ue)), () => Le(H(ue))]), G(e, t);
			}, s = (e) => {
				var t = js(), n = z(t, !0);
				V(() => K(n, c() === "atCall" ? `Not present at call ${H(T)?.index ?? "Unknown"}.` : "No contribution within this cumulative scope.")), G(e, t);
			};
			q(a, (e) => {
				H(ue) ? e(o) : e(s, -1);
			}), N(n);
			var l = B(n, 2), u = L(l), d = B(u, 2), h = B(d, 2), g = (e) => {
				var t = Ms();
				U("click", t, () => f()(H(le).id)), G(e, t);
			};
			q(h, (e) => {
				H(de) && e(g);
			}), N(l), N(t), V(() => K(i, H(le).label)), U("click", u, function(...e) {
				p()?.apply(this, e);
			}), U("click", d, () => m()(H(le).id)), G(e, t);
		};
		q(st, (e) => {
			o() && H(le) && e(ct);
		});
		var lt = B(st, 2), ut = (e) => {
			var t = Ps(), n = B(L(t), 4), r = L(n), i = z(B(L(r), 2));
			N(r);
			var a = B(r, 2), o = z(B(L(a), 2));
			N(a);
			var s = B(a, 2), c = z(B(L(s), 2));
			N(s);
			var l = B(s, 2), u = z(B(L(l), 2), !0);
			N(l), N(n), N(t), V((e, t, n, r) => {
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
			K(b, H(me)), K(x, `${H(ge) ?? ""} · ${H(he) ?? ""}`), K(ae, `${e ?? ""}
        ${H(j) ?? ""}`), K(xe, `${t ?? ""} items `), K(Be, `Tokenizer: ${H(pe) ?? ""}`), K(Ge, `${n ?? ""} of ${r ?? ""} item appearances
        have numeric estimates in this ${c() === "atCall" ? "call" : "cumulative scope"}.
        ${i ?? ""} are missing, ${a ?? ""} have partial payload coverage, and ${o ?? ""} have unavailable semantic coverage.`);
		}, [
			() => Z(H(O).measuredTokenTotal),
			() => Z(H(O).items.length),
			() => Z(H(M)),
			() => Z(H(ve)),
			() => Z(H(O).missingItemCallCount),
			() => Z(H(O).partialItemCallCount),
			() => Z(H(O).unavailableCoverageItemCallCount)
		]), U("keydown", Qe, Fe), G(e, i);
	};
	q(qe, (e) => {
		H(C).length === 0 ? e(Je) : c() === "atCall" && !H(T) ? e(Ye, 1) : H(O) ? e(Ze, -1) : e(Xe, 2);
	}), N(We), Ri(We, (e) => I(g, e), () => H(g)), G(e, We), Ve(), i();
}
kr([
	"click",
	"keydown",
	"pointerup"
]);
//#endregion
//#region src/lib/components/RiverCallJump.svelte
var zs = /* @__PURE__ */ W("<p role=\"status\" class=\"svelte-1gbti2\"> </p>"), Bs = /* @__PURE__ */ W("<div class=\"call-jump svelte-1gbti2\"><form novalidate=\"\" class=\"svelte-1gbti2\"><label class=\"svelte-1gbti2\">Go to call <input aria-label=\"Call number\" type=\"number\" inputmode=\"numeric\" step=\"1\" class=\"svelte-1gbti2\"/></label> <button type=\"submit\" title=\"Pin this call without changing zoom\">Go</button></form> <!></div>"), Vs = {
	hash: "svelte-1gbti2",
	code: ".call-jump.svelte-1gbti2 {min-width:0;margin-left:7px;}form.svelte-1gbti2 {display:flex;flex-wrap:wrap;align-items:center;gap:7px;}label.svelte-1gbti2 {display:flex;align-items:center;gap:6px;font-size:var(--text-sm);}input.svelte-1gbti2 {width:64px;min-width:0;padding:5px;}p.svelte-1gbti2 {color:var(--secondary);font-size:var(--text-sm);}"
};
function Hs(e, t) {
	Be(t, !0), ui(e, Vs);
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
		let n = ua(String(H(o)), t.callIndices);
		if (n === null) {
			i("Enter a whole-number call index.");
			return;
		}
		i(Number(H(o)) === n ? "" : `Call ${H(o)} is not available; moving to call ${n}.`), t.onJumpToCall(n), r()();
	}
	var f = Bs(), p = L(f), m = L(p), h = B(L(m));
	Ai(h), N(m);
	var g = B(m, 2);
	N(p);
	var _ = B(p, 2), v = (e) => {
		var t = zs(), n = z(t, !0);
		V(() => K(n, i())), G(e, t);
	};
	q(_, (e) => {
		i() && !a() && e(v);
	}), N(f), V(() => {
		Y(h, "min", H(c)), Y(h, "max", H(l)), h.disabled = H(s), g.disabled = H(s);
	}), Or("submit", p, d), U("keydown", h, u), Pi(h, () => H(o), (e) => I(o, e)), G(e, f), Ve();
}
kr(["keydown"]);
//#endregion
//#region src/lib/components/CompactMenu.svelte
var Us = /* @__PURE__ */ W("<details class=\"view-options compact-menu svelte-1ilwl0u\"><summary class=\"svelte-1ilwl0u\"> </summary> <div class=\"menu-panel svelte-1ilwl0u\" role=\"group\"><!></div></details>"), Ws = {
	hash: "svelte-1ilwl0u",
	code: ".compact-menu.svelte-1ilwl0u {position:relative;}summary.svelte-1ilwl0u {display:inline-flex;align-items:center;gap:6px;min-height:var(--control-size);padding:var(--toggle-padding);border:1px solid var(--separator);border-radius:var(--control-radius);background:var(--surface);color:var(--text);list-style:none;white-space:nowrap;}summary.svelte-1ilwl0u::-webkit-details-marker {display:none;}summary.svelte-1ilwl0u::after {content:'';width:0;height:0;border-top:5px solid currentColor;border-right:4px solid transparent;border-left:4px solid transparent;}.compact-menu[open].svelte-1ilwl0u > summary:where(.svelte-1ilwl0u) {border-color:var(--accent);}.menu-panel.svelte-1ilwl0u {position:absolute;top:calc(100% + 4px);right:0;z-index:6;display:flex;flex-wrap:wrap;align-items:center;gap:8px;width:max-content;max-width:min(320px, calc(100cqw - 24px));padding:10px;border:1px solid var(--separator);border-radius:var(--radius);background:var(--surface-raised);box-shadow:0 6px 18px rgb(0 0 0 / 0.18);}"
};
function Gs(e, t) {
	Be(t, !0), ui(e, Ws);
	let n = /* @__PURE__ */ F(!1), r;
	Cn(() => {
		if (!H(n)) return;
		let e = (e) => {
			e.composedPath().includes(r) || I(n, !1);
		};
		return document.addEventListener("pointerdown", e, !0), () => document.removeEventListener("pointerdown", e, !0);
	});
	var i = Us(), a = L(i), o = z(a, !0), s = B(a, 2);
	li(L(s), () => t.children), N(s), N(i), Ri(i, (e) => r = e, () => r), V(() => {
		K(o, t.label), Y(s, "aria-label", t.label);
	}), zi("open", "toggle", i, (e) => I(n, e), () => H(n)), G(e, i), Ve();
}
//#endregion
//#region src/lib/components/ContextRiverNavigation.svelte
var Ks = /* @__PURE__ */ W("<button type=\"button\" class=\"step-call svelte-i2yay7\" aria-label=\"Previous call\" aria-keyshortcuts=\"ArrowLeft h\" title=\"Previous call (← / h)\">‹</button>"), qs = /* @__PURE__ */ W("<button type=\"button\" class=\"step-call svelte-i2yay7\" aria-label=\"Next call\" aria-keyshortcuts=\"ArrowRight l\" title=\"Next call (→ / l)\">›</button>"), Js = /* @__PURE__ */ W("<span class=\"zoom-level svelte-i2yay7\"> </span> <button type=\"button\" aria-label=\"Zoom out\" title=\"Zoom out\">−</button> <button type=\"button\" aria-label=\"Zoom in\" title=\"Zoom in\">+</button> <button type=\"button\" aria-label=\"Fit all calls\" title=\"Fit all calls\">Fit all</button> <button type=\"button\">Latest</button> <!>", 1), Ys = /* @__PURE__ */ W("<div class=\"controls svelte-i2yay7\" role=\"group\" aria-label=\"Chart zoom and navigation\"><!> <span class=\"range svelte-i2yay7\" aria-live=\"polite\" data-testid=\"visible-call-range\"> </span> <!> <!></div>"), Xs = /* @__PURE__ */ W("<div class=\"viewport-status svelte-i2yay7\"><span class=\"range svelte-i2yay7\" aria-live=\"polite\" data-testid=\"visible-call-range\"> </span></div> <div class=\"controls svelte-i2yay7\" role=\"group\" aria-label=\"Chart zoom and navigation\"><!> <!> <!></div>", 1), Zs = /* @__PURE__ */ W("<p class=\"jump-message svelte-i2yay7\" role=\"status\"> </p>"), Qs = /* @__PURE__ */ W("<div role=\"group\" aria-label=\"Context River navigation\"><!> <!></div>"), $s = {
	hash: "svelte-i2yay7",
	code: ".viewport-navigation.svelte-i2yay7 {display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin:8px 0 12px;min-width:0;}.viewport-status.svelte-i2yay7 {display:flex;align-items:center;min-width:0;margin-inline-end:auto;}.range.svelte-i2yay7 {color:var(--text);font-variant-numeric:tabular-nums;font-weight:600;}.controls.svelte-i2yay7 {display:flex;flex-wrap:wrap;align-items:center;gap:7px;min-width:0;}.jump-message.svelte-i2yay7 {flex-basis:100%;margin:0;color:var(--secondary);font-size:var(--text-sm);}.step-call.svelte-i2yay7 {width:var(--control-size);height:var(--control-size);padding:0;flex:0 0 var(--control-size);font-size:22px;line-height:1;}.zoom-level.svelte-i2yay7 {color:var(--secondary);font-size:var(--text-sm);font-variant-numeric:tabular-nums;}.compact.svelte-i2yay7 .controls:where(.svelte-i2yay7) {flex-basis:100%;flex-wrap:nowrap;}.compact.svelte-i2yay7 .range:where(.svelte-i2yay7) {min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}.compact.svelte-i2yay7 .compact-menu {margin-left:auto;}"
};
function ec(e, t) {
	Be(t, !0), ui(e, $s);
	let n = (e) => {
		var t = Ks();
		Ri(t, (e) => m = e, () => m), V(() => t.disabled = H(f) === null || !c()), U("click", t, () => H(f) !== null && o()(H(f))), G(e, t);
	}, r = (e) => {
		var t = qs();
		Ri(t, (e) => h = e, () => h), V(() => t.disabled = H(p) === null || !c()), U("click", t, () => H(p) !== null && o()(H(p))), G(e, t);
	}, i = (e) => {
		var n = Js(), r = R(n), i = z(r), a = B(r, 2), o = B(a, 2), l = B(o, 2), f = B(l, 2), p = B(f, 2);
		{
			let e = /* @__PURE__ */ P(() => t.viewport.ready && c());
			Hs(p, {
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
	}, a = X(t, "pinnedCallIndex", 3, null), o = X(t, "onSelectCall", 3, () => {}), s = X(t, "onJumpToCall", 3, (e) => o()(e)), c = X(t, "isVisible", 3, !0), l = X(t, "compact", 3, !1), u = /* @__PURE__ */ F(""), d = /* @__PURE__ */ P(() => t.callIndices.length === 0), f = /* @__PURE__ */ P(() => t.viewport.ready ? ra(t.callIndices, a(), t.viewport, -1) : null), p = /* @__PURE__ */ P(() => t.viewport.ready ? ra(t.callIndices, a(), t.viewport, 1) : null), m, h;
	Tn(() => {
		H(p) === null && H(f) !== null && Hi(h).activeElement === h && gr().then(() => m.focus()), H(f) === null && H(p) !== null && Hi(m).activeElement === m && gr().then(() => h.focus());
	});
	let g = /* @__PURE__ */ P(() => H(d) ? "No model calls" : t.viewport.ready ? t.viewport.firstVisibleCallIndex === null || t.viewport.lastVisibleCallIndex === null ? `No call markers visible of ${t.callIndices.length}` : t.viewport.firstVisibleCallIndex === t.viewport.lastVisibleCallIndex ? `Call ${t.viewport.firstVisibleCallIndex} of ${t.callIndices.length}` : `Calls ${t.viewport.firstVisibleCallIndex}–${t.viewport.lastVisibleCallIndex} of ${t.callIndices.length}` : "Measuring chart viewport…");
	var _ = Qs();
	let v;
	var y = L(_), b = (e) => {
		var t = Ys(), a = L(t);
		n(a);
		var o = B(a, 2), s = z(o, !0), c = B(o, 2);
		r(c), Gs(B(c, 2), {
			label: "Zoom & jump",
			children: (e, t) => {
				i(e);
			},
			$$slots: { default: !0 }
		}), N(t), V(() => K(s, H(g))), G(e, t);
	}, x = (e) => {
		var t = Xs(), a = R(t), o = z(L(a), !0);
		N(a);
		var s = B(a, 2), c = L(s);
		n(c);
		var l = B(c, 2);
		r(l);
		var u = B(l, 2);
		i(u), N(s), V(() => K(o, H(g))), G(e, t);
	};
	q(y, (e) => {
		l() ? e(b) : e(x, -1);
	});
	var S = B(y, 2), ee = (e) => {
		var t = Zs(), n = z(t, !0);
		V(() => K(n, H(u))), G(e, t);
	};
	q(S, (e) => {
		H(u) && e(ee);
	}), N(_), V(() => v = _i(_, 1, "viewport-navigation svelte-i2yay7", null, v, { compact: l() })), G(e, _), Ve();
}
kr(["click"]);
//#endregion
//#region src/lib/context-river/lifespans.ts
function tc(e, t, n) {
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
function nc(e) {
	return e.presenceCallCount;
}
function rc(e) {
	return e.tokenTurns;
}
function ic(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e) for (let e of n.tokenEstimates) e.tokens !== null && Number.isFinite(e.tokens) && t.set(e.profileId, (t.get(e.profileId) ?? 0) + 1);
	let n = null, r = 0;
	for (let [e, i] of t) (i > r || i === r && n !== null && pc(e, n) < 0) && (n = e, r = i);
	return n;
}
function ac(e, t) {
	return t === null ? null : e.tokenEstimates.find((e) => e.profileId === t)?.tokens ?? null;
}
function oc(e) {
	let t = e.map(rc).filter((e) => e !== null);
	return t.length === 0 ? null : t.reduce((e, t) => e + t, 0);
}
function sc(e) {
	return e.reduce((e, t) => e + nc(t), 0);
}
function cc(e, t = "tokenTurns", n = null, r = (e) => [e]) {
	let i = new Map(e.map((e, t) => [e.id, t])), a = (e) => {
		let t = r(e);
		return t[t.length - 1] ?? e;
	};
	return [...e].sort((e, o) => {
		let s = 0;
		return s = t === "firstAppearance" ? fc(uc(e), uc(o)) : t === "presenceCount" ? sc(r(o)) - sc(r(e)) : t === "size" ? dc(ac(a(e), n), ac(a(o), n)) : dc(oc(r(e)), oc(r(o))), s || (i.get(e.id) ?? 2 ** 53 - 1) - (i.get(o.id) ?? 2 ** 53 - 1) || pc(e.id, o.id);
	});
}
function lc(e, t = 8) {
	if (e.length <= t) return [...e];
	let n = Math.max(2, Math.floor(t)), r = /* @__PURE__ */ new Set();
	for (let t = 0; t < n; t += 1) r.add(Math.round(t * (e.length - 1) / (n - 1)));
	return [...r].map((t) => e[t]);
}
function uc(e) {
	return e.firstModelCall > 0 ? e.firstModelCall : null;
}
function dc(e, t) {
	return e === null ? t === null ? 0 : 1 : t === null ? -1 : t - e;
}
function fc(e, t) {
	return e === null ? t === null ? 0 : 1 : t === null ? -1 : e - t;
}
function pc(e, t) {
	return e < t ? -1 : +(e > t);
}
//#endregion
//#region src/lib/item-versions.ts
function mc(e) {
	return e.kind === "system" ? "system" : e.kind === "toolDefinition" && e.metadata.toolName ? `toolDefinition:${e.metadata.toolName}` : null;
}
function hc(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e) {
		let e = mc(n);
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
function gc(e, t, n) {
	let r = t.get(n)?.firstId ?? n, i = [];
	for (let n = r; n !== null;) {
		let r = e.get(n);
		if (!r) break;
		i.push(r), n = t.get(n)?.nextId ?? null;
	}
	return i;
}
function _c(e) {
	return [...new Set(e.map((e) => e.metadata.toolName ?? e.label))].sort();
}
function vc(e, t, n) {
	let r = e.filter((e) => e.kind === "toolDefinition"), i = r.filter((e) => e.firstModelCall === n), a = _c(i.filter((e) => t.get(e.id)?.previousId)), o = _c(i.filter((e) => !t.get(e.id)?.previousId)), s = _c(r.filter((e) => e.presence.length > 0 && e.lastModelCall === n - 1 && !t.get(e.id)?.nextId)), c = [
		o.length > 0 ? `tools added: ${o.join(", ")}` : "",
		a.length > 0 ? `tool definitions changed: ${a.join(", ")}` : "",
		s.length > 0 ? `tools removed: ${s.join(", ")}` : ""
	].filter(Boolean);
	return c.length > 0 ? c.join("; ") : "the prompt text changed";
}
//#endregion
//#region src/lib/components/ContextLifespans.svelte
var yc = /* @__PURE__ */ W("<span class=\"result-count svelte-1pk7niq\"> </span>"), bc = /* @__PURE__ */ W("<option> </option>"), xc = /* @__PURE__ */ W("<button class=\"clear-filters svelte-1pk7niq\" type=\"button\">Clear filters</button>"), Sc = /* @__PURE__ */ W("<div class=\"browse-controls svelte-1pk7niq\" role=\"group\" aria-label=\"Filter and sort context items\"><label class=\"search-field svelte-1pk7niq\" for=\"lifespan-search\"><span id=\"lifespan-search-label\">Search items</span> <input id=\"lifespan-search\" aria-labelledby=\"lifespan-search-label\" type=\"search\" placeholder=\"Label or preview\" class=\"svelte-1pk7niq\"/></label> <label class=\"browse-field kind-field svelte-1pk7niq\" for=\"lifespan-kind\"><span>Kind</span> <select id=\"lifespan-kind\" aria-label=\"Filter by kind\" class=\"svelte-1pk7niq\"><option>All kinds</option><!></select></label> <label class=\"browse-field sort-field svelte-1pk7niq\" for=\"lifespan-sort\"><span>Sort by</span> <select id=\"lifespan-sort\" aria-label=\"Sort items\" class=\"svelte-1pk7niq\"><option>Token-turn exposure</option><option>Size (tokens)</option><option>First appearance</option><option>Lifetime (calls present)</option></select></label> <label class=\"browse-field scope-field svelte-1pk7niq\" for=\"lifespan-scope\"><span>Scope</span> <select id=\"lifespan-scope\" aria-label=\"Scope context items\" class=\"svelte-1pk7niq\"><option>Whole session</option><option> </option></select></label> <!></div>"), Cc = /* @__PURE__ */ W("<div class=\"compact-browse svelte-1pk7niq\"><!></div>"), wc = /* @__PURE__ */ W("<button type=\"button\" class=\"svelte-1pk7niq\"> </button>"), Tc = /* @__PURE__ */ W("<span class=\"scope-help svelte-1pk7niq\">Pin a call in Context River to enable call-specific scope.</span>"), Ec = /* @__PURE__ */ W("<p class=\"scope-status svelte-1pk7niq\" role=\"status\"> </p>"), Dc = /* @__PURE__ */ W("<button type=\"button\" class=\"svelte-1pk7niq\">Reset filters and find item</button>"), Oc = /* @__PURE__ */ W("<p class=\"find-status svelte-1pk7niq\" role=\"status\"> <!></p>"), kc = /* @__PURE__ */ W("<p class=\"sort-help svelte-1pk7niq\"> </p>"), Ac = /* @__PURE__ */ W("<p class=\"selection-note svelte-1pk7niq\">The selected item is hidden by these filters; its inspector remains available.</p>"), jc = /* @__PURE__ */ W("<span class=\"axis-pin-marker svelte-1pk7niq\" aria-hidden=\"true\"><span class=\"svelte-1pk7niq\"> </span></span>"), Mc = /* @__PURE__ */ W("<span> </span>"), Nc = /* @__PURE__ */ W("<span class=\"axis-boundary svelte-1pk7niq\" aria-hidden=\"true\"></span>"), Pc = /* @__PURE__ */ W("<p class=\"empty-state svelte-1pk7niq\">No context items in this session.</p>"), Fc = /* @__PURE__ */ W("<p class=\"empty-state svelte-1pk7niq\">No items match these filters. Clear filters to see the full list.</p>"), Ic = /* @__PURE__ */ W("<span class=\"pin-marker svelte-1pk7niq\" aria-hidden=\"true\"></span>"), Lc = /* @__PURE__ */ W("<span class=\"boundary svelte-1pk7niq\" aria-hidden=\"true\"></span>"), Rc = /* @__PURE__ */ W("<button type=\"button\"></button>"), zc = /* @__PURE__ */ W("<span class=\"version-mark svelte-1pk7niq\" aria-hidden=\"true\"></span>"), Bc = /* @__PURE__ */ W("<!> <!>", 1), Vc = /* @__PURE__ */ W("<small class=\"svelte-1pk7niq\"> </small>"), Hc = /* @__PURE__ */ W("<div tabindex=\"-1\"><div class=\"label svelte-1pk7niq\"><span class=\"swatch svelte-1pk7niq\"></span> <div class=\"label-copy svelte-1pk7niq\"><button type=\"button\"> </button> <small class=\"svelte-1pk7niq\"> </small></div></div> <div class=\"track svelte-1pk7niq\"><!> <!> <!></div> <div class=\"meta svelte-1pk7niq\"> <!></div></div>"), Uc = /* @__PURE__ */ W("<div class=\"more-rows svelte-1pk7niq\"><span> </span> <button type=\"button\"> </button></div>"), Wc = /* @__PURE__ */ W("<div class=\"rows\"></div> <!>", 1), Gc = /* @__PURE__ */ W("<div class=\"lifespan-content svelte-1pk7niq\"><!> <div class=\"lifespan-scope-status svelte-1pk7niq\"><span>Scope: <strong class=\"svelte-1pk7niq\"> </strong></span> <!></div> <!> <!> <!> <!> <div class=\"lifespan-legend svelte-1pk7niq\" aria-label=\"Lifespan markers\"><span class=\"svelte-1pk7niq\"><i class=\"legend-presence svelte-1pk7niq\"></i>Item presence</span> <span class=\"svelte-1pk7niq\"><i class=\"legend-pin svelte-1pk7niq\"></i>Pinned call</span> <span class=\"svelte-1pk7niq\"><i class=\"legend-compaction svelte-1pk7niq\"></i>Compaction boundary</span></div> <div class=\"axis-row svelte-1pk7niq\"><span class=\"axis-title svelte-1pk7niq\">Full-session calls</span> <div class=\"axis-track svelte-1pk7niq\" role=\"img\"><!> <!> <!></div> <span class=\"axis-note svelte-1pk7niq\">calls</span></div> <!></div>"), Kc = /* @__PURE__ */ W("<section class=\"lifespans\" aria-label=\"Context lifespans\"><details class=\"lifespan-disclosure svelte-1pk7niq\"><summary class=\"lifespan-header svelte-1pk7niq\"><span class=\"disclosure-chevron svelte-1pk7niq\" aria-hidden=\"true\"></span> <span class=\"lifespan-heading svelte-1pk7niq\"><h2 class=\"svelte-1pk7niq\"> </h2></span> <!></summary> <!></details></section>"), qc = {
	hash: "svelte-1pk7niq",
	code: ".lifespan-disclosure.svelte-1pk7niq {min-width:0;}.lifespan-disclosure.svelte-1pk7niq > summary:where(.svelte-1pk7niq) {list-style:none;}.lifespan-disclosure.svelte-1pk7niq > summary:where(.svelte-1pk7niq)::-webkit-details-marker {display:none;}.lifespan-header.svelte-1pk7niq {position:sticky;top:0;z-index:4;display:grid;grid-template-columns:14px minmax(0, 1fr) auto;justify-content:space-between;gap:8px;align-items:start;margin:-2px -2px 8px;padding:6px 2px;background:var(--surface);cursor:pointer;}.disclosure-chevron.svelte-1pk7niq {width:9px;height:9px;margin:4px 0 0 2px;border-right:2px solid var(--text);border-bottom:2px solid var(--text);transform:rotate(-45deg);transition:transform 120ms ease;}.lifespan-disclosure[open].svelte-1pk7niq .disclosure-chevron:where(.svelte-1pk7niq) {transform:rotate(45deg);}.lifespan-heading.svelte-1pk7niq {display:grid;min-width:0;gap:2px;}.lifespan-content.svelte-1pk7niq {min-width:0;}h2.svelte-1pk7niq {font-size:var(--text-lg);margin:0;color:var(--text-strong);}.result-count.svelte-1pk7niq {color:var(--secondary);white-space:nowrap;}.lifespan-content.svelte-1pk7niq {container:lifespans / inline-size;}.browse-controls.svelte-1pk7niq {display:grid;grid-template-columns:minmax(180px, 1.5fr) minmax(130px, 1fr) minmax(150px, 1.1fr) minmax(165px, 1fr)\n      auto;align-items:end;gap:8px;margin:10px 0 12px;}.search-field.svelte-1pk7niq,\n  .kind-field.svelte-1pk7niq,\n  .sort-field.svelte-1pk7niq,\n  .scope-field.svelte-1pk7niq,\n  .clear-filters.svelte-1pk7niq {min-width:0;}.browse-controls.svelte-1pk7niq input:where(.svelte-1pk7niq),\n  .browse-controls.svelte-1pk7niq select:where(.svelte-1pk7niq) {box-sizing:border-box;}.search-field.svelte-1pk7niq,\n  .browse-field.svelte-1pk7niq {display:grid;gap:3px;color:var(--secondary);font-size:var(--text-sm);}.search-field.svelte-1pk7niq {grid-template-columns:1fr;}.browse-controls.svelte-1pk7niq input:where(.svelte-1pk7niq),\n  .browse-controls.svelte-1pk7niq select:where(.svelte-1pk7niq) {min-width:0;width:100%;background-color:var(--plot);border:1px solid var(--control-border);border-radius:var(--control-radius);color:var(--text-strong);padding:7px 8px;font:inherit;font-size:var(--text-sm);}.browse-controls.svelte-1pk7niq select:where(.svelte-1pk7niq) {padding-right:32px;}.browse-controls.svelte-1pk7niq button:where(.svelte-1pk7niq) {white-space:nowrap;}.sort-help.svelte-1pk7niq,\n  .scope-help.svelte-1pk7niq,\n  .scope-status.svelte-1pk7niq,\n  .selection-note.svelte-1pk7niq,\n  .find-status.svelte-1pk7niq,\n  .more-rows.svelte-1pk7niq {display:flex;align-items:center;gap:var(--space-3);margin-top:var(--space-3);color:var(--secondary);font-size:var(--text-sm);}.empty-state.svelte-1pk7niq {color:var(--secondary);font-size:var(--text-sm);margin:7px 0;}.lifespan-scope-status.svelte-1pk7niq {display:flex;flex-wrap:wrap;align-items:center;gap:7px 12px;margin:6px 0;color:var(--secondary);font-size:var(--text-sm);}.lifespan-scope-status.svelte-1pk7niq strong:where(.svelte-1pk7niq) {color:var(--text);}.lifespan-scope-status.svelte-1pk7niq button:where(.svelte-1pk7niq),\n  .find-status.svelte-1pk7niq button:where(.svelte-1pk7niq) {padding:4px 7px;font-size:var(--text-sm);}.find-status.svelte-1pk7niq button:where(.svelte-1pk7niq) {margin-left:7px;}.lifespan-legend.svelte-1pk7niq {display:flex;flex-wrap:wrap;gap:6px 16px;margin:7px 0;color:var(--secondary);font-size:var(--text-sm);}.lifespan-legend.svelte-1pk7niq span:where(.svelte-1pk7niq) {display:inline-flex;align-items:center;gap:5px;}.lifespan-legend.svelte-1pk7niq i:where(.svelte-1pk7niq) {display:inline-block;width:15px;height:8px;}.legend-presence.svelte-1pk7niq {border-radius:4px;background:var(--lifespan-version);}.legend-pin.svelte-1pk7niq {width:0 !important;border-left:2px solid var(--text-strong);}.legend-compaction.svelte-1pk7niq {height:0 !important;border-top:1px dashed var(--compaction);}.axis-row.svelte-1pk7niq,\n  .row.svelte-1pk7niq {display:grid;grid-template-columns:minmax(140px, 220px) minmax(0, 1fr) 115px;gap:10px;align-items:center;}.axis-row.svelte-1pk7niq {min-height:24px;margin:4px 0 2px;color:var(--secondary);font-size:10px;}.axis-title.svelte-1pk7niq {white-space:nowrap;}.axis-track.svelte-1pk7niq {height:22px;position:relative;min-width:0;border-bottom:1px solid var(--separator);}.axis-tick.svelte-1pk7niq {position:absolute;bottom:2px;transform:translateX(-50%);padding:0 2px;background:var(--plot);font-variant-numeric:tabular-nums;}.axis-tick.first.svelte-1pk7niq {transform:none;}.axis-tick.last.svelte-1pk7niq {transform:translateX(-100%);}.axis-tick.center.svelte-1pk7niq {transform:translateX(-50%);}.axis-pin-marker.svelte-1pk7niq,\n  .pin-marker.svelte-1pk7niq {position:absolute;z-index:3;height:100%;border-left:2px solid var(--text-strong);pointer-events:none;}.axis-pin-marker.svelte-1pk7niq,\n  .pin-marker.svelte-1pk7niq {top:0;}.axis-pin-marker.svelte-1pk7niq span:where(.svelte-1pk7niq) {position:absolute;top:0;left:2px;padding:0 2px;color:var(--text-strong);background:var(--plot);font-size:9px;white-space:nowrap;}.axis-boundary.svelte-1pk7niq,\n  .boundary.svelte-1pk7niq {position:absolute;z-index:2;height:100%;border-left:1px dashed var(--compaction);pointer-events:none;}.axis-boundary.svelte-1pk7niq {top:0;opacity:0.75;}.axis-note.svelte-1pk7niq {text-align:right;}.row.svelte-1pk7niq {scroll-margin-block:54px;padding:7px 3px;border-top:1px solid var(--chart-guide);transition:opacity 120ms ease;}.row.selected.svelte-1pk7niq {background:var(--selected-surface);box-shadow:inset 3px 0 var(--selection);}.row.svelte-1pk7niq:focus-visible {outline:2px solid var(--accent);outline-offset:-2px;}.row.selected.svelte-1pk7niq .segment:where(.svelte-1pk7niq) {outline:2px solid var(--selection);outline-offset:1px;}.label.svelte-1pk7niq {display:flex;align-items:center;gap:7px;min-width:0;}.swatch.svelte-1pk7niq {flex:0 0 9px;width:9px;height:9px;border-radius:var(--radius-small);}.label-copy.svelte-1pk7niq {display:grid;min-width:0;}.item-label.svelte-1pk7niq,\n  .terminal-item.svelte-1pk7niq {overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text);text-align:left;}.item-label.svelte-1pk7niq {min-width:0;width:100%;padding:0;border:0;border-radius:0;background:transparent;font:inherit;}.item-label.svelte-1pk7niq:hover {background:transparent;text-decoration:underline;}.item-label.svelte-1pk7niq:focus-visible {outline:2px solid var(--accent);outline-offset:1px;}.label-copy.svelte-1pk7niq small:where(.svelte-1pk7niq) {overflow:hidden;color:var(--muted);text-overflow:ellipsis;white-space:nowrap;font-size:10px;}.track.svelte-1pk7niq {height:22px;position:relative;min-width:0;background:var(--plot);border-radius:var(--control-radius);overflow:hidden;}.segment.svelte-1pk7niq {position:absolute;top:3px;height:16px;min-width:3px;padding:0;border:0;border-radius:4px;cursor:pointer;}\n  /* Versions that follow on directly meet without a rounded gap. */.segment.replaced-after.svelte-1pk7niq {border-top-right-radius:0;border-bottom-right-radius:0;}.segment.replaces-before.svelte-1pk7niq {border-top-left-radius:0;border-bottom-left-radius:0;}.segment.compacted.svelte-1pk7niq {border-right:4px double var(--selection);background-image:repeating-linear-gradient(\n      135deg,\n      var(--presence-overlay) 0 3px,\n      transparent 3px 7px\n    );}.segment.svelte-1pk7niq:focus-visible {outline:2px solid var(--selection);outline-offset:1px;}.boundary.svelte-1pk7niq {top:0;}\n  /* Where a new version of a system prompt or tool definition starts; matches the River's mark. */.version-mark.svelte-1pk7niq {position:absolute;z-index:3;top:3px;height:16px;border-left:1.5px solid var(--selection-focus);pointer-events:none;}.meta.svelte-1pk7niq {text-align:right;color:var(--secondary);font-size:var(--text-sm);white-space:nowrap;}.meta.svelte-1pk7niq small:where(.svelte-1pk7niq) {display:block;color:var(--muted);font-size:10px;}\n  @container lifespans (max-width: 900px) {.browse-controls.svelte-1pk7niq {grid-template-columns:minmax(0, 1.35fr) minmax(115px, 1fr) minmax(145px, 1.1fr) minmax(145px, 1fr)\n        auto;grid-template-areas:'search search kind kind .'\n        'sort sort scope scope reset';}.search-field.svelte-1pk7niq {grid-area:search;}.kind-field.svelte-1pk7niq {grid-area:kind;}.sort-field.svelte-1pk7niq {grid-area:sort;}.scope-field.svelte-1pk7niq {grid-area:scope;}.clear-filters.svelte-1pk7niq {grid-area:reset;justify-self:end;}\n  }\n  @container lifespans (max-width: 680px) {.browse-controls.svelte-1pk7niq {grid-template-columns:repeat(2, minmax(0, 1fr));grid-template-areas:'search search'\n        'kind kind'\n        'sort scope'\n        'reset reset';}.clear-filters.svelte-1pk7niq {justify-self:start;}\n  }\n  @container lifespans (max-width: 430px) {.browse-controls.svelte-1pk7niq {grid-template-columns:minmax(0, 1fr);grid-template-areas:'search'\n        'kind'\n        'sort'\n        'scope'\n        'reset';}\n  }\n  @container highwater (max-width: 700px) {.axis-row.svelte-1pk7niq,\n    .row.svelte-1pk7niq {grid-template-columns:120px minmax(0, 1fr);}.axis-note.svelte-1pk7niq,\n    .meta.svelte-1pk7niq {display:none;}\n  }\n  @container highwater (max-width: 420px) {.browse-controls.svelte-1pk7niq {grid-template-columns:minmax(0, 1fr);}.browse-controls.svelte-1pk7niq > :where(.svelte-1pk7niq) {grid-column:auto;}.result-count.svelte-1pk7niq {white-space:normal;text-align:right;}\n  }.compact-browse.svelte-1pk7niq {display:flex;justify-content:flex-end;margin-bottom:8px;}.compact-browse.svelte-1pk7niq .browse-controls:where(.svelte-1pk7niq) {width:min(300px, calc(100cqw - 48px));}\n  /* Narrow views: each item's full label on its own line above a full-width bar. */\n  @container highwater (max-width: 520px) {.axis-row.svelte-1pk7niq,\n    .row.svelte-1pk7niq {grid-template-columns:minmax(0, 1fr);}.axis-title.svelte-1pk7niq {display:none;}.row.svelte-1pk7niq .label:where(.svelte-1pk7niq) {min-width:0;}\n    /* Two lines at most; the full label is the row's tooltip and in the item details. */.row.svelte-1pk7niq .item-label:where(.svelte-1pk7niq) {display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;overflow:hidden;white-space:normal;overflow-wrap:anywhere;text-align:left;}\n  }\n  @media (prefers-reduced-motion: reduce) {.row.svelte-1pk7niq,\n    .disclosure-chevron.svelte-1pk7niq {transition:none;}\n  }"
};
function Jc(e, t) {
	Be(t, !0), ui(e, qc);
	let n = () => ot(Na, "$activePalette", r), [r, i] = st(), a = X(t, "selectedItemId", 3, null), o = X(t, "pinnedCallIndex", 3, null), s = X(t, "findRequest", 3, null), c = X(t, "compact", 3, !1), l = [
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
	Vi(() => {
		x = !1;
	});
	let S = /* @__PURE__ */ P(() => t.indexed.analysis.contextItems), ee = /* @__PURE__ */ P(() => Lo(H(S))), C = /* @__PURE__ */ P(() => ic(H(S))), w = /* @__PURE__ */ P(() => H(C) === null ? null : t.indexed.analysis.tokenAnalysis.profiles.find((e) => e.id === H(C)) ?? null), T = /* @__PURE__ */ P(() => H(w) ? `${H(w).provider}/${H(w).model} · ${H(w).method}` : H(C) ?? "unavailable"), E = /* @__PURE__ */ P(() => o() === null ? null : t.indexed.contextSetByCall.get(o()) ?? null), D = /* @__PURE__ */ P(() => H(S).filter((e) => (t.indexed.versionByItemId.get(e.id)?.number ?? 1) === 1)), O = /* @__PURE__ */ P(() => new Map(H(D).map((e) => [e.id, gc(t.indexed.itemById, t.indexed.versionByItemId, e.id)]))), k = /* @__PURE__ */ P(() => (e) => H(O).get(e.id) ?? [e]), te = /* @__PURE__ */ P(() => cc(H(D), H(m), H(C), H(k))), A = /* @__PURE__ */ P(() => H(f) === "presentAtPin" && H(E) !== null ? H(te).filter((e) => H(k)(e).some((e) => H(E).has(e.id))) : H(te)), ne = /* @__PURE__ */ P(() => H(u).trim().slice(0, 120).toLowerCase()), re = /* @__PURE__ */ P(() => H(A).filter((e) => {
		let t = H(d) === "all" || e.kind === H(d), n = H(ne).length === 0 || H(k)(e).some((e) => e.label.toLowerCase().includes(H(ne)) || (e.preview?.text ?? "").toLowerCase().includes(H(ne)));
		return t && n;
	})), ie = /* @__PURE__ */ P(() => H(re).reduce((e, t) => e + H(k)(t).length, 0)), ae = /* @__PURE__ */ P(() => H(re).slice(0, H(h))), oe = /* @__PURE__ */ P(() => H(re).length - H(ae).length), se = /* @__PURE__ */ P(() => l.filter((e) => H(S).some((t) => t.kind === e))), ce = /* @__PURE__ */ P(() => +!!H(ne) + (H(d) === "all" ? 0 : 1) + (H(f) === "all" ? 0 : 1)), le = /* @__PURE__ */ P(() => H(ne).length > 0 || H(d) !== "all" || H(f) !== "all"), ue = /* @__PURE__ */ P(() => t.indexed.analysis.modelCalls.map((e) => e.index)), de = /* @__PURE__ */ P(() => lc(H(ue))), fe = /* @__PURE__ */ P(() => H(ue).length), pe = /* @__PURE__ */ P(() => new Map(H(ue).map((e, t) => [e, t]))), me = /* @__PURE__ */ P(() => o() === null || !H(pe).has(o()) ? null : j(o())), he = /* @__PURE__ */ P(() => a() !== null && H(le) && !H(re).some((e) => Se(e, a())));
	Tn(() => {
		H(d) !== "all" && !H(se).includes(H(d)) && I(d, "all");
	}), Tn(() => {
		H(m) === "size" && H(C) === null && I(m, "tokenTurns");
	}), Tn(() => {
		H(f) === "presentAtPin" && o() === null && (I(f, "all"), I(p, "Pin cleared; showing all items."));
	}), Tn(() => {
		H(f) === "all" && o() !== null && I(p, "");
	}), Tn(() => {
		H(ne), H(d), H(f), H(m), I(h, 50);
	}), Tn(() => {
		if (s() && s().requestId !== _) {
			_ = s().requestId, I(v, s().itemId, !0), I(y, ""), I(g, !0);
			let e = s().requestId;
			gr().then(() => Me(e));
		}
	}), Tn(() => {
		!s() && H(v) && (I(v, null), I(y, ""));
	});
	function ge(e) {
		return `${Q(e)} item${e === 1 ? "" : "s"}`;
	}
	function j(e) {
		let t = H(pe).get(e);
		return t === void 0 ? 0 : H(fe) <= 1 ? 50 : t / (H(fe) - 1) * 100;
	}
	function _e(e, n, r) {
		if (e.detail === 0) {
			t.onSelectItem(n);
			return;
		}
		let i = e.currentTarget.closest(".track")?.getBoundingClientRect(), a = i && i.width > 0 ? tc(H(ue), r, (e.clientX - i.left) / i.width) : null;
		a === null ? t.onSelectItem(n) : t.onSelectItem(n, a);
	}
	function M(e, t, n = !1, r = !1) {
		let i = H(fe) <= 1 ? 8 : Math.min(2.2, 35 / Math.max(1, H(fe) - 1)), a = n ? ve(e.startCall) : Math.max(0, j(e.startCall) - i), o = r ? ve(e.endCall + 1) : Math.min(100, j(e.endCall) + i);
		return `left:${a}%;width:${Math.max(1, o - a)}%;background-color:${t}`;
	}
	function ve(e) {
		let t = H(ue)[0] ?? 1;
		if (e > (H(ue)[H(ue).length - 1] ?? 0)) return 100;
		let n = j(e), r = j(e - 1);
		return e <= t ? Math.max(0, n - 1) : (n + r) / 2;
	}
	function ye(e) {
		return H(ee).get(e.id) ?? xe(e);
	}
	function xe(e) {
		return Fo(e, "Unlabelled item");
	}
	function Se(e, t) {
		return H(k)(e).some((e) => e.id === t);
	}
	function Ce(e) {
		return t.indexed.versionByItemId.get(e)?.firstId ?? e;
	}
	function we(e) {
		let t = [];
		for (let n of H(k)(e).flatMap((e) => e.presence)) {
			let e = t[t.length - 1];
			e && n.startCall === e.endCall + 1 ? t[t.length - 1] = {
				...e,
				endCall: n.endCall
			} : t.push(n);
		}
		return t;
	}
	function Te(e) {
		let t = we(e);
		if (t.length === 0) return "No model-call presence";
		let n = H(k)(e).length, r = n > 1 ? ` · ${n} versions` : "";
		return `Present at ${t.map((e) => e.startCall === e.endCall ? `call ${e.startCall}` : `calls ${e.startCall}–${e.endCall}`).join(", ")}${r}`;
	}
	function Ee(e) {
		return H(k)(e).reduce((e, t) => e + t.tokenTurnsCoverage.coveredCalls, 0);
	}
	function De(e) {
		return H(k)(e).reduce((e, t) => e + t.tokenTurnsCoverage.totalCalls, 0);
	}
	function Oe(e, n) {
		return (t.indexed.compactionBySourceId.get(e) ?? []).some((e) => e.beforeModelCall === n.endCall + 1);
	}
	function ke() {
		return `Full-session call axis ${H(ue).length === 0 ? "this session has no model calls" : `from call ${H(ue)[0]} to ${H(ue)[H(ue).length - 1]}; ticks ${H(de).join(", ")}`}; dashed markers show compaction boundaries${o() === null ? "" : `; solid vertical marker shows pinned call ${o()}`}; independent of chart zoom`;
	}
	function Ae() {
		I(u, ""), I(d, "all"), I(f, "all"), I(p, ""), I(y, "");
	}
	function je(e) {
		return `lifespan-item-${encodeURIComponent(e)}`;
	}
	async function Me(e = _) {
		if (!x || e !== _ || !H(v)) return;
		let t = Ce(H(v)), n = H(re).findIndex((e) => e.id === t);
		if (n >= H(h) && (I(h, Math.ceil((n + 1) / 50) * 50), await gr(), !x || e !== _)) return;
		let r = [...H(b)?.querySelectorAll("[data-lifespan-item-id]") ?? []].find((e) => e.dataset.lifespanItemId === t);
		r ? (r.scrollIntoView({ block: "center" }), r.focus({ preventScroll: !0 }), I(y, "")) : (I(y, "The selected item is hidden by current lifespan filters."), gr().then(() => {
			let e = H(b)?.querySelector(".find-status button");
			e?.scrollIntoView({ block: "center" }), e?.focus();
		}));
	}
	async function Ne() {
		Ae(), await gr(), await Me();
	}
	function Pe() {
		I(h, H(h) + 50);
	}
	var Fe = Kc(), Ie = L(Fe), Le = L(Ie), Re = B(L(Le), 2), ze = z(L(Re));
	N(Re);
	var He = B(Re, 2), Ue = (e) => {
		var t = yc(), n = z(t);
		V((e, t) => K(n, `${e ?? ""} of ${t ?? ""} items`), [() => Q(H(ie)), () => Q(H(S).length)]), G(e, t);
	};
	q(He, (e) => {
		H(le) && e(Ue);
	}), N(Le);
	var We = B(Le, 2), Ge = (e) => {
		var r = Gc();
		{
			let e = (e) => {
				var t = Sc(), n = L(t), r = B(L(n), 2);
				Ai(r), Y(r, "maxlength", 120), N(n);
				var i = B(n, 2), a = B(L(i), 2), s = L(a);
				s.value = s.__value = "all", J(B(s), 16, () => H(se), (e) => e, (e, t) => {
					var n = bc(), r = z(n, !0), i = {};
					V((e) => {
						K(r, e), i !== (i = t) && (n.value = (n.__value = i) ?? "");
					}, [() => Mo(t)]), G(e, n);
				}), N(a), Ci(a), N(i);
				var c = B(i, 2), l = B(L(c), 2), p = L(l);
				p.value = p.__value = "tokenTurns";
				var h = B(p);
				h.value = h.__value = "size";
				var g = B(h);
				g.value = g.__value = "firstAppearance";
				var _ = B(g);
				_.value = _.__value = "presenceCount", N(l), Ci(l), N(c);
				var v = B(c, 2), y = B(L(v), 2), b = L(y);
				b.value = b.__value = "all";
				var x = B(b), S = z(x);
				x.value = x.__value = "presentAtPin", N(y), Ci(y), N(v);
				var ee = B(v, 2), w = (e) => {
					var t = xc();
					U("click", t, Ae), G(e, t);
				};
				q(ee, (e) => {
					H(le) && e(w);
				}), N(t), V(() => {
					h.disabled = H(C) === null, x.disabled = o() === null, K(S, `Present at call ${o() ?? "(pin a call first)" ?? ""}`);
				}), Pi(r, () => H(u), (e) => I(u, e)), wi(a, () => H(d), (e) => I(d, e)), wi(l, () => H(m), (e) => I(m, e)), wi(y, () => H(f), (e) => I(f, e)), G(e, t);
			};
			var i = L(r), s = (t) => {
				var n = Cc(), r = L(n);
				{
					let t = /* @__PURE__ */ P(() => H(ce) > 0 ? `Filter and sort (${H(ce)})` : "Filter and sort");
					Gs(r, {
						get label() {
							return H(t);
						},
						children: (t, n) => {
							e(t);
						},
						$$slots: { default: !0 }
					});
				}
				N(n), G(t, n);
			}, l = (t) => {
				e(t);
			};
			q(i, (e) => {
				c() ? e(s) : e(l, -1);
			});
			var h = B(i, 2), g = L(h), _ = z(B(L(g)), !0);
			N(g);
			var b = B(g, 2), x = (e) => {
				var t = wc(), n = z(t);
				V(() => {
					t.disabled = H(f) === "presentAtPin", K(n, `Show items present at call ${o() ?? ""}`);
				}), U("click", t, () => I(f, "presentAtPin")), G(e, t);
			}, ee = (e) => {
				G(e, Tc());
			};
			q(b, (e) => {
				o() === null ? e(ee, -1) : e(x);
			}), N(h);
			var w = B(h, 2), E = (e) => {
				var t = Ec(), n = z(t, !0);
				V(() => K(n, H(p))), G(e, t);
			};
			q(w, (e) => {
				H(p) && e(E);
			});
			var D = B(w, 2), O = (e) => {
				var n = Oc(), r = L(n), i = B(r), a = (e) => {
					var t = Dc();
					U("click", t, Ne), G(e, t);
				}, o = /* @__PURE__ */ P(() => H(v) && t.indexed.itemById.has(H(v)));
				q(i, (e) => {
					H(o) && e(a);
				}), N(n), V(() => K(r, `${H(y) ?? ""} `)), G(e, n);
			};
			q(D, (e) => {
				H(y) && e(O);
			});
			var te = B(D, 2), A = (e) => {
				var t = kc(), n = z(t);
				V(() => K(n, `Size uses one shared profile (${H(T) ?? ""}); items without a numeric estimate for
            it sort last.`)), G(e, t);
			};
			q(te, (e) => {
				H(m) === "size" && e(A);
			});
			var ne = B(te, 2), ie = (e) => {
				G(e, Ac());
			};
			q(ne, (e) => {
				H(he) && e(ie);
			});
			var ue = B(ne, 4), fe = B(L(ue), 2), pe = L(fe), Ce = (e) => {
				var t = jc(), n = z(L(t), !0);
				N(t), V(() => {
					yi(t, `left:${H(me)}%`), K(n, o());
				}), G(e, t);
			};
			q(pe, (e) => {
				H(me) !== null && e(Ce);
			});
			var we = B(pe, 2);
			J(we, 19, () => H(de), (e) => `tick:${e}`, (e, t, n) => {
				var r = Mc();
				let i;
				var a = z(r, !0);
				V((e) => {
					i = _i(r, 1, "axis-tick svelte-1pk7niq", null, i, {
						first: H(n) === 0,
						last: H(n) === H(de).length - 1,
						center: H(de).length === 1
					}), yi(r, e), K(a, H(t));
				}, [() => `left:${j(H(t))}%`]), G(e, r);
			}), J(B(we, 2), 17, () => t.indexed.analysis.compactions, (e) => e.id, (e, t) => {
				var n = Nc();
				V((e) => yi(n, e), [() => `left:${ve(H(t).beforeModelCall)}%`]), G(e, n);
			}), N(fe), be(2), N(ue);
			var Me = B(ue, 2), Fe = (e) => {
				G(e, Pc());
			}, Ie = (e) => {
				G(e, Fc());
			}, Le = (e) => {
				var r = Wc(), i = R(r);
				J(i, 21, () => H(ae), (e) => e.id, (e, r) => {
					let i = /* @__PURE__ */ P(() => ye(H(r)));
					var o = Hc();
					let s;
					var c = L(o), l = L(c), u = B(l, 2), d = L(u);
					let f;
					var p = z(d, !0), m = z(B(d, 2));
					N(u), N(c);
					var h = B(c, 2), g = L(h), _ = (e) => {
						var t = Ic();
						V(() => yi(t, `left:${H(me)}%`)), G(e, t);
					};
					q(g, (e) => {
						H(me) !== null && e(_);
					});
					var v = B(g, 2);
					J(v, 17, () => t.indexed.analysis.compactions, (e) => e.id, (e, t) => {
						var n = Lc();
						V((e) => yi(n, e), [() => `left:${ve(H(t).beforeModelCall)}%`]), G(e, n);
					}), J(B(v, 2), 19, () => H(k)(H(r)), (e) => e.id, (e, o, s) => {
						let c = /* @__PURE__ */ P(() => H(k)(H(r)).length > 1 ? `${xe(H(r))} version ${H(s) + 1}` : xe(H(r)));
						var l = Bc(), u = R(l);
						J(u, 19, () => H(o).presence, (e, t) => `${H(o).id}:${t}`, (e, l, u) => {
							let d = /* @__PURE__ */ P(() => H(u) === H(o).presence.length - 1 && H(k)(H(r))[H(s) + 1]?.firstModelCall === H(l).endCall + 1), f = /* @__PURE__ */ P(() => H(u) === 0 && H(s) > 0 && H(k)(H(r))[H(s) - 1]?.lastModelCall === H(l).startCall - 1);
							var p = Rc();
							let m;
							V((e, t, n) => {
								m = _i(p, 1, "segment svelte-1pk7niq", null, m, {
									compacted: e,
									"replaced-after": H(d),
									"replaces-before": H(f)
								}), Y(p, "aria-label", `${H(c)}, calls ${H(l).startCall} through ${H(l).endCall}`), Y(p, "aria-pressed", a() === H(o).id), Y(p, "title", t), yi(p, n);
							}, [
								() => Oe(H(o).id, H(l)),
								() => `${H(c) === xe(H(r)) ? H(i) : H(c)}: calls ${H(l).startCall}–${H(l).endCall}`,
								() => M(H(l), Ta(t.indexed, H(r).id, n()), H(f), H(d))
							]), Or("pointerenter", p, (e) => t.onHoverItem(H(o).id, e)), U("pointermove", p, (e) => t.onHoverItem(H(o).id, e)), Or("pointerleave", p, () => t.onHoverItem(null)), U("click", p, (e) => _e(e, H(o).id, H(l))), G(e, p);
						});
						var d = B(u, 2), f = (e) => {
							var t = zc();
							V((e) => yi(t, e), [() => `left:${ve(H(o).firstModelCall)}%`]), G(e, t);
						};
						q(d, (e) => {
							H(s) > 0 && e(f);
						}), G(e, l);
					}), N(h);
					var y = B(h, 2), b = L(y), x = B(b), S = (e) => {
						var t = Vc(), n = z(t);
						V((e) => K(n, `${e ?? ""} calls covered`), [() => qa(Ee(H(r)), De(H(r)))]), G(e, t);
					}, ee = /* @__PURE__ */ P(() => Ee(H(r)) < De(H(r)));
					q(x, (e) => {
						H(ee) && e(S);
					}), N(y), N(o), V((e, t, n, a, u, h, g, _, v, x) => {
						Y(o, "id", e), s = _i(o, 1, "row svelte-1pk7niq", null, s, { selected: t }), Y(o, "aria-label", n), Y(o, "data-lifespan-item-id", H(r).id), Y(c, "title", a), yi(l, u), f = _i(d, 1, "item-label svelte-1pk7niq", null, f, { "terminal-item": H(r).presence.length === 0 }), Y(d, "aria-label", h), K(p, H(i)), K(m, `${g ?? ""} · ${_ ?? ""}`), Y(y, "title", v), K(b, `${x ?? ""} `);
					}, [
						() => je(H(r).id),
						() => Se(H(r), a()),
						() => `${xe(H(r))}; ${Mo(H(r).kind)}; ${Te(H(r))}`,
						() => xe(H(r)),
						() => `background:${Ta(t.indexed, H(r).id, n())}`,
						() => `Select ${xe(H(r))}${H(r).presence.length === 0 ? "; no model-call presence" : ""}`,
						() => Mo(H(r).kind),
						() => Te(H(r)),
						() => `${sc(H(k)(H(r)))} calls; ${qa(Ee(H(r)), De(H(r)))} tokenized`,
						() => Ka(oc(H(k)(H(r))), "calculatedTokens")
					]), U("click", d, () => t.onSelectItem(H(r).id)), G(e, o);
				}), N(i);
				var o = B(i, 2), s = (e) => {
					var t = Uc(), n = L(t), r = z(n), i = B(n, 2), a = z(i);
					N(t), V((e, t, n) => {
						K(r, `Showing ${e ?? ""} of ${t ?? ""}`), K(a, `Show ${n ?? ""} more`);
					}, [
						() => Q(H(ae).length),
						() => ge(H(re).length),
						() => Q(Math.min(50, H(oe)))
					]), U("click", i, Pe), G(e, t);
				};
				q(o, (e) => {
					H(oe) > 0 && e(s);
				}), G(e, r);
			};
			q(Me, (e) => {
				H(S).length === 0 ? e(Fe) : H(re).length === 0 ? e(Ie, 1) : e(Le, -1);
			}), N(r), V((e) => {
				K(_, H(f) === "all" ? "Whole session" : `Present at call ${o()}`), Y(fe, "aria-label", e);
			}, [() => ke()]);
		}
		G(e, r);
	};
	q(We, (e) => {
		H(g) && e(Ge);
	}), N(Ie), N(Fe), Ri(Fe, (e) => I(b, e), () => H(b)), V((e) => K(ze, `Context lifespans · ${e ?? ""}`), [() => ge(H(S).length)]), zi("open", "toggle", Ie, (e) => I(g, e), () => H(g)), G(e, Fe), Ve(), i();
}
kr(["click", "pointermove"]);
//#endregion
//#region node_modules/d3-shape/src/constant.js
function Yc(e) {
	return function() {
		return e;
	};
}
//#endregion
//#region node_modules/d3-path/src/path.js
var Xc = Math.PI, Zc = 2 * Xc, Qc = 1e-6, $c = Zc - Qc;
function el(e) {
	this._ += e[0];
	for (let t = 1, n = e.length; t < n; ++t) this._ += arguments[t] + e[t];
}
function tl(e) {
	let t = Math.floor(e);
	if (!(t >= 0)) throw Error(`invalid digits: ${e}`);
	if (t > 15) return el;
	let n = 10 ** t;
	return function(e) {
		this._ += e[0];
		for (let t = 1, r = e.length; t < r; ++t) this._ += Math.round(arguments[t] * n) / n + e[t];
	};
}
var nl = class {
	constructor(e) {
		this._x0 = this._y0 = this._x1 = this._y1 = null, this._ = "", this._append = e == null ? el : tl(e);
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
		else if (d > Qc) {
			if (!(Math.abs(u * s - c * l) > Qc) || !i) this._append`L${this._x1 = e},${this._y1 = t}`;
			else {
				let f = n - a, p = r - o, m = s * s + c * c, h = f * f + p * p, g = Math.sqrt(m), _ = Math.sqrt(d), v = i * Math.tan((Xc - Math.acos((m + d - h) / (2 * g * _))) / 2), y = v / _, b = v / g;
				Math.abs(y - 1) > Qc && this._append`L${e + y * l},${t + y * u}`, this._append`A${i},${i},0,0,${+(u * f > l * p)},${this._x1 = e + b * s},${this._y1 = t + b * c}`;
			}
		}
	}
	arc(e, t, n, r, i, a) {
		if (e = +e, t = +t, n = +n, a = !!a, n < 0) throw Error(`negative radius: ${n}`);
		let o = n * Math.cos(r), s = n * Math.sin(r), c = e + o, l = t + s, u = 1 ^ a, d = a ? r - i : i - r;
		this._x1 === null ? this._append`M${c},${l}` : (Math.abs(this._x1 - c) > Qc || Math.abs(this._y1 - l) > Qc) && this._append`L${c},${l}`, n && (d < 0 && (d = d % Zc + Zc), d > $c ? this._append`A${n},${n},0,1,${u},${e - o},${t - s}A${n},${n},0,1,${u},${this._x1 = c},${this._y1 = l}` : d > Qc && this._append`A${n},${n},0,${+(d >= Xc)},${u},${this._x1 = e + n * Math.cos(i)},${this._y1 = t + n * Math.sin(i)}`);
	}
	rect(e, t, n, r) {
		this._append`M${this._x0 = this._x1 = +e},${this._y0 = this._y1 = +t}h${n = +n}v${+r}h${-n}Z`;
	}
	toString() {
		return this._;
	}
};
nl.prototype;
//#endregion
//#region node_modules/d3-shape/src/path.js
function rl(e) {
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
	}, () => new nl(t);
}
Array.prototype.slice;
function il(e) {
	return typeof e == "object" && "length" in e ? e : Array.from(e);
}
//#endregion
//#region node_modules/d3-shape/src/curve/linear.js
function al(e) {
	this._context = e;
}
al.prototype = {
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
function ol(e) {
	return new al(e);
}
//#endregion
//#region node_modules/d3-shape/src/point.js
function sl(e) {
	return e[0];
}
function cl(e) {
	return e[1];
}
//#endregion
//#region node_modules/d3-shape/src/line.js
function ll(e, t) {
	var n = Yc(!0), r = null, i = ol, a = null, o = rl(s);
	e = typeof e == "function" ? e : e === void 0 ? sl : Yc(e), t = typeof t == "function" ? t : t === void 0 ? cl : Yc(t);
	function s(s) {
		var c, l = (s = il(s)).length, u, d = !1, f;
		for (r ?? (a = i(f = o())), c = 0; c <= l; ++c) !(c < l && n(u = s[c], c, s)) === d && ((d = !d) ? a.lineStart() : a.lineEnd()), d && a.point(+e(u, c, s), +t(u, c, s));
		if (f) return a = null, f + "" || null;
	}
	return s.x = function(t) {
		return arguments.length ? (e = typeof t == "function" ? t : Yc(+t), s) : e;
	}, s.y = function(e) {
		return arguments.length ? (t = typeof e == "function" ? e : Yc(+e), s) : t;
	}, s.defined = function(e) {
		return arguments.length ? (n = typeof e == "function" ? e : Yc(!!e), s) : n;
	}, s.curve = function(e) {
		return arguments.length ? (i = e, r != null && (a = i(r)), s) : i;
	}, s.context = function(e) {
		return arguments.length ? (e == null ? r = a = null : a = i(r = e), s) : r;
	}, s;
}
//#endregion
//#region node_modules/d3-shape/src/area.js
function ul(e, t, n) {
	var r = null, i = Yc(!0), a = null, o = ol, s = null, c = rl(l);
	e = typeof e == "function" ? e : e === void 0 ? sl : Yc(+e), t = typeof t == "function" ? t : Yc(t === void 0 ? 0 : +t), n = typeof n == "function" ? n : n === void 0 ? cl : Yc(+n);
	function l(l) {
		var u, d, f, p = (l = il(l)).length, m, h = !1, g, _ = Array(p), v = Array(p);
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
		return ll().defined(i).curve(o).context(a);
	}
	return l.x = function(t) {
		return arguments.length ? (e = typeof t == "function" ? t : Yc(+t), r = null, l) : e;
	}, l.x0 = function(t) {
		return arguments.length ? (e = typeof t == "function" ? t : Yc(+t), l) : e;
	}, l.x1 = function(e) {
		return arguments.length ? (r = e == null ? null : typeof e == "function" ? e : Yc(+e), l) : r;
	}, l.y = function(e) {
		return arguments.length ? (t = typeof e == "function" ? e : Yc(+e), n = null, l) : t;
	}, l.y0 = function(e) {
		return arguments.length ? (t = typeof e == "function" ? e : Yc(+e), l) : t;
	}, l.y1 = function(e) {
		return arguments.length ? (n = e == null ? null : typeof e == "function" ? e : Yc(+e), l) : n;
	}, l.lineX0 = l.lineY0 = function() {
		return u().x(e).y(t);
	}, l.lineY1 = function() {
		return u().x(e).y(n);
	}, l.lineX1 = function() {
		return u().x(r).y(t);
	}, l.defined = function(e) {
		return arguments.length ? (i = typeof e == "function" ? e : Yc(!!e), l) : i;
	}, l.curve = function(e) {
		return arguments.length ? (o = e, a != null && (s = o(a)), l) : o;
	}, l.context = function(e) {
		return arguments.length ? (e == null ? a = s = null : s = o(a = e), l) : a;
	}, l;
}
//#endregion
//#region node_modules/d3-shape/src/curve/monotone.js
function dl(e) {
	return e < 0 ? -1 : 1;
}
function fl(e, t, n) {
	var r = e._x1 - e._x0, i = t - e._x1, a = (e._y1 - e._y0) / (r || i < 0 && -0), o = (n - e._y1) / (i || r < 0 && -0), s = (a * i + o * r) / (r + i);
	return (dl(a) + dl(o)) * Math.min(Math.abs(a), Math.abs(o), .5 * Math.abs(s)) || 0;
}
function pl(e, t) {
	var n = e._x1 - e._x0;
	return n ? (3 * (e._y1 - e._y0) / n - t) / 2 : t;
}
function ml(e, t, n) {
	var r = e._x0, i = e._y0, a = e._x1, o = e._y1, s = (a - r) / 3;
	e._context.bezierCurveTo(r + s, i + s * t, a - s, o - s * n, a, o);
}
function hl(e) {
	this._context = e;
}
hl.prototype = {
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
			case 3: ml(this, this._t0, pl(this, this._t0));
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
					this._point = 3, ml(this, pl(this, n = fl(this, e, t)), n);
					break;
				default: ml(this, this._t0, n = fl(this, e, t));
			}
			this._x0 = this._x1, this._x1 = e, this._y0 = this._y1, this._y1 = t, this._t0 = n;
		}
	}
}, Object.create(hl.prototype).point = function(e, t) {
	hl.prototype.point.call(this, t, e);
};
function gl(e) {
	return new hl(e);
}
//#endregion
//#region src/lib/context-river/reported-input.ts
function _l(e, t) {
	if (e.analysis.displayWeightUnit === "unavailable" || t.stopReason?.endsWith("-aggregate") || t.reportedUsageCompleteness !== "complete") return null;
	let n = t.reportedPromptTokens, r = t.tokenAnalysis.calculatedVisibleTokens;
	return n === null || r === null || !t.tokenizationProfileId || !Number.isSafeInteger(n) || n < 0 || !Number.isSafeInteger(r) || r < 0 ? null : {
		callIndex: t.index,
		reconstructed: r,
		reported: n,
		gap: Math.max(0, n - r)
	};
}
function vl(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let r of t) {
		let t = e.callByIndex.get(r.callIndex), i = t ? _l(e, t) : null;
		!i || !Number.isSafeInteger(r.totalDisplayWeight) || r.totalDisplayWeight < 0 || r.totalDisplayWeight !== i.reconstructed || n.set(i.callIndex, i);
	}
	return n;
}
function yl(e) {
	let t = [], n = null, r = 0;
	for (let i of e.analysis.modelCalls) {
		let a = _l(e, i);
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
function bl(e, t) {
	return e.map((e) => ({
		...e,
		totalDisplayWeight: Math.max(e.totalDisplayWeight, t.get(e.callIndex)?.reported ?? 0)
	}));
}
function xl(e, t, n, r) {
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
	let o = n.height - n.margin.bottom, s = Math.max(0, o - n.margin.top), c = (e) => o - s * e / Math.max(1, r), l = ll().x((e) => e.x).y((e) => c(e.reported)).curve(ol), u = ul().x((e) => e.x).y0(o).y1((e) => c(e.reported)).curve(ol);
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
function Sl(e, t) {
	if (new Set(e).size !== e.length) throw new $(`Duplicate ${t}`);
}
function Cl(e, t) {
	if (e !== null && (!Number.isSafeInteger(e) || e < 0)) throw new $(`${t} is not a safe non-negative integer`);
}
//#endregion
//#region src/lib/reconstruction.ts
var wl = "Showing what the chat session file recorded. Per-call timing and detailed token usage are unavailable; system prompt and tool definition details may be incomplete.", Tl = {
	traceRecordsUnavailable: {
		title: "No matching call traces",
		detail: wl
	},
	traceRecordsIncomplete: {
		title: "Some calls have no matching trace",
		detail: "For those calls, the chat session file supplies what it recorded. Timing and detailed token usage are unavailable, and system prompt and tool definition details may be incomplete."
	},
	traceRecordsUnreadable: {
		title: "Could not read the Copilot trace database",
		detail: wl
	}
};
function El(e) {
	if (e.session.source !== "vscode-copilot") return null;
	let t = e.reconstruction?.explanationCodes ?? [];
	for (let e of [
		"traceRecordsUnreadable",
		"traceRecordsUnavailable",
		"traceRecordsIncomplete"
	]) if (t.includes(e)) return {
		...Tl[e],
		unreadable: e === "traceRecordsUnreadable"
	};
	return null;
}
var Dl = {
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
	traceRecordsIncomplete: Tl.traceRecordsIncomplete.title + ". " + Tl.traceRecordsIncomplete.detail,
	traceRecordsUnavailable: Tl.traceRecordsUnavailable.title + ". Showing what the chat session file recorded. Per-call timing and detailed token usage are unavailable; system prompt and tool definition details may be incomplete.",
	traceRecordsUnreadable: Tl.traceRecordsUnreadable.title + ". Showing what the chat session file recorded. Per-call timing and detailed token usage are unavailable; system prompt and tool definition details may be incomplete.",
	subagentCallsNotShown: "Subagents' model calls are recorded in the session's file but are not shown.",
	repairedCompactionLink: "A compaction marker named a later or missing record as its predecessor; the conversation was continued from the record before the marker."
}, Ol = /* @__PURE__ */ new Set([
	"opencode",
	"claude-code",
	"codex",
	"copilot",
	"vscode-copilot"
]);
function kl(e) {
	let t = e.reconstruction;
	if ((t !== void 0 || Ol.has(e.session.source)) && (!t || t.status !== "partial" || !Array.isArray(t.explanationCodes) || t.explanationCodes.length === 0 || t.explanationCodes.length > 32 || t.explanationCodes.some((e) => typeof e != "string" || !Object.prototype.hasOwnProperty.call(Dl, e)) || new Set(t.explanationCodes).size !== t.explanationCodes.length)) throw new $("Analysis has invalid or missing source reconstruction coverage");
}
//#endregion
//#region src/lib/estimate-quality.ts
var Al = .02, jl = .1, Ml = {
	modelTokenizer: "Tokens are counted with the model's own tokenizer.",
	apiSerializationEstimate: "Tokens are counted with a reconstruction of the model's tokenizer, and the request format around them is estimated.",
	characterHeuristic: "Some tokens are estimated from character counts, which is rough."
}, Nl = {
	tokenizationDisabled: "Token counting is turned off for this server.",
	"one-or-more-context-items-unavailable": "Some context items have no content to count."
};
function Pl(e) {
	let { session: t } = e.analysis;
	if (t.reconciliationComparableCalls > 0 && t.medianAbsoluteResidualPercent !== null) {
		let e = t.medianAbsoluteResidualPercent;
		return {
			share: e,
			lead: `On median, the River's totals differ from the input the provider reported by ${Ha(e)}, across ${Q(t.reconciliationComparableCalls)} calls.`
		};
	}
	let n = yl(e);
	if (n.medianGapShare === null) return null;
	let r = n.maximumGap === null ? "" : ` The largest gap is ${Z(n.maximumGap)} tokens.`;
	return {
		share: n.medianGapShare,
		lead: `On median, the River's totals differ from the input the provider reported by ${Ha(n.medianGapShare)}, across ${Q(n.comparedCalls)} calls.${r}`
	};
}
function Fl(e) {
	let [t, ...n] = e.modelCalls;
	return !t || n.length === 0 ? /* @__PURE__ */ new Set() : new Set(t.tokenAnalysis.explanationCodes.filter((e) => n.every((t) => t.tokenAnalysis.explanationCodes.includes(e))));
}
function Il(e, t) {
	return e === "heuristicTokenizer" || e === "estimatedProviderSerialization" || e === "knownFramingOverheadAvailable" ? !0 : e === "missingSystemPrompt" || e === "missingToolDefinitions" ? t.contextItems.some((e) => e.kind === "unrecordedContext") || (t.reconstruction?.explanationCodes ?? []).some((e) => e.startsWith("missingHistorical")) : !1;
}
function Ll(e) {
	let { analysis: t } = e, { tokenAnalysis: n } = t, r = (t.reconstruction?.explanationCodes ?? []).map((e) => Dl[e]).filter((e) => !!e);
	if (t.displayWeightUnit === "unavailable") {
		let e = Nl[n.fallbackReason ?? ""];
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
		let t = Ml[e];
		t && r.push(t);
	}
	for (let e of Fl(t)) {
		let n = zo(e);
		n && !Il(e, t) && r.push(`${n.title}. ${n.impact}`);
	}
	let o = Pl(e), s, c;
	if (o) s = o.share <= Al ? "good" : o.share <= jl ? "partial" : "rough", c = o.lead;
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
var Rl = {
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
}, zl = {
	...Rl.unknown,
	basisLabel: "None: Claude Code records no cost",
	note: "Claude Code records token usage but no cost for each call, so costs are calculated from the price table.",
	trackCaveat: "no recorded cost"
}, Bl = {
	...Rl.unknown,
	basisLabel: "None: Codex records no cost",
	note: "Codex records token usage but no cost for each call, so costs are calculated from the price table.",
	trackCaveat: "no recorded cost"
}, Vl = {
	...Rl.unknown,
	label: "Copilot-recorded cost",
	totalLabel: "Copilot-recorded cost total",
	basisLabel: "Copilot credits, at $0.01 a credit",
	note: "Copilot records what it charged for each call in credits, in its trace database, and for each request in the session file. Calls without a record are priced from the price table.",
	trackCaveat: "recorded by Copilot"
}, Hl = {
	...Vl,
	note: "Copilot records what it charged for each call in credits, in the session file. Calls without a record are priced from the price table."
};
function Ul(e, t) {
	return t === "claude-code" ? zl : t === "codex" ? Bl : t === "vscode-copilot" ? Vl : t === "copilot" ? Hl : Rl[e] ?? Rl.unknown;
}
function Wl(e) {
	return e === "pi";
}
function Gl(e) {
	return Wl(e) ? "Pi-normalized" : "Source-normalized";
}
//#endregion
//#region src/lib/economics.ts
var Kl = {
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
function ql(e, t = "piModelRates", n = "pi") {
	if (!Object.prototype.hasOwnProperty.call(Kl, e)) return null;
	let r = Kl[e];
	if (e === "cacheWriteNotRetainedByPi" && !Wl(n)) return {
		title: "Source did not retain cache-write detail",
		impact: "The source normalizes cache writes to zero and may drop upstream write tokens; this is not a measured zero."
	};
	if (e === "piCostComponentsIncomplete" || e === "piCostMissing" || e === "piCostTotalDiffersFromComponents") {
		let n = Ul(t), i = n.label;
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
		impact: Ul(t, n).note
	};
	if (e === "piModelRateCostBasis" || e === "sourceModelRateCostBasis" || e === "providerReportedCostBasis" || e === "unknownCostBasis") {
		let e = Ul(t);
		return {
			title: `Cost uses ${e.basisLabel.toLowerCase()}`,
			impact: t === "piModelRates" ? "This is a calculation from configured model rates, not a provider invoice or exact billed charge." : e.note
		};
	}
	return r;
}
//#endregion
//#region src/lib/session-label.ts
var Jl = new Intl.DateTimeFormat(void 0, {
	day: "numeric",
	month: "short",
	hour: "numeric",
	minute: "2-digit"
}), Yl = new Intl.DateTimeFormat(void 0, {
	day: "numeric",
	month: "short",
	year: "numeric",
	hour: "numeric",
	minute: "2-digit"
});
new Intl.NumberFormat(void 0, { maximumFractionDigits: 1 });
function Xl(e, t = /* @__PURE__ */ new Date()) {
	if (!e) return null;
	let n = new Date(e);
	return Number.isNaN(n.getTime()) ? null : (n.getFullYear() === t.getFullYear() ? Jl : Yl).format(n);
}
//#endregion
//#region src/lib/cost-assessment.ts
function Zl(e) {
	return e === "pi" ? "Pi" : e === "opencode" ? "OpenCode" : e === "claude-code" ? "Claude Code" : e === "codex" ? "Codex" : e === "vscode-copilot" ? "VS Code Copilot" : e === "copilot" ? "Copilot" : "the harness";
}
function Ql(e, t) {
	return ["claude-code", "codex"].includes(t) && e.classificationRule === "billingModeTable";
}
function $l(e, t) {
	if (e.kind === "apiEquivalent" && Ql(e, t)) return "API rate";
	switch (e.kind) {
		case "recorded": return "Recorded";
		case "estimated": return "Estimated";
		case "apiEquivalent": return "API-equivalent";
		case "free": return "Free";
		default: return "Unknown";
	}
}
function eu(e, t, n) {
	let r = n(e), i = t === null ? r : n(t);
	return r === i ? r : `${r}–${i}`;
}
function tu(e) {
	if (e.amount === null) return "Unknown";
	let t = eu(e.amount, e.amountHigh, (e) => Ba(e));
	return e.kind === "estimated" || e.kind === "apiEquivalent" ? `≈ ${t}` : t;
}
function nu(e, t) {
	if (e.low === null) return "Unknown";
	let n = eu(e.low, e.high, (e) => Va(e));
	return t || e.high !== e.low ? `≈ ${n}` : n;
}
var ru = new Intl.DateTimeFormat("en-AU", {
	day: "numeric",
	month: "short",
	year: "numeric",
	timeZone: "UTC"
}), iu = {
	documented: "date from the provider",
	firstObserved: "date first seen on the provider's pricing page",
	modelsDevCommit: "date recorded by models.dev, which may lag the provider"
};
function au(e) {
	let t = e.rate;
	if (!t) return null;
	let n = t.validFrom ? `from ${ru.format(new Date(t.validFrom))}` : "its first listed rate";
	return `${e.kind === "apiEquivalent" ? `${t.provider} API rate` : `${t.provider} rate`} for ${t.model}, ${n} (${iu[t.startBasis]})`;
}
function ou(e, t) {
	return e.kind === "recorded" || e.recordedByHarness === null || e.amount !== null && e.amountHigh === null && e.recordedByHarness === e.amount ? null : `Recorded by ${Zl(t)}: ${Ba(e.recordedByHarness)}`;
}
function su(e, t) {
	let n = Zl(t);
	switch (e.classificationRule) {
		case "recordedCost": return t === "vscode-copilot" || t === "copilot" ? "Billed per token; this is what Copilot recorded charging, in credits at $0.01 each." : `Billed per token; this is the cost ${n} recorded.`;
		case "billingModeTable": return Ql(e, t) ? `At ${t === "codex" ? "OpenAI" : "Anthropic"}'s API rate.` : e.billingMode === "subscription" ? "This provider is covered by a subscription, so this is what the call would have cost at the API rate. It is not a charge." : e.kind === "free" ? "Billed per token, and the provider listed this model as free at the time." : `Billed per token. ${n} recorded no cost, so it is estimated at the provider's rate.`;
		case "opencodeZeroWithListedPrice": return "OpenCode recorded $0 although OpenAI listed a price, which happens when OpenCode signs in with a ChatGPT plan. Treated as a subscription: this is what the call would have cost at the API rate, not a charge.";
		case "perTokenDefault": return e.kind === "free" ? "The provider listed this model as free at the time." : `${n} recorded no cost, so it is estimated at the provider's rate.`;
		case "failedAttempt": return "The attempt failed; its recorded zeros are not a measurement, so no cost is shown.";
		case "missingTime": return "The call has no time to choose a price by.";
		case "noPrice": return "No price is known for this model at the time.";
		case "missingUsage": return "Token counts needed to estimate the cost were not recorded.";
	}
}
var cu = "A range because the harness did not record whether its output count already includes reasoning tokens.";
function lu(e) {
	let t = [e.billed, e.apiEquivalent].filter((e) => e.calls > 0);
	if (t.length === 0) return null;
	let n = (e) => t.some((t) => t[e] === null) ? null : t.reduce((t, n) => t + (n[e] ?? 0), 0), r = {
		low: n("low"),
		high: n("high"),
		calls: t.reduce((e, t) => e + t.calls, 0)
	};
	return {
		label: "Cost",
		value: nu(r, !0),
		note: ((e) => `${e.toLocaleString("en-AU")} call${e === 1 ? "" : "s"}`)(r.calls),
		title: "At API rates: the cost the harness recorded, or an estimate at the provider’s rate. Calls covered by a subscription are priced at what they would have cost. Not an invoice.",
		split: t.length === 2 ? `${nu(e.billed, !0)} billed per token · ${nu(e.apiEquivalent, !0)} covered by a subscription` : null
	};
}
function uu(e) {
	let t = [];
	return e.unknownCalls > 0 && t.push(`${e.unknownCalls.toLocaleString("en-AU")} call${e.unknownCalls === 1 ? "" : "s"} without a price`), e.failedAttemptCalls > 0 && t.push(`${e.failedAttemptCalls.toLocaleString("en-AU")} failed attempt${e.failedAttemptCalls === 1 ? "" : "s"} not counted`), t.length ? t.join(" · ") : null;
}
function du(e, t, n = /* @__PURE__ */ new Date()) {
	if (t === "vscode-copilot") return "The credits Copilot recorded for every request, at $0.01 each, including calls with no matching trace";
	if (t === "copilot") return "The credits Copilot recorded at its last usage checkpoint, at $0.01 each";
	let r = e.sinceMs === null ? null : Xl(new Date(e.sinceMs).toISOString(), n), i = `includes subagents and ${Zl(t)}'s own calls, which are not in this transcript`;
	return r ? `Since ${r} · ${i}` : `Covers ${i.replace(/^includes /, "")}`;
}
//#endregion
//#region src/lib/recorded-usage.ts
var fu = {
	includesReasoning: "Recorded output includes reasoning",
	excludesReasoning: "Recorded output excludes reasoning",
	unknown: "Output/reasoning overlap not established"
};
function pu(e) {
	return fu[e];
}
function mu(e) {
	let t = [{
		label: "Recorded output",
		value: e.placeholder ? "Unavailable" : e.recordedOutput === null ? "Not recorded" : Z(e.recordedOutput)
	}];
	return (e.reasoning !== null || e.placeholder?.reasoning != null) && t.push({
		label: "Recorded reasoning",
		value: e.placeholder ? "Unavailable" : Z(e.reasoning)
	}), t;
}
function hu(e) {
	let { recordedCalls: t, failedAttemptCalls: n, missingCalls: r } = e, i = t + n + r;
	if (i === 0 || t === i) return null;
	let a = [`${Q(t)} of ${Q(i)} calls`];
	return n > 0 && a.push(`${Q(n)} failed attempt${n === 1 ? "" : "s"} not recorded`), a.join(" · ");
}
//#endregion
//#region src/lib/components/ItemContribution.svelte
var gu = /* @__PURE__ */ W("<span class=\"track svelte-jx5fif\" aria-hidden=\"true\"><span class=\"fill svelte-jx5fif\"></span></span>"), _u = /* @__PURE__ */ W("<span class=\"unknown svelte-jx5fif\" aria-hidden=\"true\">Share unavailable</span>"), vu = /* @__PURE__ */ W("<span><!> <span class=\"detail svelte-jx5fif\"> </span></span>"), yu = {
	hash: "svelte-jx5fif",
	code: ".track.svelte-jx5fif {display:block;height:3px;margin-top:6px;overflow:hidden;border-radius:var(--radius-small);background:var(--separator);}.fill.svelte-jx5fif {display:block;height:100%;background:var(--secondary);}.unknown.svelte-jx5fif,\n  .detail.svelte-jx5fif {display:block;margin-top:5px;color:var(--secondary);font-size:var(--text-xs);font-weight:normal;}.detail.svelte-jx5fif {display:none;}button:focus .detail.svelte-jx5fif {display:block;}"
};
function bu(e, t) {
	Be(t, !0), ui(e, yu);
	var n = vu(), r = L(n), i = (e) => {
		var n = gu(), r = L(n);
		let i;
		N(n), V(() => i = yi(r, "", i, { width: `${t.value.share * 100}%` })), G(e, n);
	}, a = (e) => {
		G(e, _u());
	};
	q(r, (e) => {
		t.value.share === null ? e(a, -1) : e(i);
	});
	var o = B(r, 2), s = z(o, !0);
	N(n), V(() => {
		Y(o, "id", t.descriptionId), K(s, t.value.detail);
	}), G(e, n), Ve();
}
//#endregion
//#region src/lib/economics-policy.ts
var xu = {
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
}, Su = /* @__PURE__ */ new Set([
	"anthropic-messages-cache-v1",
	"github-copilot-messages-cache-v1",
	"github-copilot-responses-cache-v1"
]), Cu = "openai-completions-cache-v1", wu = /* @__PURE__ */ new Set(["openai-responses-cache-read-v1", "openai-codex-responses-cache-read-v1"]), Tu = Object.fromEntries(Object.entries(xu).map(([e, t]) => [e, t.categories])), Eu = {
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
}, Du = [
	"cacheRead",
	"cacheWrite",
	"fresh",
	"uncached",
	"nonRead"
];
function Ou(e, t) {
	return `Cache-read share ${e.direction === "drop" ? "dropped" : "rose"} from ${Ua(e.previousRatio)} on call ${e.previousCallIndex} to ${Ua(e.currentRatio)} on call ${t}`;
}
function ku(e) {
	let t = e.modelCalls.map((t) => ju(t, e));
	return {
		points: t,
		maximum: t.reduce((e, t) => t.status === "complete" || t.status === "zero" ? Math.max(e, t.promptTokens ?? 0) : e, 0),
		presentation: Au(e, t)
	};
}
function Au(e, t = e.modelCalls.map((t) => ju(t, e))) {
	let n = [...new Set(e.modelCalls.map((e) => e.economics.policyId).filter((e) => e !== null && Tu[e] !== void 0))], r = new Map(t.map((e) => [e.callIndex, e])), i = Du.flatMap((t) => {
		let i = n.filter((e) => Tu[e]?.includes(t));
		if (i.length === 0) return [];
		let a = e.modelCalls.flatMap((e) => {
			if (!i.includes(e.economics.policyId ?? "")) return [];
			let t = r.get(e.index);
			return t ? [t] : [];
		}), o = a.length, s = a.filter((e) => (e.status === "complete" || e.status === "zero") && e.segments.some((e) => e.kind === t)).length, c = a.flatMap((e) => e.segments.filter((e) => e.kind === t).map((e) => e.value)), l = c.length > 0 && c.every((e) => e === 0), u = a.filter((e) => e.status === "missing").length, d = a.filter((e) => e.status === "partial").length, f = a.filter((e) => e.status === "unsupported").length, p, m = "";
		return t === "cacheWrite" && i.includes(Cu) ? (p = "notReported", m = "Chat Completions does not report a separate cache-write bucket.") : p = s === 0 ? f === o ? "unsupported" : u === o ? "missing" : u > 0 || d > 0 || f > 0 ? "partial" : "missing" : u > 0 || d > 0 || f > 0 || s < o ? "partial" : l ? "measuredZero" : "available", t === "nonRead" && (m = "Read-only Responses policies cannot establish a separate fresh/write split."), t === "cacheWrite" && i.some((e) => wu.has(e)) && (p = "notRetained", m = Wl(e.session.source) ? "The audited read-only policy does not establish separate cache-write detail from Pi." : "The audited read-only policy does not establish separate cache-write detail from the source."), [{
			kind: t,
			label: Eu[t].label,
			shortLabel: Eu[t].shortLabel,
			applicablePolicyIds: i,
			availability: p,
			completeCalls: s,
			applicableCalls: o,
			note: m
		}];
	}), a = [], o = e.modelCalls.filter((e) => e.economics.policyId === null || e.economics.usageCompleteness === "unsupported").length;
	n.length === 0 ? a.push("No supported provider/API cache policy is available for this session.") : o > 0 && a.push(`${o} call${o === 1 ? "" : "s"} lack a supported cache interpretation; raw call details remain available.`), n.includes(Cu) && a.push("Chat Completions does not report cache writes separately; its input series is labeled uncached."), n.some((e) => wu.has(e)) && a.push(Wl(e.session.source) ? "Read-only Responses policies: non-cache-read input may include writes; the audited Pi policy does not establish the write/fresh split." : "Read-only Responses policies: non-cache-read input may include writes; the source policy does not establish the write/fresh split.");
	let s = n.length > 1;
	return s && a.unshift("Categories vary by model/API; each call retains its exact policy semantics."), {
		categories: i,
		applicablePolicyIds: n,
		mixedPolicy: s,
		summary: n.length === 0 ? "Cache categories unavailable under the retained provider/API policy." : s ? "Categories vary by model/API." : "Categories follow the audited provider/API policy.",
		notes: a
	};
}
function ju(e, t) {
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
	if (Su.has(n.policyId)) {
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
	} else if (n.policyId === Cu) s = [{
		kind: "cacheRead",
		label: "Cache read",
		value: a
	}, {
		kind: "uncached",
		label: "Uncached input",
		value: i
	}], c = "The audited Chat Completions target does not report a separate cache-write bucket.";
	else if (wu.has(n.policyId)) s = [{
		kind: "cacheRead",
		label: "Cache read",
		value: a
	}, {
		kind: "nonRead",
		label: "Non-cache-read input",
		value: i
	}], c = Wl(t.session.source) ? "Non-cache-read input may include writes; Pi does not retain the write/fresh split." : "Non-cache-read input may include writes; the source does not retain the write/fresh split.";
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
function Mu(e) {
	let t = e.modelCalls.map(Nu);
	return {
		points: t,
		maximum: t.reduce((e, t) => t.status === "known" || t.status === "zero" ? Math.max(e, t.high ?? t.total ?? 0) : e, 0)
	};
}
function Nu(e) {
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
function Pu(e, t, n, r) {
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
			detail: u === null ? `${d}; share unavailable${n ? ` for call ${n.index} (${f})` : " (no previous call)"}` : `${d}; ${Ha(u)} of estimated ${r} tokens (call ${n.index})`
		}];
	}));
}
function Fu(e, t, n) {
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
function Iu(e, t) {
	return e.map((e, n) => ({
		id: e,
		position: n,
		tokens: t.get(e)?.tokens ?? null
	})).sort((e, t) => (t.tokens ?? -1) - (e.tokens ?? -1) || e.position - t.position).map((e) => e.id);
}
//#endregion
//#region src/lib/components/call-timing.ts
var Lu = "The rate is reported output, including reasoning, over that time.";
function Ru(e, t = !1) {
	switch (e) {
		case "claude-code": return "Claude Code does not record when a request started, so the response time and output rate are unavailable.";
		case "codex": return "Codex does not record when a request started, so the response time and output rate are unavailable.";
		case "vscode-copilot": return t ? `From Copilot sending the request to the end of the response, as its trace records show. ${Lu}` : "Response time and output rate require timing from the Copilot trace, not the chat session file.";
		case "copilot": return `From Copilot sending the request to the end of the response, as its usage record reports. ${Lu}`;
		case "pi": return `From Pi starting the response to recording it, including waiting and retries. ${Lu}`;
		case "opencode": return `From OpenCode creating the response to completing it, including waiting and retries. ${Lu}`;
		default: return `From the recorded start of the response to its end, including waiting and retries. ${Lu}`;
	}
}
function zu(e) {
	if (e === null) return "Unavailable";
	if (e < 1e3) return `${e.toLocaleString()} ms`;
	if (e < 6e4) return `${(e / 1e3).toLocaleString(void 0, { maximumFractionDigits: 2 })} s`;
	let t = Math.round(e / 1e3);
	return `${Math.floor(t / 60).toLocaleString()}m ${(t % 60).toLocaleString()}s`;
}
function Bu(e) {
	return e === null ? "Unavailable" : e > 0 && e < .01 ? "<0.01 tok/s" : `${e.toLocaleString(void 0, { maximumFractionDigits: 2 })} tok/s`;
}
//#endregion
//#region src/lib/components/TurnDetails.svelte
var Vu = /* @__PURE__ */ W("<span class=\"status svelte-1nxhbxv\"> </span>"), Hu = /* @__PURE__ */ W("<p class=\"prompt svelte-1nxhbxv\"> </p>"), Uu = /* @__PURE__ */ W("<p class=\"note svelte-1nxhbxv\">Some model calls are recorded together, so the exact count is unavailable.</p>"), Wu = /* @__PURE__ */ W("<span class=\"track svelte-1nxhbxv\" aria-hidden=\"true\"><span class=\"marker svelte-1nxhbxv\"></span></span>"), Gu = /* @__PURE__ */ W("<section class=\"turn svelte-1nxhbxv\" aria-label=\"Turn\"><div class=\"heading svelte-1nxhbxv\"><h4 class=\"svelte-1nxhbxv\">Turn</h4> <!></div> <!> <dl class=\"svelte-1nxhbxv\"><div><dt class=\"svelte-1nxhbxv\">Elapsed<!></dt> <dd> </dd></div> <div><dt class=\"svelte-1nxhbxv\"> </dt> <dd class=\"svelte-1nxhbxv\"> </dd></div> <div><dt class=\"svelte-1nxhbxv\">Recorded tool calls</dt> <dd class=\"svelte-1nxhbxv\"> </dd></div></dl> <!> <p class=\"position svelte-1nxhbxv\"><span class=\"position-label svelte-1nxhbxv\"> </span> <!></p></section>"), Ku = {
	hash: "svelte-1nxhbxv",
	code: ".turn.svelte-1nxhbxv {border-block-start:1px solid var(--separator);margin-block-start:0.75rem;padding-block-start:0.75rem;}.heading.svelte-1nxhbxv {display:flex;align-items:center;justify-content:space-between;gap:0.4rem;}h4.svelte-1nxhbxv,\n  p.svelte-1nxhbxv {margin:0;}.status.svelte-1nxhbxv,\n  .note.svelte-1nxhbxv,\n  dt.svelte-1nxhbxv {font-size:0.75rem;color:var(--muted);}.prompt.svelte-1nxhbxv {margin-block-start:0.4rem;overflow-wrap:anywhere;}dl.svelte-1nxhbxv {display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:0.4rem;margin:0.5rem 0;}dd.svelte-1nxhbxv {margin:0.15rem 0 0;font-variant-numeric:tabular-nums;font-weight:600;}.duration.svelte-1nxhbxv {white-space:nowrap;}.position.svelte-1nxhbxv {display:flex;align-items:center;gap:0.75rem;margin-block-start:0.5rem;font-size:0.75rem;color:var(--muted);}.position-label.svelte-1nxhbxv {flex:0 1 auto;}.track.svelte-1nxhbxv {flex:1 1 2rem;min-width:2rem;position:relative;height:2px;margin-inline:4px;background:var(--control-border);}.marker.svelte-1nxhbxv {position:absolute;top:50%;width:8px;height:8px;border-radius:50%;background:var(--accent);transform:translate(-50%, -50%);}"
};
function qu(e, t) {
	let n = Vr();
	Be(t, !0), ui(e, Ku);
	let r = /* @__PURE__ */ P(() => t.turn.lastCall - t.turn.firstCall + 1), i = /* @__PURE__ */ P(() => {
		let e = 0;
		for (let n = t.turn.firstCall; n <= t.turn.lastCall; n++) e += t.indexed.callByIndex.get(n)?.toolCallsAfter.length ?? 0;
		return e;
	}), a = /* @__PURE__ */ P(() => t.callIndex - t.turn.firstCall + 1), o = /* @__PURE__ */ P(() => H(r) > 1 ? (H(a) - 1) / (H(r) - 1) * 100 : 0), s = /* @__PURE__ */ P(() => t.turn.durationEstimated ?? Wl(t.indexed.analysis.session.source)), c = /* @__PURE__ */ P(() => H(s) ? "Estimated from the user message and final assistant response timestamps, including tool work." : t.indexed.analysis.session.source === "vscode-copilot" ? "From the saved request and completion timestamps, including tool work." : "Whole-turn time reported by the harness, including tool work."), l = {
		completed: "Completed",
		failed: "Failed",
		interrupted: "Interrupted"
	};
	var u = Gu(), d = L(u), f = B(L(d), 2), p = (e) => {
		var n = Vu(), r = z(n, !0);
		V(() => K(r, l[t.turn.status])), G(e, n);
	};
	q(f, (e) => {
		t.turn.status && e(p);
	}), N(d);
	var m = B(d, 2), h = (e) => {
		var n = Hu(), r = z(n, !0);
		V(() => K(r, t.turn.prompt)), G(e, n);
	};
	q(m, (e) => {
		t.turn.prompt && e(h);
	});
	var g = B(m, 2), _ = L(g), v = L(_), y = B(L(v)), b = (e) => {
		{
			let t = /* @__PURE__ */ P(() => `${n}-elapsed`);
			va(e, {
				get id() {
					return H(t);
				},
				label: "What turn elapsed time measures",
				children: (e, t) => {
					be();
					var n = zr();
					V(() => K(n, H(c))), G(e, n);
				},
				$$slots: { default: !0 }
			});
		}
	};
	q(y, (e) => {
		t.turn.durationMs !== null && e(b);
	}), N(v);
	var x = B(v, 2);
	let S;
	var ee = z(x);
	N(_);
	var C = B(_, 2), w = L(C), T = z(w, !0), E = z(B(w, 2), !0);
	N(C);
	var D = B(C, 2), O = z(B(L(D), 2), !0);
	N(D), N(g);
	var k = B(g, 2), te = (e) => {
		G(e, Uu());
	};
	q(k, (e) => {
		t.turn.combinedCalls && e(te);
	});
	var A = B(k, 2), ne = L(A), re = z(ne), ie = B(ne, 2), ae = (e) => {
		var t = Wu(), n = L(t);
		let r;
		N(t), V(() => r = yi(n, "", r, { left: `${H(o)}%` })), G(e, t);
	};
	q(ie, (e) => {
		H(r) > 1 && e(ae);
	}), N(A), N(u), V((e) => {
		S = _i(x, 1, "svelte-1nxhbxv", null, S, { duration: t.turn.durationMs !== null }), K(ee, `${H(s) && t.turn.durationMs !== null ? "≈ " : ""}${e ?? ""}`), K(T, t.turn.combinedCalls ? "Call entries" : "Recorded model calls"), K(E, H(r)), K(O, H(i)), K(re, `${t.turn.combinedCalls ? "Entry" : "Call"} ${H(a) ?? ""} of ${H(r) ?? ""} in this turn`);
	}, [() => zu(t.turn.durationMs)]), G(e, u), Ve();
}
//#endregion
//#region src/lib/components/CallDetails.svelte
var Ju = 0;
function Yu(e, t, n) {
	let r = t(e);
	return e !== null && n ? `≈ ${r}` : r;
}
var Xu = /* @__PURE__ */ W("<span class=\"retry-note svelte-1d84xhe\">Copilot recorded this call as a retry after an error.</span>"), Zu = /* @__PURE__ */ W("<small class=\"svelte-1d84xhe\">The total of several requests: this response ran web searches, so it is not compared\n              with the context.</small>"), Qu = /* @__PURE__ */ W("<small class=\"svelte-1d84xhe\">The compaction's own call, which wrote the summary that replaced the context.</small>"), $u = /* @__PURE__ */ W("<small class=\"svelte-1d84xhe\">The total of the compaction's requests, which wrote the summary that replaced the\n              context.</small>"), ed = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div>"), td = /* @__PURE__ */ W("<p class=\"svelte-1d84xhe\"> </p>"), nd = /* @__PURE__ */ W("<div class=\"cost-explanation svelte-1d84xhe\"><p class=\"svelte-1d84xhe\"> </p> <!> <!> <!></div>"), rd = /* @__PURE__ */ W("<small class=\"svelte-1d84xhe\"> </small>"), id = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\">Provider usage</dt> <dd class=\"svelte-1d84xhe\"> <!></dd></div>"), ad = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\">Response time (approx.)</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Effective output rate</dt> <dd class=\"svelte-1d84xhe\"> </dd></div>", 1), od = /* @__PURE__ */ W(" <!>", 1), sd = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\">Timing</dt> <dd class=\"svelte-1d84xhe\"> <!></dd></div>"), cd = /* @__PURE__ */ W("<span class=\"timing-explanation svelte-1d84xhe\"> </span>"), ld = /* @__PURE__ */ W("<li class=\"svelte-1d84xhe\"><button type=\"button\" class=\"svelte-1d84xhe\"> <!></button></li>"), ud = /* @__PURE__ */ W("<div class=\"change-list svelte-1d84xhe\"><h4 class=\"svelte-1d84xhe\"> </h4> <p class=\"change-baseline svelte-1d84xhe\">Share of estimated added tokens</p> <ul role=\"list\" class=\"svelte-1d84xhe\"></ul></div>"), dd = /* @__PURE__ */ W("<div class=\"change-list svelte-1d84xhe\"><h4 class=\"svelte-1d84xhe\"> </h4> <p class=\"change-baseline svelte-1d84xhe\"><!></p> <ul role=\"list\" class=\"svelte-1d84xhe\"></ul></div>"), fd = /* @__PURE__ */ W("<details class=\"svelte-1d84xhe\"><summary class=\"svelte-1d84xhe\"> </summary> <div><!> <!></div></details>"), pd = /* @__PURE__ */ W("<p> </p>"), md = /* @__PURE__ */ W("<span> </span>"), hd = /* @__PURE__ */ W("<div class=\"tool-summary svelte-1d84xhe\"><b>Tools invoked after this response</b> <div class=\"tool-list svelte-1d84xhe\"></div></div>"), gd = /* @__PURE__ */ W("<p class=\"economics-note svelte-1d84xhe\">Failed or aborted attempt: recorded zeros are placeholders, not measured usage. Actual\n          token consumption and cost are unavailable; partial output does not establish usage.</p> <h4 class=\"svelte-1d84xhe\">Raw recorded placeholders</h4> <dl class=\"detail-rows svelte-1d84xhe\" aria-label=\"Raw recorded placeholders\"><!> <!></dl>", 1), _d = /* @__PURE__ */ W("<p class=\"economics-note svelte-1d84xhe\">These dollar figures do not measure Copilot subscription charges or premium requests.</p>"), vd = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Reported total tokens</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div>", 1), yd = /* @__PURE__ */ W("<div class=\"ratio-discontinuity svelte-1d84xhe\" role=\"note\"><b> </b> <p class=\"svelte-1d84xhe\"> <!></p> <button type=\"button\" class=\"svelte-1d84xhe\"> </button></div>"), bd = /* @__PURE__ */ W("<b> </b> ", 1), xd = /* @__PURE__ */ W("<b>Unrecognized economics explanation</b> — see the raw code in Technical identifiers.", 1), Sd = /* @__PURE__ */ W("<li><!></li>"), Cd = /* @__PURE__ */ W("<h4 class=\"svelte-1d84xhe\">Economics notes</h4> <ul class=\"economics-explanations svelte-1d84xhe\"></ul>", 1), wd = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\">Known framing</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Calculated request</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Residual</dt> <dd class=\"svelte-1d84xhe\"> </dd></div>", 1), Td = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\">Reported − reconstructed (approximate)</dt> <dd class=\"svelte-1d84xhe\"> <!></dd></div>"), Ed = /* @__PURE__ */ W("<b>Unrecognized diagnostic</b> — see the raw code in Technical identifiers.", 1), Dd = /* @__PURE__ */ W("<h4 class=\"svelte-1d84xhe\">Diagnostic explanations</h4> <ul class=\"diagnostics svelte-1d84xhe\"></ul>", 1), Od = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\">Cache write 1h (source detail)</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Output accounting</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Completion total (including reasoning)</dt> <dd class=\"svelte-1d84xhe\"> </dd></div>", 1), kd = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\">Reconciliation status</dt> <dd class=\"svelte-1d84xhe\"> </dd></div>"), Ad = /* @__PURE__ */ W("<small class=\"metric-note svelte-1d84xhe\"> </small>"), jd = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\">Tokenization profile ID</dt> <dd class=\"svelte-1d84xhe\"><code class=\"svelte-1d84xhe\"> </code> <!></dd></div>"), Md = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\">Economics policy ID</dt> <dd class=\"svelte-1d84xhe\"><code class=\"svelte-1d84xhe\"> </code> <!></dd></div>"), Nd = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\">Compaction before this call</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Compaction ID</dt> <dd class=\"svelte-1d84xhe\"><code class=\"svelte-1d84xhe\"> </code></dd></div>", 1), Pd = /* @__PURE__ */ W("<span class=\"error-mark svelte-1d84xhe\">failed</span>"), Fd = /* @__PURE__ */ W("<li class=\"svelte-1d84xhe\"> <code class=\"svelte-1d84xhe\"> </code> <!> <!></li>"), Id = /* @__PURE__ */ W("<h4 class=\"svelte-1d84xhe\">Tool-call IDs</h4> <ul class=\"tool-identifiers svelte-1d84xhe\"></ul>", 1), Ld = /* @__PURE__ */ W("<li><code class=\"svelte-1d84xhe\"> </code></li>"), Rd = /* @__PURE__ */ W("<h4 class=\"svelte-1d84xhe\">Raw diagnostic codes</h4> <ul class=\"svelte-1d84xhe\"></ul>", 1), zd = /* @__PURE__ */ W("<h4 class=\"svelte-1d84xhe\">Raw economics codes</h4> <ul class=\"svelte-1d84xhe\"></ul>", 1), Bd = /* @__PURE__ */ W("<section class=\"call-details svelte-1d84xhe\"><header class=\"svelte-1d84xhe\"><div class=\"svelte-1d84xhe\"><h3 id=\"pinned-call-summary\" tabindex=\"-1\" class=\"svelte-1d84xhe\"> </h3> <span class=\"svelte-1d84xhe\"> </span> <!></div></header> <dl class=\"essential-metrics svelte-1d84xhe\"><div><dt class=\"svelte-1d84xhe\">Input</dt> <dd class=\"svelte-1d84xhe\"> <!></dd></div> <!> <div><dt class=\"svelte-1d84xhe\">Cost</dt> <dd class=\"svelte-1d84xhe\"> <!><small class=\"svelte-1d84xhe\"> </small></dd></div> <!> <!></dl> <!> <!> <!> <!> <!> <details class=\"usage-breakdown svelte-1d84xhe\"><summary class=\"svelte-1d84xhe\">Usage and economics</summary> <!> <!> <dl class=\"detail-rows svelte-1d84xhe\"><div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Cache-read share</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Cache-write share</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <!></dl> <!> <!></details> <details class=\"token-diagnostics svelte-1d84xhe\"><summary class=\"svelte-1d84xhe\">Token estimates</summary> <dl class=\"detail-rows svelte-1d84xhe\"><div><dt class=\"svelte-1d84xhe\">Visible context</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <!> <div><dt class=\"svelte-1d84xhe\">Added tokens</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Retained tokens</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Dropped tokens</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Oldest / median live age</dt> <dd class=\"svelte-1d84xhe\"> </dd></div></dl> <!></details> <details class=\"call-diagnostics svelte-1d84xhe\"><summary class=\"svelte-1d84xhe\">Diagnostics</summary> <dl class=\"detail-rows svelte-1d84xhe\"><!> <div><dt class=\"svelte-1d84xhe\">Cumulative prompt</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Cumulative completion (including reasoning)</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Cumulative reasoning</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Cumulative usage completeness</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Estimate coverage</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <!> <div><dt class=\"svelte-1d84xhe\">Model / tokenizer</dt> <dd class=\"svelte-1d84xhe\"><!></dd></div> <div><dt class=\"svelte-1d84xhe\">Token-weighted mean age</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Items aged ≥5 / ≥10 / ≥20 calls</dt> <dd class=\"svelte-1d84xhe\"> </dd></div></dl></details> <details class=\"technical-identifiers svelte-1d84xhe\"><summary class=\"svelte-1d84xhe\">Technical identifiers</summary> <dl class=\"identifier-list svelte-1d84xhe\"><div><dt class=\"svelte-1d84xhe\">Source record ID</dt> <dd class=\"svelte-1d84xhe\"><code class=\"svelte-1d84xhe\"> </code> <!></dd></div> <!> <!></dl> <dl class=\"technical-values svelte-1d84xhe\"><div><dt class=\"svelte-1d84xhe\">Stop reason</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <!></dl> <!> <!> <!></details></section>"), Vd = {
	hash: "svelte-1d84xhe",
	code: ".call-details.svelte-1d84xhe {color:var(--text);min-width:0;max-width:100%;}header.svelte-1d84xhe {position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;gap:16px;align-items:start;margin:-2px 0 8px;padding:4px 0 7px;background:var(--surface);}header.svelte-1d84xhe div:where(.svelte-1d84xhe) {display:flex;flex-direction:column;gap:2px;}header.svelte-1d84xhe h3:where(.svelte-1d84xhe) {margin:0;color:var(--text);font-size:var(--text-lg);}header.svelte-1d84xhe h3:where(.svelte-1d84xhe):focus {outline:2px solid var(--accent);outline-offset:2px;}header.svelte-1d84xhe span:where(.svelte-1d84xhe) {color:var(--secondary);font-size:var(--text-sm);overflow-wrap:anywhere;}header.svelte-1d84xhe .retry-note:where(.svelte-1d84xhe) {display:block;margin-top:2px;}.essential-metrics.svelte-1d84xhe,\n  .detail-rows.svelte-1d84xhe,\n  .technical-values.svelte-1d84xhe {display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:7px 14px;margin:0;}.cost-explanation.svelte-1d84xhe p:where(.svelte-1d84xhe) {margin:0;overflow-wrap:anywhere;}.cost-explanation.svelte-1d84xhe p:where(.svelte-1d84xhe) + p:where(.svelte-1d84xhe) {margin-top:6px;}.timing-explanation.svelte-1d84xhe {position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;}dt.svelte-1d84xhe {color:var(--secondary);font-size:var(--text-sm);}dd.svelte-1d84xhe {margin:1px 0 0;color:var(--text-strong);overflow-wrap:anywhere;}dd.svelte-1d84xhe small:where(.svelte-1d84xhe) {display:block;color:var(--secondary);font-size:var(--text-sm);}.change-lists.svelte-1d84xhe {display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:8px 14px;margin-top:10px;}.change-lists.single.svelte-1d84xhe {grid-template-columns:minmax(0, 1fr);}details.svelte-1d84xhe {margin-top:10px;min-width:0;}.change-list.svelte-1d84xhe {min-width:0;}.change-lists.svelte-1d84xhe h4:where(.svelte-1d84xhe) {margin-top:0;}.change-lists.svelte-1d84xhe ul:where(.svelte-1d84xhe) {list-style:none;padding-left:0;}.change-lists.svelte-1d84xhe button:where(.svelte-1d84xhe) {width:100%;text-align:left;}.change-baseline.svelte-1d84xhe {margin:0 0 6px;color:var(--secondary);font-size:var(--text-xs);}summary.svelte-1d84xhe {color:var(--text);cursor:pointer;}.tool-summary.svelte-1d84xhe {margin-top:10px;}.tool-list.svelte-1d84xhe {display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:4px;}.tool-chip.svelte-1d84xhe {display:inline;color:var(--secondary);font-size:var(--text-sm);cursor:default;}.tool-chip.failed.svelte-1d84xhe {color:var(--error);}.detail-rows.svelte-1d84xhe,\n  .technical-values.svelte-1d84xhe {margin-top:8px;}.economics-note.svelte-1d84xhe,\n  .economics-explanations.svelte-1d84xhe {color:var(--secondary);font-size:var(--text-sm);line-height:1.4;}.economics-note.svelte-1d84xhe {margin:6px 0;}.ratio-discontinuity.svelte-1d84xhe {margin-top:9px;padding:8px 10px;border-left:3px solid var(--event-warning);border-radius:4px;background:var(--surface-raised);color:var(--text);font-size:var(--text-sm);}.ratio-discontinuity.svelte-1d84xhe p:where(.svelte-1d84xhe) {margin:4px 0 7px;color:var(--text);}h4.svelte-1d84xhe {margin:11px 0 4px;color:var(--text);font-size:var(--text-sm);}ul.svelte-1d84xhe {margin:4px 0 0;padding-left:18px;overflow-wrap:anywhere;}.diagnostics.svelte-1d84xhe {font-size:var(--text-sm);}.identifier-list.svelte-1d84xhe {display:grid;gap:7px;margin:8px 0 0;}.identifier-list.svelte-1d84xhe dd:where(.svelte-1d84xhe) {display:grid;justify-items:start;gap:4px;}.tool-identifiers.svelte-1d84xhe li:where(.svelte-1d84xhe) {margin-top:5px;}code.svelte-1d84xhe {color:var(--secondary);overflow-wrap:anywhere;user-select:all;}button.svelte-1d84xhe:not(.copy-control:where(.svelte-1d84xhe) button:where(.svelte-1d84xhe)) {max-width:100%;overflow-wrap:anywhere;}.error-mark.svelte-1d84xhe {color:var(--error);margin-left:6px;}\n  @container highwater (max-width: 520px) {.essential-metrics.svelte-1d84xhe,\n    .detail-rows.svelte-1d84xhe,\n    .technical-values.svelte-1d84xhe,\n    .change-lists.svelte-1d84xhe {grid-template-columns:1fr;}\n  }"
};
function Hd(e, t) {
	Be(t, !0), ui(e, Vd);
	let n = `call-contribution-${Ju++}`, r = X(t, "sections", 19, Ui), i = X(t, "pinned", 3, !1), a = X(t, "onSelectItem", 3, () => {}), o = X(t, "onPinCall", 3, () => {}), s = /* @__PURE__ */ P(() => t.call?.tokenAnalysis.metricsIncludePartialEstimates ?? !1), c = /* @__PURE__ */ P(() => t.call ? _l(t.indexed, t.call) : null), l = /* @__PURE__ */ P(() => t.call?.compactionBefore ? t.indexed.compactionById.get(t.call.compactionBefore) ?? null : null), u = /* @__PURE__ */ P(() => (() => {
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
	})()), d = /* @__PURE__ */ P(() => t.call ? mu(t.call.usage) : []), f = /* @__PURE__ */ P(() => t.call?.tokenAnalysis.explanationCodes ?? []), p = /* @__PURE__ */ P(() => Fl(t.indexed.analysis)), h = /* @__PURE__ */ P(() => H(f).filter((e) => !H(p).has(e))), g = /* @__PURE__ */ P(() => t.indexed.analysis.turns?.find((e) => t.call && e.firstCall <= t.call.index && t.call.index <= e.lastCall)), _ = /* @__PURE__ */ P(() => t.indexed.analysis.session.source === "vscode-copilot" && t.call?.timing.startedAtMs == null), v = /* @__PURE__ */ P(() => t.indexed.analysis.session.source === "vscode-copilot" ? t.call?.timing.durationMs != null : !["claude-code", "codex"].includes(t.indexed.analysis.session.source)), y = /* @__PURE__ */ P(() => t.call?.economics.explanationCodes ?? []), b = /* @__PURE__ */ P(() => t.call !== null && t.call !== void 0 && t.call.stopReason !== "compaction-aggregate" && (t.call.stopReason === "compaction-call" || t.indexed.analysis.compactions.some((e) => e.details.summaryCall === t.call.index))), x = /* @__PURE__ */ P(() => Ul(t.indexed.analysis.economics.costBasis, t.indexed.analysis.session.source)), S = /* @__PURE__ */ P(() => t.call?.costAssessment ?? null), ee = /* @__PURE__ */ P(() => H(S) ? au(H(S)) : null), C = /* @__PURE__ */ P(() => Ru(t.indexed.analysis.session.source, H(v))), w = /* @__PURE__ */ P(() => H(S) ? ou(H(S), t.indexed.analysis.session.source) : null), T = /* @__PURE__ */ P(() => t.call?.tokenizationProfileId ? t.indexed.analysis.tokenAnalysis.profiles.find((e) => e.id === t.call?.tokenizationProfileId) ?? null : null), E = /* @__PURE__ */ P(() => t.call ? t.indexed.analysis.modelCalls[t.indexed.analysis.modelCalls.findIndex((e) => e.index === t.call?.index) - 1] ?? null : null), D = /* @__PURE__ */ P(() => Pu(t.indexed, t.call?.addedItemIds ?? [], t.call, "added")), O = /* @__PURE__ */ P(() => Pu(t.indexed, t.call?.droppedItemIds ?? [], H(E), "dropped"));
	function k(e) {
		return Fo(t.indexed.itemById.get(e), e);
	}
	function te(e) {
		return e === "anthropic-messages-cache-v1" || e === "github-copilot-messages-cache-v1" || e === "github-copilot-responses-cache-v1" ? "Fresh input" : e === "openai-completions-cache-v1" ? "Uncached input" : e === "openai-responses-cache-read-v1" || e === "openai-codex-responses-cache-read-v1" ? "Non-cache-read input (may include writes)" : "Input (raw normalized bucket)";
	}
	function A() {
		if (!t.call) return "Unknown";
		switch (t.call.economics.cacheWriteStatus) {
			case "reported": return Z(t.call.usage.cacheWrite);
			case "notReported": return "Not separately reported";
			case "notRetainedByPi": return Wl(t.indexed.analysis.session.source) ? "Not retained by Pi" : "Not retained by source";
			default: return `Raw normalized value: ${Z(t.call.usage.cacheWrite)}`;
		}
	}
	function ne(e) {
		return e === "anthropic-messages-cache-v1" || e === "github-copilot-messages-cache-v1" || e === "github-copilot-responses-cache-v1" ? "Fresh-input share" : e === "openai-completions-cache-v1" ? "Uncached-input share" : "Fresh / uncached input share";
	}
	function re() {
		return t.call && t.call.economics.cacheWriteStatus === "unsupported" ? "Cache write (raw field)" : "Cache write";
	}
	function ie(e) {
		return e === null ? t.call ? t.call.economics.usageCompleteness === "unsupported" ? "Unsupported policy" : t.call.economics.usageCompleteness === "missing" ? "Provider usage missing" : t.call.economics.usageCompleteness === "partial" ? "Provider usage incomplete" : t.call.economics.promptTokens === 0 ? "No prompt tokens" : "Unavailable" : "Unknown" : Ha(e);
	}
	function ae() {
		return t.call ? t.call.economics.cacheWriteStatus === "notReported" ? "Not separately reported" : t.call.economics.cacheWriteStatus === "notRetainedByPi" ? Wl(t.indexed.analysis.session.source) ? "Not retained by Pi" : "Not retained by source" : t.call.economics.cacheWriteStatus === "unsupported" ? "Unsupported policy" : ie(t.call.economics.cacheWriteRatio) : "Unknown";
	}
	function oe() {
		return t.call ? t.call.economics.policyId === "openai-responses-cache-read-v1" || t.call.economics.policyId === "openai-codex-responses-cache-read-v1" ? "Unavailable; writes may be included in non-read input" : ie(t.call.economics.freshRatio) : "Unknown";
	}
	var se = Br(), ce = R(se), le = (e) => {
		var p = Bd(), S = L(p), se = L(S), ce = L(se), le = z(ce), ue = B(ce, 2), de = z(ue), fe = B(ue, 2), pe = (e) => {
			G(e, Xu());
		};
		q(fe, (e) => {
			t.call.retried && e(pe);
		}), N(se), N(S);
		var me = B(S, 2), he = L(me), ge = B(L(he), 2), j = L(ge), _e = B(j), M = (e) => {
			G(e, Zu());
		}, ve = (e) => {
			G(e, Qu());
		}, ye = (e) => {
			G(e, $u());
		};
		q(_e, (e) => {
			t.call.stopReason === "web-search-aggregate" ? e(M) : H(b) ? e(ve, 1) : t.call.stopReason === "compaction-aggregate" && e(ye, 2);
		}), N(ge), N(he);
		var xe = B(he, 2);
		J(xe, 17, () => H(d), ei, (e, t) => {
			var n = ed(), r = L(n), i = z(r, !0), a = z(B(r, 2), !0);
			N(n), V(() => {
				K(i, H(t).label), K(a, H(t).value);
			}), G(e, n);
		});
		var Se = B(xe, 2), Ce = B(L(Se), 2), we = L(Ce, !0), Te = B(we);
		{
			let e = /* @__PURE__ */ P(() => `${n}-cost`);
			va(Te, {
				get id() {
					return H(e);
				},
				label: "How this cost is worked out",
				children: (e, n) => {
					var r = nd(), i = L(r), a = z(i, !0), o = B(i, 2), s = (e) => {
						var t = td(), n = z(t, !0);
						V(() => K(n, cu)), G(e, t);
					};
					q(o, (e) => {
						t.call.costAssessment.amountHigh !== null && e(s);
					});
					var c = B(o, 2), l = (e) => {
						var t = td(), n = z(t);
						V(() => K(n, `Rate: ${H(ee) ?? ""}.`)), G(e, t);
					};
					q(c, (e) => {
						H(ee) && e(l);
					});
					var u = B(c, 2), d = (e) => {
						var t = td(), n = z(t, !0);
						V(() => K(n, H(w))), G(e, t);
					};
					q(u, (e) => {
						H(w) && e(d);
					}), N(r), V((e) => K(a, e), [() => su(t.call.costAssessment, t.indexed.analysis.session.source)]), G(e, r);
				},
				$$slots: { default: !0 }
			});
		}
		var Ee = z(B(Te), !0);
		N(Ce), N(Se);
		var De = B(Se, 2), Oe = (e) => {
			var n = id(), r = B(L(n), 2), i = L(r, !0), a = B(i), o = (e) => {
				var n = rd(), r = z(n);
				V(() => K(r, `Audited policy: ${t.call.economics.usageCompleteness ?? ""}`)), G(e, n);
			};
			q(a, (e) => {
				t.call.economics.usageCompleteness !== t.call.reportedUsageCompleteness && e(o);
			}), N(r), N(n), V(() => K(i, t.call.usage.placeholder ? "Unavailable" : t.call.reportedUsageCompleteness)), G(e, n);
		};
		q(De, (e) => {
			(t.call.usage.placeholder || t.call.reportedUsageCompleteness !== "complete" || t.call.economics.usageCompleteness !== t.call.reportedUsageCompleteness) && e(Oe);
		});
		var ke = B(De, 2), Ae = (e) => {
			var r = ad(), i = R(r), a = B(L(i), 2), o = z(a, !0);
			N(i);
			var s = B(i, 2), c = B(L(s), 2), l = z(c, !0);
			N(s), V((e, t) => {
				Y(a, "title", H(C)), Y(a, "aria-describedby", `${n}-timing`), K(o, e), Y(c, "title", H(C)), Y(c, "aria-describedby", `${n}-timing`), K(l, t);
			}, [() => zu(t.call.timing.durationMs), () => Bu(t.call.timing.effectiveOutputTokensPerSecond)]), G(e, r);
		}, je = (e) => {
			var t = sd(), r = B(L(t), 2), i = L(r, !0), a = B(i);
			{
				let e = /* @__PURE__ */ P(() => `${n}-timing`);
				va(a, {
					get id() {
						return H(e);
					},
					label: "Why timing is not recorded",
					children: (e, t) => {
						be();
						var n = od(), r = R(n, !0), i = B(r), a = (e) => {
							G(e, zr("The chat session file may still record token totals and tool activity."));
						};
						q(i, (e) => {
							H(_) && e(a);
						}), V(() => K(r, H(C))), G(e, n);
					},
					$$slots: { default: !0 }
				});
			}
			N(r), N(t), V(() => K(i, H(_) ? "Trace unavailable" : "Not recorded")), G(e, t);
		};
		q(ke, (e) => {
			H(v) ? e(Ae) : e(je, -1);
		}), N(me);
		var Me = B(me, 2), Ne = (e) => {
			var t = cd(), r = z(t, !0);
			V(() => {
				Y(t, "id", `${n}-timing`), K(r, H(C));
			}), G(e, t);
		};
		q(Me, (e) => {
			H(v) && e(Ne);
		});
		var Pe = B(Me, 2), Fe = (e) => {
			qu(e, {
				get turn() {
					return H(g);
				},
				get callIndex() {
					return t.call.index;
				},
				get indexed() {
					return t.indexed;
				}
			});
		};
		q(Pe, (e) => {
			H(g) && e(Fe);
		});
		var Ie = B(Pe, 2), Le = (e) => {
			var i = fd(), o = L(i), s = z(o), c = B(o, 2);
			let l;
			var u = L(c), d = (e) => {
				var r = ud(), i = L(r), o = z(i), s = B(i, 4);
				J(s, 21, () => t.call.addedItemIds, ei, (e, t, r) => {
					let i = /* @__PURE__ */ P(() => H(D).get(H(t)));
					var o = ld(), s = L(o), c = L(s, !0), l = B(c);
					{
						let e = /* @__PURE__ */ P(() => `${n}-added-${r}`);
						bu(l, {
							get value() {
								return H(i);
							},
							get descriptionId() {
								return H(e);
							}
						});
					}
					N(s), N(o), V((e, t, i) => {
						Y(s, "aria-label", e), Y(s, "aria-describedby", `${n}-added-${r}`), Y(s, "title", t), K(c, i);
					}, [
						() => `Select added item ${k(H(t))}`,
						() => `${k(H(t))} — ${H(i).detail}`,
						() => k(H(t))
					]), U("click", s, () => a()(H(t))), G(e, o);
				}), N(s), N(r), V((e) => K(o, `Added items (${e ?? ""})`), [() => Q(t.call.addedItemIds.length)]), G(e, r);
			};
			q(u, (e) => {
				t.call.addedItemIds.length > 0 && e(d);
			});
			var f = B(u, 2), p = (e) => {
				var r = dd(), i = L(r), o = z(i), s = B(i, 2), c = L(s), l = (e) => {
					var t = zr();
					V(() => K(t, `Share of estimated dropped tokens · previous call ${H(E).index ?? ""}`)), G(e, t);
				}, u = (e) => {
					G(e, zr("Previous\n                  call unavailable"));
				};
				q(c, (e) => {
					H(E) ? e(l) : e(u, -1);
				}), N(s);
				var d = B(s, 2);
				J(d, 21, () => t.call.droppedItemIds, ei, (e, t, r) => {
					let i = /* @__PURE__ */ P(() => H(O).get(H(t)));
					var o = ld(), s = L(o), c = L(s, !0), l = B(c);
					{
						let e = /* @__PURE__ */ P(() => `${n}-dropped-${r}`);
						bu(l, {
							get value() {
								return H(i);
							},
							get descriptionId() {
								return H(e);
							}
						});
					}
					N(s), N(o), V((e, t, i) => {
						Y(s, "aria-label", e), Y(s, "aria-describedby", `${n}-dropped-${r}`), Y(s, "title", t), K(c, i);
					}, [
						() => `Select dropped item ${k(H(t))}`,
						() => `${k(H(t))} — ${H(i).detail}`,
						() => k(H(t))
					]), U("click", s, () => a()(H(t))), G(e, o);
				}), N(d), N(r), V((e) => K(o, `Dropped items (${e ?? ""})`), [() => Q(t.call.droppedItemIds.length)]), G(e, r);
			};
			q(f, (e) => {
				t.call.droppedItemIds.length > 0 && e(p);
			}), N(c), N(i), di(i, (e, t) => Wi?.(e, t), () => ({
				state: r(),
				key: "changes"
			})), V((e, n, r) => {
				K(s, `Context changes · ${e ?? ""} added / ${n ?? ""} retained / ${r ?? ""} dropped`), l = _i(c, 1, "change-lists svelte-1d84xhe", null, l, { single: t.call.addedItemIds.length === 0 || t.call.droppedItemIds.length === 0 });
			}, [
				() => Q(t.call.transitionItemCounts.added),
				() => Q(t.call.transitionItemCounts.retained),
				() => Q(t.call.transitionItemCounts.dropped)
			]), G(e, i);
		}, Re = (e) => {
			var n = pd(), r = z(n);
			V((e, t, n) => K(r, `Context changes · ${e ?? ""} added / ${t ?? ""} retained / ${n ?? ""} dropped`), [
				() => Q(t.call.transitionItemCounts.added),
				() => Q(t.call.transitionItemCounts.retained),
				() => Q(t.call.transitionItemCounts.dropped)
			]), G(e, n);
		};
		q(Ie, (e) => {
			t.call.addedItemIds.length > 0 || t.call.droppedItemIds.length > 0 ? e(Le) : e(Re, -1);
		});
		var ze = B(Ie, 2), Be = (e) => {
			var t = pd(), n = z(t);
			V((e, t) => K(n, `Compaction · ${e ?? ""} removed / ${t ?? ""} retained`), [() => Q(H(l).sourceItemIds.length), () => Q(H(l).retainedItemIds.length)]), G(e, t);
		};
		q(ze, (e) => {
			H(l) && e(Be);
		});
		var Ve = B(ze, 2), He = (e) => {
			var t = hd(), n = B(L(t), 2);
			J(n, 21, () => H(u), ei, (e, t) => {
				var n = md();
				let r;
				var i = z(n);
				V(() => {
					r = _i(n, 1, "tool-chip svelte-1d84xhe", null, r, { failed: H(t).failed }), K(i, `${H(t).name ?? ""}${H(t).count > 1 ? ` × ${H(t).count}` : ""}${H(t).failed ? " · failed" : ""}`);
				}), G(e, n);
			}), N(n), N(t), G(e, t);
		};
		q(Ve, (e) => {
			H(u).length > 0 && e(He);
		});
		var Ue = B(Ve, 2), We = B(L(Ue), 2), Ge = (e) => {
			let n = /* @__PURE__ */ P(() => t.call.usage.placeholder);
			var r = gd(), i = B(R(r), 4), a = L(i);
			J(a, 17, () => [
				["Input", H(n).input],
				["Output", H(n).output],
				["Cache read", H(n).cacheRead],
				["Cache write", H(n).cacheWrite],
				["Cache write 1h", H(n).cacheWrite1h],
				["Reasoning", H(n).reasoning],
				["Total tokens", H(n).totalTokens]
			], ei, (e, t) => {
				var n = /* @__PURE__ */ P(() => m(H(t), 2));
				let r = () => H(n)[0], i = () => H(n)[1];
				var a = ed(), o = L(a), s = z(o), c = z(B(o, 2), !0);
				N(a), V((e) => {
					K(s, `${r() ?? ""} (raw placeholder)`), K(c, e);
				}, [() => Z(i())]), G(e, a);
			}), J(B(a, 2), 17, () => [
				["Input", H(n).cost?.input],
				["Output", H(n).cost?.output],
				["Cache read", H(n).cost?.cacheRead],
				["Cache write", H(n).cost?.cacheWrite],
				["Total", H(n).cost?.total]
			], ei, (e, t) => {
				var n = /* @__PURE__ */ P(() => m(H(t), 2));
				let r = () => H(n)[0], i = () => H(n)[1];
				var a = ed(), o = L(a), s = z(o), c = z(B(o, 2), !0);
				N(a), V((e) => {
					K(s, `${r() ?? ""} cost (raw placeholder)`), K(c, e);
				}, [() => Ba(i())]), G(e, a);
			}), N(i), G(e, r);
		};
		q(We, (e) => {
			t.call.usage.placeholder && e(Ge);
		});
		var Ke = B(We, 2), qe = (e) => {
			G(e, _d());
		};
		q(Ke, (e) => {
			t.call.provider === "github-copilot" && e(qe);
		});
		var Je = B(Ke, 2), Ye = L(Je), Xe = L(Ye), Ze = z(Xe, !0), Qe = z(B(Xe, 2), !0);
		N(Ye);
		var $e = B(Ye, 2), et = L($e), tt = z(et, !0), nt = z(B(et, 2), !0);
		N($e);
		var rt = B($e, 2), it = L(rt), at = z(it, !0), ot = z(B(it, 2), !0);
		N(rt);
		var st = B(rt, 2), ct = z(B(L(st), 2), !0);
		N(st);
		var lt = B(st, 2), ut = z(B(L(lt), 2), !0);
		N(lt);
		var dt = B(lt, 2), ft = L(dt), pt = z(ft, !0), mt = z(B(ft, 2), !0);
		N(dt);
		var ht = B(dt, 2), gt = (e) => {
			var n = vd(), r = R(n), i = L(r), a = z(i), o = z(B(i, 2), !0);
			N(r);
			var s = B(r, 2), c = L(s), l = z(c, !0), u = z(B(c, 2), !0);
			N(s);
			var d = B(s, 2), f = z(B(L(d), 2), !0);
			N(d);
			var p = B(d, 2), m = L(p), h = z(m), g = z(B(m, 2), !0);
			N(p);
			var _ = B(p, 2), v = L(_), y = z(v), b = z(B(v, 2), !0);
			N(_);
			var S = B(_, 2), ee = L(S), C = z(ee), w = z(B(ee, 2), !0);
			N(S);
			var T = B(S, 2), E = L(T), D = z(E), O = z(B(E, 2), !0);
			N(T);
			var k = B(T, 2), te = L(k), A = z(te, !0), ne = z(B(te, 2), !0);
			N(k), V((e, n, r, i, s, c, d) => {
				K(a, `${H(x).label ?? ""} component completeness`), K(o, t.call.economics.costCompleteness), K(l, H(x).promptLabel), K(u, e), K(f, n), K(h, `${H(x).componentPrefix ?? ""} input cost`), K(g, r), K(y, `${H(x).componentPrefix ?? ""} output cost`), K(b, i), K(C, `${H(x).componentPrefix ?? ""} cache-read cost`), K(w, s), K(D, `${H(x).componentPrefix ?? ""} cache-write cost`), K(O, c), K(A, H(x).totalLabel), K(ne, d);
			}, [
				() => Ba(t.call.economics.piPromptCost),
				() => Z(t.call.reportedTotalTokens),
				() => Ba(t.call.cost?.input),
				() => Ba(t.call.cost?.output),
				() => Ba(t.call.cost?.cacheRead),
				() => Ba(t.call.cost?.cacheWrite),
				() => Ba(t.call.cost?.total)
			]), G(e, n);
		}, _t = /* @__PURE__ */ P(() => ![
			"claude-code",
			"codex",
			"copilot",
			"vscode-copilot"
		].includes(t.indexed.analysis.session.source));
		q(ht, (e) => {
			H(_t) && e(gt);
		}), N(Je);
		var vt = B(Je, 2), yt = (e) => {
			let n = /* @__PURE__ */ P(() => t.call.economics.cacheRatioDiscontinuity);
			var r = yd(), i = L(r), a = z(i, !0), s = B(i, 2), c = L(s), l = B(c), u = (e) => {
				var t = zr();
				V(() => K(t, `Compaction ${H(n).compactionBefore ?? ""} is nearby context.`)), G(e, t);
			};
			q(l, (e) => {
				H(n).compactionBefore && e(u);
			}), N(s);
			var d = B(s, 2), f = z(d);
			N(r), V((e, t, r, i) => {
				K(a, e), K(c, `Adjacent-call change: ${t ?? ""} to
            ${r ?? ""} prompt tokens; change of
            ${i ?? ""} percentage points (${H(n).magnitude ?? ""}). Method:
            ${H(n).method ?? ""}. `), K(f, `Inspect previous call ${H(n).previousCallIndex ?? ""}`);
			}, [
				() => Ou(H(n), t.call.index),
				() => Q(H(n).previousPromptTokens),
				() => Q(H(n).currentPromptTokens),
				() => (H(n).delta * 100).toFixed(1)
			]), U("click", d, () => o()(H(n).previousCallIndex)), G(e, r);
		};
		q(vt, (e) => {
			t.call.economics.cacheRatioDiscontinuity && e(yt);
		});
		var bt = B(vt, 2), xt = (e) => {
			var n = Cd(), r = B(R(n), 2);
			J(r, 20, () => H(y), (e) => e, (e, n) => {
				let r = /* @__PURE__ */ P(() => ql(n, t.indexed.analysis.economics.costBasis, t.indexed.analysis.session.source));
				var i = Sd(), a = L(i), o = (e) => {
					var t = bd(), n = R(t), i = z(n, !0), a = B(n);
					V(() => {
						K(i, H(r).title), K(a, ` — ${H(r).impact ?? ""}`);
					}), G(e, t);
				}, s = (e) => {
					var t = xd();
					be(), G(e, t);
				};
				q(a, (e) => {
					H(r) ? e(o) : e(s, -1);
				}), N(i), G(e, i);
			}), N(r), G(e, n);
		};
		q(bt, (e) => {
			H(y).length > 0 && e(xt);
		}), N(Ue), di(Ue, (e, t) => Wi?.(e, t), () => ({
			state: r(),
			key: "usage"
		}));
		var St = B(Ue, 2), Ct = B(L(St), 2), wt = L(Ct), Tt = z(B(L(wt), 2), !0);
		N(wt);
		var Et = B(wt, 2), Dt = (e) => {
			var n = wd(), r = R(n), i = z(B(L(r), 2), !0);
			N(r);
			var a = B(r, 2), o = z(B(L(a), 2), !0);
			N(a);
			var s = B(a, 2), c = z(B(L(s), 2));
			N(s), V((e, t, n, r) => {
				K(i, e), K(o, t), K(c, `${n ?? ""} (${r ?? ""})`);
			}, [
				() => Z(t.call.tokenAnalysis.knownFramingOverheadTokens),
				() => Z(t.call.tokenAnalysis.calculatedRequestTokens),
				() => Z(t.call.tokenAnalysis.residualTokens),
				() => Ha(t.call.tokenAnalysis.residualPercent)
			]), G(e, n);
		}, Ot = (e) => {
			var t = Td(), n = B(L(t), 2), r = L(n), i = B(r), a = (e) => {
				var t = zr();
				V((e) => K(t, `(${e ?? ""} of reported input)`), [() => Ha((H(c).reported - H(c).reconstructed) / H(c).reported)]), G(e, t);
			};
			q(i, (e) => {
				H(c).reported > 0 && e(a);
			}), N(n), N(t), V((e) => K(r, `${e ?? ""} tokens `), [() => Z(H(c).reported - H(c).reconstructed)]), G(e, t);
		};
		q(Et, (e) => {
			t.call.tokenAnalysis.calculatedRequestTokens === null ? H(c) && e(Ot, 1) : e(Dt);
		});
		var kt = B(Et, 2), At = z(B(L(kt), 2), !0);
		N(kt);
		var jt = B(kt, 2), Mt = z(B(L(jt), 2), !0);
		N(jt);
		var Nt = B(jt, 2), Pt = z(B(L(Nt), 2), !0);
		N(Nt);
		var Ft = B(Nt, 2), It = z(B(L(Ft), 2));
		N(Ft), N(Ct);
		var Lt = B(Ct, 2), Rt = (e) => {
			var t = Dd(), n = B(R(t), 2);
			J(n, 20, () => H(h), (e) => e, (e, t) => {
				let n = /* @__PURE__ */ P(() => zo(t));
				var r = Sd(), i = L(r), a = (e) => {
					var t = bd(), r = R(t), i = z(r, !0), a = B(r);
					V(() => {
						K(i, H(n).title), K(a, ` — ${H(n).impact ?? ""}`);
					}), G(e, t);
				}, o = (e) => {
					var t = Ed();
					be(), G(e, t);
				};
				q(i, (e) => {
					H(n) ? e(a) : e(o, -1);
				}), N(r), G(e, r);
			}), N(n), G(e, t);
		};
		q(Lt, (e) => {
			H(h).length > 0 && e(Rt);
		}), N(St), di(St, (e, t) => Wi?.(e, t), () => ({
			state: r(),
			key: "diagnostics"
		}));
		var zt = B(St, 2), Bt = B(L(zt), 2), Vt = L(Bt), Ht = (e) => {
			var n = Od(), r = R(n), i = z(B(L(r), 2), !0);
			N(r);
			var a = B(r, 2), o = z(B(L(a), 2), !0);
			N(a);
			var s = B(a, 2), c = z(B(L(s), 2), !0);
			N(s), V((e, t, n) => {
				K(i, e), K(o, t), K(c, n);
			}, [
				() => Z(t.call.usage.cacheWrite1h),
				() => pu(t.call.usage.outputReasoningRelationship),
				() => Z(t.call.reportedCompletionTokens)
			]), G(e, n);
		};
		q(Vt, (e) => {
			t.call.usage.placeholder || e(Ht);
		});
		var Ut = B(Vt, 2), Wt = z(B(L(Ut), 2), !0);
		N(Ut);
		var Gt = B(Ut, 2), Kt = z(B(L(Gt), 2), !0);
		N(Gt);
		var qt = B(Gt, 2), Jt = z(B(L(qt), 2), !0);
		N(qt);
		var F = B(qt, 2), Yt = z(B(L(F), 2), !0);
		N(F);
		var I = B(F, 2), Xt = z(B(L(I), 2));
		N(I);
		var Zt = B(I, 2), Qt = (e) => {
			var n = kd(), r = z(B(L(n), 2), !0);
			N(n), V(() => K(r, t.call.tokenAnalysis.status)), G(e, n);
		};
		q(Zt, (e) => {
			t.call.tokenAnalysis.status !== "unavailable" && e(Qt);
		});
		var $t = B(Zt, 2), en = B(L($t), 2), tn = L(en), nn = (e) => {
			var t = od(), n = R(t), r = B(n), i = (e) => {
				var t = Ad(), n = z(t, !0);
				V((e) => K(n, e), [() => pa(H(T))]), G(e, t);
			}, a = /* @__PURE__ */ P(() => pa(H(T)));
			q(r, (e) => {
				H(a) && e(i);
			}), V((e) => K(n, `${H(T).provider ?? ""} / ${H(T).model ?? ""} · ${e ?? ""} `), [() => ha(H(T).method)]), G(e, t);
		}, rn = (e) => {
			var n = zr();
			V(() => K(n, `Tokenizer profile unavailable · ${t.call.tokenizationProfileId ?? ""}`)), G(e, n);
		}, an = (e) => {
			G(e, zr("Unavailable"));
		};
		q(tn, (e) => {
			H(T) ? e(nn) : t.call.tokenizationProfileId ? e(rn, 1) : e(an, -1);
		}), N(en), N($t);
		var on = B($t, 2), sn = z(B(L(on), 2));
		N(on);
		var cn = B(on, 2), ln = z(B(L(cn), 2));
		N(cn), N(Bt), N(zt), di(zt, (e, t) => Wi?.(e, t), () => ({
			state: r(),
			key: "estimator"
		}));
		var un = B(zt, 2), dn = B(L(un), 2), fn = L(dn), pn = B(L(fn), 2), mn = L(pn), hn = z(mn, !0);
		Xa(B(mn, 2), {
			get value() {
				return t.call.sourceRecordId;
			},
			label: "source record ID"
		}), N(pn), N(fn);
		var gn = B(fn, 2), _n = (e) => {
			var n = jd(), r = B(L(n), 2), i = L(r), a = z(i, !0);
			Xa(B(i, 2), {
				get value() {
					return t.call.tokenizationProfileId;
				},
				label: "tokenization profile ID"
			}), N(r), N(n), V(() => K(a, t.call.tokenizationProfileId)), G(e, n);
		};
		q(gn, (e) => {
			t.call.tokenizationProfileId && e(_n);
		});
		var vn = B(gn, 2), yn = (e) => {
			var n = Md(), r = B(L(n), 2), i = L(r), a = z(i, !0);
			Xa(B(i, 2), {
				get value() {
					return t.call.economics.policyId;
				},
				label: "economics policy ID"
			}), N(r), N(n), V(() => K(a, t.call.economics.policyId)), G(e, n);
		};
		q(vn, (e) => {
			t.call.economics.policyId && e(yn);
		}), N(dn);
		var bn = B(dn, 2), xn = L(bn), Sn = z(B(L(xn), 2), !0);
		N(xn);
		var Cn = B(xn, 2), wn = (e) => {
			var t = Nd(), n = R(t), r = z(B(L(n), 2));
			N(n);
			var i = B(n, 2), a = B(L(i), 2), o = z(L(a), !0);
			N(a), N(i), V((e, t) => {
				K(r, `${e ?? ""} removed ·
              ${t ?? ""} retained`), K(o, H(l).id);
			}, [() => Q(H(l).sourceItemIds.length), () => Q(H(l).retainedItemIds.length)]), G(e, t);
		};
		q(Cn, (e) => {
			H(l) && e(wn);
		}), N(bn);
		var Tn = B(bn, 2), En = (e) => {
			var n = Id(), r = B(R(n), 2);
			J(r, 21, () => t.call.toolCallsAfter, (e) => e.id, (e, t) => {
				var n = Fd(), r = L(n), i = B(r), a = z(i, !0), o = B(i, 2);
				{
					let e = /* @__PURE__ */ P(() => `${H(t).name} tool-call ID`);
					Xa(o, {
						get value() {
							return H(t).id;
						},
						get label() {
							return H(e);
						}
					});
				}
				var s = B(o, 2), c = (e) => {
					G(e, Pd());
				};
				q(s, (e) => {
					H(t).failed && e(c);
				}), N(n), V(() => {
					K(r, `${H(t).name ?? ""} `), K(a, H(t).id);
				}), G(e, n);
			}), N(r), G(e, n);
		};
		q(Tn, (e) => {
			H(u).length > 0 && e(En);
		});
		var Dn = B(Tn, 2), On = (e) => {
			var t = Rd(), n = B(R(t), 2);
			J(n, 20, () => H(f), (e) => e, (e, t) => {
				var n = Ld(), r = z(L(n), !0);
				N(n), V(() => K(r, t)), G(e, n);
			}), N(n), G(e, t);
		};
		q(Dn, (e) => {
			H(f).length > 0 && e(On);
		});
		var kn = B(Dn, 2), An = (e) => {
			var t = zd(), n = B(R(t), 2);
			J(n, 20, () => H(y), (e) => e, (e, t) => {
				var n = Ld(), r = z(L(n), !0);
				N(n), V(() => K(r, t)), G(e, n);
			}), N(n), G(e, t);
		};
		q(kn, (e) => {
			H(y).length > 0 && e(An);
		}), N(un), di(un, (e, t) => Wi?.(e, t), () => ({
			state: r(),
			key: "identifiers"
		})), N(p), V((e, r, a, o, s, c, l, u, d, f, m, h, g, _, v, y, b, x, S, ee, C, w, T, E, D, O, k, te) => {
			Y(p, "aria-label", `${i() ? "Pinned" : "Model"} call ${t.call.index}`), K(le, `${i() ? "Pinned call" : "Call"}
          ${t.call.index ?? ""}`), K(de, `${t.call.provider ?? "Unknown provider" ?? ""} / ${t.call.model ?? "Unknown model" ?? ""}`), K(j, `${e ?? ""} `), Y(Ce, "aria-describedby", `${n}-cost`), K(we, r), K(Ee, a), K(Ze, o), K(Qe, s), K(tt, t.call.economics.policyId ? "Cache read" : "Cache read (raw field)"), K(nt, c), K(at, l), K(ot, u), K(ct, d), K(ut, f), K(pt, m), K(mt, h), K(Tt, g), K(At, _), K(Mt, v), K(Pt, y), K(It, `${b ?? ""} /
            ${x ?? ""} calls`), K(Wt, S), K(Kt, ee), K(Jt, C), K(Yt, t.call.cumulativeReportedUsageCompleteness), K(Xt, `${w ?? ""}
            items complete · ${T ?? ""} partial
            · ${E ?? ""} unavailable`), K(sn, `${D ?? ""} calls`), K(ln, `${O ?? ""} /
            ${k ?? ""} /
            ${te ?? ""}`), K(hn, t.call.sourceRecordId), K(Sn, t.call.stopReason ?? "Unknown");
		}, [
			() => t.call.usage.placeholder ? "Unavailable" : Z(t.call.reportedPromptTokens),
			() => t.call.usage.placeholder ? "Unavailable" : tu(t.call.costAssessment),
			() => $l(t.call.costAssessment, t.indexed.analysis.session.source),
			() => te(t.call.economics.policyId),
			() => Z(t.call.usage.input),
			() => Z(t.call.usage.cacheRead),
			() => re(),
			() => A(),
			() => ie(t.call.economics.cacheReadRatio),
			() => ae(),
			() => ne(t.call.economics.policyId),
			() => oe(),
			() => Z(t.call.tokenAnalysis.calculatedVisibleTokens),
			() => Yu(t.call.tokenAnalysis.addedTokens, Z, H(s)),
			() => Yu(t.call.tokenAnalysis.retainedTokens, Z, H(s)),
			() => Yu(t.call.tokenAnalysis.droppedTokens, Z, H(s)),
			() => Z(t.call.tokenAnalysis.age.oldestLiveItemAgeCalls),
			() => Z(t.call.tokenAnalysis.age.medianLiveItemAgeCalls),
			() => Z(t.call.cumulativeReportedPromptTokens),
			() => Z(t.call.cumulativeReportedCompletionTokens),
			() => Z(t.call.cumulativeReportedReasoningTokens),
			() => qa(t.call.tokenAnalysis.estimateCoverage.completeItems, t.call.tokenAnalysis.estimateCoverage.totalItems),
			() => Q(t.call.tokenAnalysis.estimateCoverage.partialItems),
			() => Q(t.call.tokenAnalysis.estimateCoverage.unavailableItems),
			() => Yu(t.call.tokenAnalysis.age.tokenWeightedMeanAgeCalls, Z, H(s)),
			() => Q(t.call.tokenAnalysis.age.itemsAtLeast5CallsOld),
			() => Q(t.call.tokenAnalysis.age.itemsAtLeast10CallsOld),
			() => Q(t.call.tokenAnalysis.age.itemsAtLeast20CallsOld)
		]), G(e, p);
	};
	q(ce, (e) => {
		t.call && e(le);
	}), G(e, se), Ve();
}
kr(["click"]);
//#endregion
//#region src/lib/components/ItemPreview.svelte
var Ud = /* @__PURE__ */ W("<pre class=\"svelte-cl7alh\"> </pre>"), Wd = /* @__PURE__ */ W("<p class=\"preview-note svelte-cl7alh\">Expanded preview truncated.</p>"), Gd = /* @__PURE__ */ W("<pre class=\"svelte-cl7alh\"> </pre> <!>", 1), Kd = /* @__PURE__ */ W("<p class=\"content-preview svelte-cl7alh\"><b>Content preview</b> </p>"), qd = /* @__PURE__ */ W("<p class=\"preview-note svelte-cl7alh\">No content preview is available.</p>"), Jd = /* @__PURE__ */ W("<p class=\"preview-note svelte-cl7alh\" role=\"status\">Loading content…</p>"), Yd = /* @__PURE__ */ W("<p class=\"preview-note svelte-cl7alh\" role=\"alert\"> </p> <button type=\"button\" class=\"preview-toggle svelte-cl7alh\">Retry</button>", 1), Xd = /* @__PURE__ */ W("<button type=\"button\" class=\"preview-toggle svelte-cl7alh\">Load more</button>"), Zd = /* @__PURE__ */ W("<button type=\"button\" class=\"preview-toggle svelte-cl7alh\"> </button>"), Qd = /* @__PURE__ */ W("<div class=\"preview-details\"><!> <!> <!> <!></div>"), $d = {
	hash: "svelte-cl7alh",
	code: ".content-preview.svelte-cl7alh {color:var(--text);white-space:pre-wrap;overflow-wrap:anywhere;}.preview-note.svelte-cl7alh {color:var(--secondary);font-size:var(--text-sm);}.preview-toggle.svelte-cl7alh {display:block;width:fit-content;margin:7px 0 0 auto;min-height:28px;padding:4px 8px;font-size:var(--text-xs);color:var(--secondary);background:transparent;border:1px solid transparent;}.preview-toggle.svelte-cl7alh:hover {text-decoration:underline;background:var(--plot);}pre.svelte-cl7alh {color:var(--text);background:var(--plot);border-radius:var(--control-radius);margin:7px 0 0;padding:8px;white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;}"
};
function ef(e, t) {
	Be(t, !0), ui(e, $d);
	let n = /* @__PURE__ */ P(() => t.preview?.expandedText), r = /* @__PURE__ */ P(() => H(n) !== void 0 && (H(n) !== t.preview?.text || t.preview?.expandedTruncated)), i = /* @__PURE__ */ P(() => !!t.loadItemContent && H(n) === void 0 && !!t.preview?.truncated && t.preview.kind !== "unavailable"), a = /* @__PURE__ */ F(!1), o = /* @__PURE__ */ F(null), s = /* @__PURE__ */ F(null), c = /* @__PURE__ */ F(null), l = /* @__PURE__ */ F("");
	function u() {
		H(c)?.abort(), I(c, null), I(o, null), I(s, null), I(l, ""), I(a, !1);
	}
	async function d() {
		if (!t.loadItemContent || H(c)) return;
		I(a, !0), I(l, "");
		let e = new AbortController();
		I(c, e);
		try {
			let n = await t.loadItemContent(t.sessionId, t.itemId, H(s), e.signal);
			if (e.signal.aborted) return;
			I(o, (H(o) ?? "") + n.text), I(s, n.nextCursor, !0);
		} catch (t) {
			e.signal.aborted || I(l, t instanceof Error ? t.message : "Could not load item content.", !0);
		} finally {
			H(c) === e && I(c, null);
		}
	}
	Vi(() => H(c)?.abort());
	var f = Qd(), p = L(f), m = (e) => {
		var t = Ud(), n = z(t, !0);
		V(() => K(n, H(o))), G(e, t);
	}, h = (e) => {
		var r = Gd(), i = R(r), a = z(i, !0), o = B(i, 2), s = (e) => {
			G(e, Wd());
		};
		q(o, (e) => {
			t.preview?.expandedTruncated && e(s);
		}), V(() => K(a, H(n))), G(e, r);
	}, g = (e) => {
		var n = Kd(), r = B(L(n));
		N(n), V(() => K(r, ` ${t.preview.text ?? ""}`)), G(e, n);
	}, _ = (e) => {
		G(e, qd());
	};
	q(p, (e) => {
		H(a) && H(o) !== null ? e(m) : H(r) && t.legacyExpanded ? e(h, 1) : t.preview?.text ? e(g, 2) : e(_, -1);
	});
	var v = B(p, 2), y = (e) => {
		G(e, Jd());
	}, b = (e) => {
		var t = Yd(), n = R(t), r = z(n, !0), i = B(n, 2);
		V(() => K(r, H(l))), U("click", i, d), G(e, t);
	};
	q(v, (e) => {
		H(c) ? e(y) : H(l) && e(b, 1);
	});
	var x = B(v, 2), S = (e) => {
		var t = Xd();
		V(() => t.disabled = !!H(c)), U("click", t, d), G(e, t);
	};
	q(x, (e) => {
		H(a) && H(s) !== null && !H(l) && e(S);
	});
	var ee = B(x, 2), C = (e) => {
		var t = Zd(), n = z(t, !0);
		V(() => {
			Y(t, "aria-expanded", H(a)), K(n, H(a) ? "Show less" : "Show more");
		}), U("click", t, () => H(a) ? u() : d()), G(e, t);
	}, w = (e) => {
		var n = Zd(), r = z(n, !0);
		V(() => {
			Y(n, "aria-expanded", t.legacyExpanded), K(r, t.legacyExpanded ? "Show less" : "Show more");
		}), U("click", n, function(...e) {
			t.onToggleLegacy?.apply(this, e);
		}), G(e, n);
	};
	q(ee, (e) => {
		H(i) || H(a) ? e(C) : H(r) && e(w, 1);
	}), N(f), G(e, f), Ve();
}
kr(["click"]);
//#endregion
//#region src/lib/session-links.ts
function tf(e) {
	return e.metadata.childSession || null;
}
function nf(e, t = null) {
	let n = new URLSearchParams({ session: e });
	return t !== null && n.set("child", t), `#${n}`;
}
function rf(e, t) {
	return e.filter((e) => e.parentReference === t);
}
//#endregion
//#region src/lib/compaction-details.ts
var af = /* @__PURE__ */ new Set(["automatic", "manual"]), of = /* @__PURE__ */ new Set([
	"keptFromEntry",
	"recentExchange",
	"preservedSegment",
	"summaryOnly",
	"replacementHistory",
	"keptLastMessages",
	"inferredFromInput"
]), sf = [
	"durationMs",
	"messagesBefore",
	"messagesRemoved",
	"messagesKept",
	"messagesAddedWhileRunning",
	"tokensAfter",
	"systemTokensAfter",
	"toolDefinitionTokensAfter",
	"conversationTokensAfter"
];
function cf(e, t) {
	let n = e.details, r = (t) => {
		throw new $(`Compaction ${e.id} has ${t}`);
	};
	if (!n || typeof n != "object") return r("no details");
	n.trigger !== null && !af.has(n.trigger) && r("an unknown trigger"), n.rule !== null && !of.has(n.rule) && r("an unknown rule"), n.instructions !== null && typeof n.instructions != "string" && r("invalid instructions");
	for (let e of sf) {
		let t = n[e];
		t !== null && (!Number.isSafeInteger(t) || t < 0) && r(`an invalid ${e}`);
	}
	let i = n.startedBeforeModelCall;
	i !== null && (!Number.isSafeInteger(i) || i < 1 || i > e.beforeModelCall) && r("a start after it is applied"), n.summaryCall !== null && !t.has(n.summaryCall) && r("an unknown summary call");
}
var lf = (e, t, n) => `${Q(e)} ${e === 1 ? t : n}`;
function uf(e, t) {
	let n = Zl(t), r = e.details, i = e.retainedItemIds.length;
	switch (r.rule) {
		case "keptLastMessages": {
			let e = r.messagesKept ?? 0, t = r.messagesAddedWhileRunning;
			return `${n} kept the last ${lf(e, "message", "messages")} from when the compaction started` + (t ? `, and the ${lf(t, "message", "messages")} added while it ran.` : ".");
		}
		case "keptFromEntry": return `${n} kept everything from the first entry it marked to keep: ${lf(i, "item", "items")}.`;
		case "preservedSegment": return `${n} kept the recent messages it recorded as preserved: ${lf(r.messagesKept ?? i, "message", "messages")}.`;
		case "recentExchange": return `${n} kept its summary and the recent exchange it saved with it, as one item.`;
		case "replacementHistory": return `${n} recorded the conversation that replaced the old one; ${lf(i, "item", "items")} in it were already in context.`;
		case "summaryOnly": return `${n} kept only its summary.`;
		case "inferredFromInput": return `${n} does not record what it kept, so this was worked out from the next call's input.`;
		default: return null;
	}
}
function df(e, t, n) {
	let r = e.details, i = Zl(t), a = [];
	if (r.trigger && a.push({
		label: "Started",
		value: r.trigger === "manual" ? r.instructions ? `By the user, with the focus “${r.instructions}”` : "By the user" : `Automatically by ${i}`
	}), a.push({
		label: "When",
		value: r.startedBeforeModelCall !== null && r.startedBeforeModelCall < e.beforeModelCall ? `Started before call ${r.startedBeforeModelCall} and ran in the background; applied before call ${e.beforeModelCall}` : `Before call ${e.beforeModelCall}`
	}), r.durationMs !== null && a.push({
		label: "Took",
		value: zu(r.durationMs)
	}), a.push({
		label: "Items",
		value: `${Q(e.sourceItemIds.length)} removed · ${Q(e.retainedItemIds.length)} kept`
	}), r.messagesBefore !== null || r.messagesRemoved !== null) {
		let e = [
			r.messagesBefore !== null && `${Q(r.messagesBefore)} before`,
			r.messagesRemoved !== null && `${Q(r.messagesRemoved)} removed`,
			r.messagesKept !== null && `${Q(r.messagesKept)} kept`
		].filter(Boolean);
		a.push({
			label: `Messages, as ${i} counts them`,
			value: e.join(" · ")
		});
	} else r.messagesKept !== null && a.push({
		label: `Messages, as ${i} counts them`,
		value: `${Q(r.messagesKept)} kept`
	});
	(e.tokensBefore !== null || r.tokensAfter !== null) && a.push({
		label: `Tokens, as ${i} counts them`,
		value: [e.tokensBefore !== null && `${Q(e.tokensBefore)} before`, r.tokensAfter !== null && `${Q(r.tokensAfter)} after`].filter(Boolean).join(" · ")
	});
	let o = [
		r.systemTokensAfter !== null && `${Q(r.systemTokensAfter)} system prompt`,
		r.toolDefinitionTokensAfter !== null && `${Q(r.toolDefinitionTokensAfter)} tool definitions`,
		r.conversationTokensAfter !== null && `${Q(r.conversationTokensAfter)} conversation`
	].filter(Boolean);
	o.length > 0 && a.push({
		label: "After it, in tokens",
		value: o.join(" · ")
	});
	let s = r.summaryCall === null ? null : n.get(r.summaryCall) ?? null;
	return a.push({
		label: "Its own call",
		value: s ? `Call ${s.index} · ${Z(s.reportedPromptTokens)} input · ${Ba(s.costAssessment.amount)}` : `Not recorded by ${i}`
	}), {
		rule: uf(e, t),
		rows: a,
		summaryCall: s
	};
}
//#endregion
//#region src/lib/components/ItemDetails.svelte
var ff = /* @__PURE__ */ W("<p class=\"presence-note svelte-bb734v\">This item has no model-call presence, so it has no location to reveal in Context River.</p>"), pf = /* @__PURE__ */ W("<p class=\"presence-note svelte-bb734v\"> </p>"), mf = /* @__PURE__ */ W("<button type=\"button\">Reveal in River</button>"), hf = /* @__PURE__ */ W("<button type=\"button\"> </button>"), gf = /* @__PURE__ */ W("<small class=\"svelte-bb734v\">Latest actual presence; not a newly pinned call.</small>"), _f = /* @__PURE__ */ W("<small class=\"svelte-bb734v\"> </small>"), vf = /* @__PURE__ */ W("<small class=\"svelte-bb734v\">Includes partial, heuristic or unavailable profile estimates.</small>"), yf = /* @__PURE__ */ W("Started <a class=\"svelte-bb734v\"> </a>", 1), bf = /* @__PURE__ */ W("<h4 class=\"svelte-bb734v\">Child session</h4> <p class=\"svelte-bb734v\"><!></p>", 1), xf = /* @__PURE__ */ W("<p class=\"svelte-bb734v\"> </p>"), Sf = /* @__PURE__ */ W("<div><dt class=\"svelte-bb734v\"> </dt> <dd class=\"svelte-bb734v\"> </dd></div>"), Cf = /* @__PURE__ */ W("<p class=\"svelte-bb734v\"> </p> <!> <dl class=\"detail-rows compaction-rows svelte-bb734v\"></dl> <!>", 1), wf = /* @__PURE__ */ W("<h4 class=\"svelte-bb734v\">Compaction</h4> <!> <!> <!>", 1), Tf = /* @__PURE__ */ W("<b class=\"svelte-bb734v\"> </b>"), Ef = /* @__PURE__ */ W("<li class=\"svelte-bb734v\"><!> <!></li>"), Df = /* @__PURE__ */ W("<h4 class=\"svelte-bb734v\">Versions</h4> <ol class=\"versions svelte-bb734v\"></ol>", 1), Of = /* @__PURE__ */ W("<button type=\"button\" class=\"svelte-bb734v\"> </button>"), kf = /* @__PURE__ */ W("<div class=\"relations svelte-bb734v\"><span class=\"svelte-bb734v\">Predecessors</span> <!></div>"), Af = /* @__PURE__ */ W("<div class=\"relations svelte-bb734v\"><span class=\"svelte-bb734v\">Successors</span> <!></div>"), jf = /* @__PURE__ */ W("<div class=\"lineage-actions svelte-bb734v\"><b>Lineage actions</b> <!> <!></div>"), Mf = /* @__PURE__ */ W("<small class=\"metric-note\"> </small>"), Nf = /* @__PURE__ */ W(" <!>", 1), Pf = /* @__PURE__ */ W("<div><dt class=\"svelte-bb734v\">Selected estimate method</dt> <dd class=\"svelte-bb734v\"> </dd></div> <div><dt class=\"svelte-bb734v\">Selected estimate coverage</dt> <dd class=\"svelte-bb734v\"> </dd></div>", 1), Ff = /* @__PURE__ */ W("<p class=\"svelte-bb734v\">Unavailable</p>"), If = /* @__PURE__ */ W("<li><b> </b> </li>"), Lf = /* @__PURE__ */ W("<ul class=\"svelte-bb734v\"></ul>"), Rf = /* @__PURE__ */ W("<b> </b> ", 1), zf = /* @__PURE__ */ W("<b>Unrecognized diagnostic</b> — see the raw code in Technical identifiers.", 1), Bf = /* @__PURE__ */ W("<li><!></li>"), Vf = /* @__PURE__ */ W("<h4 class=\"svelte-bb734v\">Diagnostic explanations</h4> <ul class=\"diagnostics svelte-bb734v\"></ul>", 1), Hf = /* @__PURE__ */ W("<div><dt class=\"svelte-bb734v\">Estimate profile ID</dt> <dd class=\"svelte-bb734v\"><code class=\"svelte-bb734v\"> </code> <!></dd></div>"), Uf = /* @__PURE__ */ W("<div><dt class=\"svelte-bb734v\">Source record ID</dt> <dd class=\"svelte-bb734v\"><code class=\"svelte-bb734v\"> </code> <!></dd></div>"), Wf = /* @__PURE__ */ W("<div><dt class=\"svelte-bb734v\">Source tool-call ID</dt> <dd class=\"svelte-bb734v\"><code class=\"svelte-bb734v\"> </code> <!></dd></div>"), Gf = /* @__PURE__ */ W("<h4 class=\"svelte-bb734v\">Source metadata</h4> <ul class=\"svelte-bb734v\"></ul>", 1), Kf = /* @__PURE__ */ W("<li><code class=\"svelte-bb734v\"> </code></li>"), qf = /* @__PURE__ */ W("<h4 class=\"svelte-bb734v\">Raw diagnostic codes</h4> <ul class=\"svelte-bb734v\"></ul>", 1), Jf = /* @__PURE__ */ W("<header class=\"item-identity svelte-bb734v\"><div class=\"svelte-bb734v\"><span class=\"svelte-bb734v\"> </span> <h3 id=\"selected-item-summary\" class=\"selected-item-summary svelte-bb734v\" tabindex=\"-1\"> </h3></div></header> <!> <!> <!> <!> <details class=\"svelte-bb734v\"><summary class=\"svelte-bb734v\">Content preview</summary> <!></details> <dl class=\"essential-metrics svelte-bb734v\"><div><dt class=\"svelte-bb734v\">Lifetime</dt> <dd class=\"svelte-bb734v\"><!></dd></div> <div><dt class=\"svelte-bb734v\"><!></dt> <dd class=\"svelte-bb734v\"> <!></dd></div> <div><dt class=\"svelte-bb734v\">Whole-session exposure<!></dt> <dd class=\"svelte-bb734v\"> <!> <!></dd></div></dl> <!> <!> <!> <!> <details class=\"item-diagnostics svelte-bb734v\"><summary class=\"svelte-bb734v\">Diagnostics</summary> <dl class=\"detail-rows svelte-bb734v\"><div><dt class=\"svelte-bb734v\">Estimate basis</dt> <dd class=\"svelte-bb734v\"><!> </dd></div> <div><dt class=\"svelte-bb734v\">Token coverage</dt> <dd class=\"svelte-bb734v\"> </dd></div> <div><dt class=\"svelte-bb734v\">Serialized diagnostic size</dt> <dd class=\"svelte-bb734v\"> </dd></div> <!></dl> <h4 class=\"svelte-bb734v\">Profile estimates</h4> <!> <!></details> <details class=\"technical-identifiers svelte-bb734v\"><summary class=\"svelte-bb734v\">Technical identifiers</summary> <dl class=\"identifier-list svelte-bb734v\"><!> <div><dt class=\"svelte-bb734v\">Context ID</dt> <dd class=\"svelte-bb734v\"><code class=\"svelte-bb734v\"> </code><!></dd></div> <!> <!></dl> <!> <!></details>", 1), Yf = /* @__PURE__ */ W("<p class=\"svelte-bb734v\">Select an item to inspect its context.</p>"), Xf = /* @__PURE__ */ W("<section class=\"item-details svelte-bb734v\" aria-live=\"polite\"><!></section>"), Zf = {
	hash: "svelte-bb734v",
	code: ".item-details.svelte-bb734v {color:var(--text);min-width:0;}.item-identity.svelte-bb734v {position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:4px 0 7px;background:var(--surface);}.item-identity.svelte-bb734v > div:where(.svelte-bb734v) {display:grid;min-width:0;gap:5px;}.item-identity.svelte-bb734v span:where(.svelte-bb734v) {display:inline-block;color:var(--text);border:1px solid var(--separator);border-radius:999px;padding:2px 7px;font-size:var(--text-sm);}h3.svelte-bb734v {color:var(--text-strong);font-size:var(--text-lg);margin:0 0 6px;overflow-wrap:anywhere;}h3.svelte-bb734v:focus {outline:2px solid var(--accent);outline-offset:2px;}a.svelte-bb734v {color:var(--accent);}h4.svelte-bb734v {margin:11px 0 4px;color:var(--text);font-size:var(--text-sm);}.presence-note.svelte-bb734v {color:var(--secondary);font-size:var(--text-sm);}details.svelte-bb734v {margin-top:10px;}summary.svelte-bb734v {color:var(--text);cursor:pointer;}.essential-metrics.svelte-bb734v,\n  .detail-rows.svelte-bb734v {display:grid;grid-template-columns:minmax(0, 1fr);gap:7px 14px;margin:10px 0 0;}dt.svelte-bb734v {color:var(--secondary);font-size:var(--text-sm);}dd.svelte-bb734v {margin:1px 0 0;overflow-wrap:anywhere;color:var(--text);}.essential-metrics.svelte-bb734v dd:where(.svelte-bb734v) small:where(.svelte-bb734v) {display:block;margin-top:2px;color:var(--secondary);font-size:var(--text-sm);}.versions.svelte-bb734v {display:grid;gap:6px;margin:0;padding:0;list-style:none;font-size:var(--text-sm);}.versions.svelte-bb734v li:where(.svelte-bb734v) {display:grid;justify-items:start;gap:2px;}.versions.svelte-bb734v b:where(.svelte-bb734v) {font-weight:600;}.versions.svelte-bb734v small:where(.svelte-bb734v) {color:var(--secondary);overflow-wrap:anywhere;}.lineage-actions.svelte-bb734v {display:grid;gap:7px;margin-top:10px;}.relations.svelte-bb734v {display:flex;flex-wrap:wrap;align-items:center;gap:5px;}.relations.svelte-bb734v span:where(.svelte-bb734v) {color:var(--secondary);font-size:var(--text-sm);}.relations.svelte-bb734v button:where(.svelte-bb734v) {max-width:100%;overflow-wrap:anywhere;text-align:left;}.diagnostics.svelte-bb734v,\n  .item-diagnostics.svelte-bb734v ul:where(.svelte-bb734v),\n  .technical-identifiers.svelte-bb734v ul:where(.svelte-bb734v) {margin:4px 0 0;padding-left:18px;overflow-wrap:anywhere;font-size:var(--text-sm);}.identifier-list.svelte-bb734v {display:grid;gap:7px;margin:8px 0 0;}.identifier-list.svelte-bb734v dd:where(.svelte-bb734v) {display:grid;justify-items:start;gap:4px;}code.svelte-bb734v {color:var(--secondary);overflow-wrap:anywhere;user-select:all;}.technical-identifiers.svelte-bb734v code:where(.svelte-bb734v) {display:block;}p.svelte-bb734v {margin:8px 0 0;}\n  @container highwater (max-width: 520px) {.essential-metrics.svelte-bb734v,\n    .detail-rows.svelte-bb734v {grid-template-columns:1fr;}\n  }"
};
function Qf(e, t) {
	Be(t, !0), ui(e, Zf);
	let n = X(t, "sections", 23, Ui), r = X(t, "onInspectCall", 3, () => {}), i = X(t, "callIndex", 3, null), a = X(t, "pinnedCallIndex", 3, null), o = X(t, "onSelectItem", 3, () => {}), s = X(t, "onRevealInRiver", 3, () => {}), c = X(t, "sessions", 19, () => []), l = /* @__PURE__ */ P(() => t.item ? tf(t.item) : null), u = /* @__PURE__ */ P(() => H(l) ? c().find((e) => e.id === H(l)) : void 0), d = /* @__PURE__ */ P(() => t.item ? t.indexed.compactionBySourceId.get(t.item.id) ?? [] : []), f = /* @__PURE__ */ P(() => t.item ? t.indexed.compactionBySummaryId.get(t.item.id) ?? null : null), p = /* @__PURE__ */ P(() => H(f) ? df(H(f), t.indexed.analysis.session.source, t.indexed.callByIndex) : null), h = /* @__PURE__ */ P(() => t.item ? t.indexed.compactionsByRetainedId.get(t.item.id) ?? [] : []), g = /* @__PURE__ */ P(() => t.item ? (t.indexed.incomingLineage.get(t.item.id) ?? []).map((e) => e.from) : []), _ = /* @__PURE__ */ P(() => t.item ? (t.indexed.outgoingLineage.get(t.item.id) ?? []).map((e) => e.to) : []), v = /* @__PURE__ */ P(() => t.item ? t.indexed.versionByItemId.get(t.item.id) ?? null : null), y = /* @__PURE__ */ P(() => t.item && H(v) ? gc(t.indexed.itemById, t.indexed.versionByItemId, t.item.id) : []), b = /* @__PURE__ */ P(() => t.indexed.analysis.modelCalls.length), x = /* @__PURE__ */ P(() => i() === null ? null : t.indexed.callByIndex.get(i()) ?? null), S = /* @__PURE__ */ P(() => a() === null ? null : t.indexed.callByIndex.get(a()) ?? null), ee = /* @__PURE__ */ P(() => t.item !== null && H(S) !== null && !H(S).contextItemIds.includes(t.item.id)), C = /* @__PURE__ */ P(() => t.item?.presence.length ? t.indexed.callByIndex.get(t.item.presence[0].startCall) ?? null : null), w = /* @__PURE__ */ P(() => t.item && t.item.presence.length > 0 ? t.indexed.callByIndex.get(t.item.lastModelCall) ?? null : null), T = /* @__PURE__ */ P(() => H(x) && H(x).contextItemIds.includes(t.item?.id ?? "") ? H(x) : a() === null ? H(w) : null), E = /* @__PURE__ */ P(() => H(x) === null && H(T) !== null), D = /* @__PURE__ */ P(() => t.item && H(T) ? t.item.tokenEstimates.find((e) => e.profileId === H(T)?.tokenizationProfileId) : void 0), O = /* @__PURE__ */ P(() => H(D) ? t.indexed.analysis.tokenAnalysis.profiles.find((e) => e.id === H(D).profileId) ?? null : null), k = /* @__PURE__ */ P(() => n().expandedPreview);
	function te() {
		I(k, !H(k)), n().expandedPreview = H(k);
	}
	let A = /* @__PURE__ */ P(() => [...new Set(t.item?.tokenEstimates.flatMap((e) => e.noteCodes) ?? [])]);
	function ne(e) {
		return Fo(t.indexed.itemById.get(e), e);
	}
	function re(e) {
		let n = t.indexed.callByIndex.get(e.firstModelCall)?.tokenizationProfileId ?? "";
		return t.indexed.itemEstimateByProfile.get(e.id)?.get(n)?.tokens ?? null;
	}
	function ie(e, t) {
		return `Version ${t} · ${ae(e)} · ${Z(re(e))} tokens`;
	}
	function ae(e) {
		return e.presence.map((e) => e.startCall === e.endCall ? `call ${e.startCall}` : `calls ${e.startCall}–${e.endCall}`).join(", ");
	}
	function oe() {
		return !t.item || t.item.presence.length === 0 ? "No model-call presence" : t.item.presence.map((e) => e.startCall === e.endCall ? `call ${e.startCall}` : `calls ${e.startCall}–${e.endCall}`).join(", ");
	}
	var se = Xf(), ce = L(se), le = (e) => {
		var i = Jf(), c = R(i), x = L(c), w = L(x), re = z(w), ae = z(B(w, 2), !0);
		N(x), N(c);
		var se = B(c, 2), ce = (e) => {
			G(e, ff());
		}, le = (e) => {
			var t = pf(), n = z(t);
			V(() => K(n, `This item is not present at pinned call ${H(S).index ?? ""}. Its inspector remains selected.`)), G(e, t);
		};
		q(se, (e) => {
			t.item.presence.length === 0 ? e(ce) : H(ee) && H(S) && e(le, 1);
		});
		var ue = B(se, 2), de = (e) => {
			var n = mf();
			U("click", n, () => s()(t.item.id)), G(e, n);
		};
		q(ue, (e) => {
			t.item.presence.length > 0 && e(de);
		});
		var fe = B(ue, 2), pe = (e) => {
			var t = hf(), n = z(t);
			V(() => K(n, `Inspect first included call · ${H(C).index ?? ""}`)), U("click", t, () => r()(H(C).index)), G(e, t);
		};
		q(fe, (e) => {
			H(C) && H(C).index !== a() && e(pe);
		});
		var me = B(fe, 2), he = (e) => {
			var t = pf(), n = z(t);
			V((e) => K(n, `Estimate: ${H(D).coverage ?? ""} · ${e ?? ""}`), [() => ha(H(D).method)]), G(e, t);
		};
		q(me, (e) => {
			H(D) && (H(D).coverage !== "complete" || H(D).method === "characterHeuristic") && e(he);
		});
		var ge = B(me, 2);
		$r(B(L(ge), 2), () => JSON.stringify([t.sessionId ?? t.indexed.analysis.session.id, t.item.id]), (e) => {
			{
				let n = /* @__PURE__ */ P(() => t.sessionId ?? t.indexed.analysis.session.id);
				ef(e, {
					get preview() {
						return t.item.preview;
					},
					get itemId() {
						return t.item.id;
					},
					get sessionId() {
						return H(n);
					},
					get loadItemContent() {
						return t.loadItemContent;
					},
					get legacyExpanded() {
						return H(k);
					},
					onToggleLegacy: te
				});
			}
		}), N(ge), di(ge, (e, t) => Wi?.(e, t), () => ({
			state: n(),
			key: "preview"
		}));
		var j = B(ge, 2), _e = L(j), M = B(L(_e), 2), ve = L(M), ye = (e) => {
			G(e, zr("No model-call presence"));
		}, xe = (e) => {
			var n = zr();
			V((e, t, r, i) => K(n, `${e ?? ""} · present in ${t ?? ""} of ${r ?? ""} calls (${i ?? ""} ranges)`), [
				() => oe(),
				() => Z(nc(t.item)),
				() => Z(H(b)),
				() => Z(t.item.presence.length)
			]), G(e, n);
		};
		q(ve, (e) => {
			t.item.presence.length === 0 ? e(ye) : e(xe, -1);
		}), N(M), N(_e);
		var Se = B(_e, 2), Ce = L(Se), we = L(Ce), Te = (e) => {
			var t = zr();
			V(() => K(t, a() === null ? H(E) ? "Tokens at last included call" : "Tokens at call" : "Tokens at pinned call")), G(e, t);
		}, Ee = (e) => {
			G(e, zr("Tokens at pinned call · unavailable"));
		}, De = (e) => {
			G(e, zr("Tokens at last included call · unavailable"));
		};
		q(we, (e) => {
			H(T) && H(D) ? e(Te) : a() === null ? e(De, -1) : e(Ee, 1);
		}), N(Ce);
		var Oe = B(Ce, 2), ke = L(Oe), Ae = B(ke), je = (e) => {
			G(e, gf());
		};
		q(Ae, (e) => {
			H(E) && e(je);
		}), N(Oe), N(Se);
		var Me = B(Se, 2), Ne = L(Me), Pe = B(L(Ne));
		{
			let e = /* @__PURE__ */ P(() => `item-exposure-note-${t.item.id}`);
			va(Pe, {
				get id() {
					return H(e);
				},
				label: "About whole-session exposure",
				children: (e, t) => {
					be(), G(e, zr("The item's estimated tokens added up over every call it appears in, in estimated\n            token-turns. It shows how much context the item took up across the session; it is not\n            usage or cost."));
				},
				$$slots: { default: !0 }
			});
		}
		N(Ne);
		var Fe = B(Ne, 2), Ie = L(Fe), Le = B(Ie), Re = (e) => {
			var n = _f(), r = z(n);
			V((e) => K(r, `Partial exposure · ${e ?? ""} calls covered`), [() => qa(t.item.tokenTurnsCoverage.coveredCalls, t.item.tokenTurnsCoverage.totalCalls)]), G(e, n);
		};
		q(Le, (e) => {
			t.item.tokenTurnsCoverage.coveredCalls < t.item.tokenTurnsCoverage.totalCalls && e(Re);
		});
		var ze = B(Le, 2), Be = (e) => {
			G(e, vf());
		}, Ve = /* @__PURE__ */ P(() => t.item.tokenEstimates.some((e) => e.coverage !== "complete" || e.method === "characterHeuristic"));
		q(ze, (e) => {
			H(Ve) && e(Be);
		}), N(Fe), N(Me), N(j);
		var He = B(j, 2), Ue = (e) => {
			var t = bf(), n = B(R(t), 2), r = L(n), i = (e) => {
				var t = yf(), n = B(R(t)), r = z(n, !0);
				V((e) => {
					Y(n, "href", e), K(r, H(u).displayName);
				}, [() => nf(H(u).id)]), G(e, t);
			}, a = (e) => {
				G(e, zr("Started a child session that is not listed."));
			};
			q(r, (e) => {
				H(u) ? e(i) : e(a, -1);
			}), N(n), G(e, t);
		};
		q(He, (e) => {
			H(l) && e(Ue);
		});
		var We = B(He, 2), Ge = (e) => {
			var t = wf(), n = B(R(t), 2), i = (e) => {
				var t = xf(), n = z(t);
				V((e) => K(n, `Removed at the compaction before call ${e ?? ""}.`), [() => H(d).map((e) => e.beforeModelCall).join(", ")]), G(e, t);
			};
			q(n, (e) => {
				H(d).length > 0 && e(i);
			});
			var a = B(n, 2), o = (e) => {
				var t = xf(), n = z(t);
				V((e) => K(n, `Retained unchanged through compaction before call ${e ?? ""}.`), [() => H(h).map((e) => e.beforeModelCall).join(", ")]), G(e, t);
			};
			q(a, (e) => {
				H(h).length > 0 && e(o);
			});
			var s = B(a, 2), c = (e) => {
				var t = Cf(), n = R(t), i = z(n), a = B(n, 2), o = (e) => {
					var t = xf(), n = z(t, !0);
					V(() => K(n, H(p).rule)), G(e, t);
				};
				q(a, (e) => {
					H(p).rule && e(o);
				});
				var s = B(a, 2);
				J(s, 21, () => H(p).rows, (e) => e.label, (e, t) => {
					var n = Sf(), r = L(n), i = z(r, !0), a = z(B(r, 2), !0);
					N(n), V(() => {
						K(i, H(t).label), K(a, H(t).value);
					}), G(e, n);
				}), N(s);
				var c = B(s, 2), l = (e) => {
					let t = /* @__PURE__ */ P(() => H(p).summaryCall);
					var n = hf(), i = z(n);
					V(() => K(i, `Inspect the compaction's call (${H(t).index ?? ""})`)), U("click", n, () => r()(H(t).index)), G(e, n);
				};
				q(c, (e) => {
					H(p).summaryCall && e(l);
				}), V((e) => K(i, `Replaces ${e ?? ""} items removed at the compaction
          before call ${H(f).beforeModelCall ?? ""}.`), [() => Z(H(f).sourceItemIds.length)]), G(e, t);
			};
			q(s, (e) => {
				H(f) && H(p) && e(c);
			}), G(e, t);
		};
		q(We, (e) => {
			(H(d).length > 0 || H(h).length > 0 || H(f)) && e(Ge);
		});
		var Ke = B(We, 2), qe = (e) => {
			var n = Df(), r = B(R(n), 2);
			J(r, 23, () => H(y), (e) => e.id, (e, n, r) => {
				var i = Ef(), a = L(i), s = (e) => {
					var t = Tf(), i = z(t);
					V((e) => K(i, `${e ?? ""} · this version`), [() => ie(H(n), H(r) + 1)]), G(e, t);
				}, c = (e) => {
					var t = hf(), i = z(t, !0);
					V((e) => K(i, e), [() => ie(H(n), H(r) + 1)]), U("click", t, () => o()(H(n).id)), G(e, t);
				};
				q(a, (e) => {
					H(n).id === t.item.id ? e(s) : e(c, -1);
				});
				var l = B(a, 2), u = (e) => {
					var r = _f(), i = z(r);
					V((e) => K(i, `Call ${H(n).firstModelCall ?? ""}: ${e ?? ""}`), [() => vc(t.indexed.analysis.contextItems, t.indexed.versionByItemId, H(n).firstModelCall)]), G(e, r);
				};
				q(l, (e) => {
					H(r) > 0 && t.item.kind === "system" && e(u);
				}), N(i), G(e, i);
			}), N(r), G(e, n);
		};
		q(Ke, (e) => {
			H(v) && e(qe);
		});
		var Je = B(Ke, 2), Ye = (e) => {
			var t = jf(), n = B(L(t), 2), r = (e) => {
				var t = kf();
				J(B(L(t), 2), 17, () => H(g), ei, (e, t) => {
					var n = Of(), r = z(n, !0);
					V((e, t) => {
						Y(n, "aria-label", e), K(r, t);
					}, [() => `Select predecessor ${ne(H(t))}`, () => ne(H(t))]), U("click", n, () => o()(H(t))), G(e, n);
				}), N(t), G(e, t);
			};
			q(n, (e) => {
				H(g).length > 0 && e(r);
			});
			var i = B(n, 2), a = (e) => {
				var t = Af();
				J(B(L(t), 2), 17, () => H(_), ei, (e, t) => {
					var n = Of(), r = z(n, !0);
					V((e, t) => {
						Y(n, "aria-label", e), K(r, t);
					}, [() => `Select successor ${ne(H(t))}`, () => ne(H(t))]), U("click", n, () => o()(H(t))), G(e, n);
				}), N(t), G(e, t);
			};
			q(i, (e) => {
				H(_).length > 0 && e(a);
			}), N(t), G(e, t);
		};
		q(Je, (e) => {
			(H(g).length > 0 || H(_).length > 0) && e(Ye);
		});
		var Xe = B(Je, 2), Ze = B(L(Xe), 2), Qe = L(Ze), $e = B(L(Qe), 2), et = L($e), tt = (e) => {
			var t = Nf(), n = R(t), r = B(n), i = (e) => {
				var t = Mf(), n = z(t, !0);
				V((e) => K(n, e), [() => pa(H(O))]), G(e, t);
			}, a = /* @__PURE__ */ P(() => pa(H(O)));
			q(r, (e) => {
				H(a) && e(i);
			}), V((e) => K(n, `${e ?? ""} · call ${H(T).index ?? ""} `), [() => H(O) ? `${H(O).provider} / ${H(O).model} · ${ha(H(D).method)}` : ha(H(D).method)]), G(e, t);
		}, nt = (e) => {
			var t = zr();
			V(() => K(t, `No applicable estimate at pinned call ${a() ?? ""}`)), G(e, t);
		}, rt = (e) => {
			G(e, zr("No applicable model-call estimate"));
		};
		q(et, (e) => {
			H(T) && H(D) ? e(tt) : a() === null ? e(rt, -1) : e(nt, 1);
		});
		var it = B(et);
		N($e), N(Qe);
		var at = B(Qe, 2), ot = z(B(L(at), 2));
		N(at);
		var st = B(at, 2), ct = z(B(L(st), 2), !0);
		N(st);
		var lt = B(st, 2), ut = (e) => {
			var t = Pf(), n = R(t), r = z(B(L(n), 2), !0);
			N(n);
			var i = B(n, 2), a = z(B(L(i), 2), !0);
			N(i), V(() => {
				K(r, H(D).method), K(a, H(D).coverage);
			}), G(e, t);
		};
		q(lt, (e) => {
			H(D) && e(ut);
		}), N(Ze);
		var dt = B(Ze, 4), ft = (e) => {
			G(e, Ff());
		}, pt = (e) => {
			var n = Lf();
			J(n, 21, () => t.item.tokenEstimates, (e) => e.profileId, (e, t) => {
				var n = If(), r = L(n), i = z(r, !0), a = B(r);
				N(n), V((e) => {
					K(i, H(t).profileId), K(a, ` · ${e ?? ""} tokens ·
              ${H(t).method ?? ""} · ${H(t).coverage ?? ""}`);
				}, [() => Z(H(t).tokens)]), G(e, n);
			}), N(n), G(e, n);
		};
		q(dt, (e) => {
			t.item.tokenEstimates.length === 0 ? e(ft) : e(pt, -1);
		});
		var mt = B(dt, 2), ht = (e) => {
			var t = Vf(), n = B(R(t), 2);
			J(n, 20, () => H(A), (e) => e, (e, t) => {
				let n = /* @__PURE__ */ P(() => zo(t));
				var r = Bf(), i = L(r), a = (e) => {
					var t = Rf(), r = R(t), i = z(r, !0), a = B(r);
					V(() => {
						K(i, H(n).title), K(a, ` — ${H(n).impact ?? ""}`);
					}), G(e, t);
				}, o = (e) => {
					var t = zf();
					be(), G(e, t);
				};
				q(i, (e) => {
					H(n) ? e(a) : e(o, -1);
				}), N(r), G(e, r);
			}), N(n), G(e, t);
		};
		q(mt, (e) => {
			H(A).length > 0 && e(ht);
		}), N(Xe), di(Xe, (e, t) => Wi?.(e, t), () => ({
			state: n(),
			key: "diagnostics"
		}));
		var gt = B(Xe, 2), _t = B(L(gt), 2), vt = L(_t), yt = (e) => {
			var t = Hf(), n = B(L(t), 2), r = L(n), i = z(r, !0);
			Xa(B(r, 2), {
				get value() {
					return H(D).profileId;
				},
				label: "estimate profile ID"
			}), N(n), N(t), V(() => K(i, H(D).profileId)), G(e, t);
		};
		q(vt, (e) => {
			H(D) && e(yt);
		});
		var bt = B(vt, 2), xt = B(L(bt), 2), St = L(xt), Ct = z(St, !0);
		Xa(B(St), {
			get value() {
				return t.item.id;
			},
			label: "context ID"
		}), N(xt), N(bt);
		var wt = B(bt, 2), Tt = (e) => {
			var n = Uf(), r = B(L(n), 2), i = L(r), a = z(i, !0);
			Xa(B(i, 2), {
				get value() {
					return t.item.sourceRecordId;
				},
				label: "source record ID"
			}), N(r), N(n), V(() => K(a, t.item.sourceRecordId)), G(e, n);
		};
		q(wt, (e) => {
			t.item.sourceRecordId && e(Tt);
		});
		var Et = B(wt, 2), Dt = (e) => {
			var n = Wf(), r = B(L(n), 2), i = L(r), a = z(i, !0);
			Xa(B(i, 2), {
				get value() {
					return t.item.sourceToolCallId;
				},
				label: "source tool-call ID"
			}), N(r), N(n), V(() => K(a, t.item.sourceToolCallId)), G(e, n);
		};
		q(Et, (e) => {
			t.item.sourceToolCallId && e(Dt);
		}), N(_t);
		var Ot = B(_t, 2), kt = (e) => {
			var n = Gf(), r = B(R(n), 2);
			J(r, 21, () => Object.entries(t.item.metadata), ei, (e, t) => {
				var n = /* @__PURE__ */ P(() => m(H(t), 2));
				let r = () => H(n)[0], i = () => H(n)[1];
				var a = If(), o = L(a), s = z(o, !0), c = B(o);
				N(a), V(() => {
					K(s, r()), K(c, `: ${i() ?? ""}`);
				}), G(e, a);
			}), N(r), G(e, n);
		}, At = /* @__PURE__ */ P(() => Object.keys(t.item.metadata).length > 0);
		q(Ot, (e) => {
			H(At) && e(kt);
		});
		var jt = B(Ot, 2), Mt = (e) => {
			var t = qf(), n = B(R(t), 2);
			J(n, 20, () => H(A), (e) => e, (e, t) => {
				var n = Kf(), r = z(L(n), !0);
				N(n), V(() => K(r, t)), G(e, n);
			}), N(n), G(e, t);
		};
		q(jt, (e) => {
			H(A).length > 0 && e(Mt);
		}), N(gt), di(gt, (e, t) => Wi?.(e, t), () => ({
			state: n(),
			key: "identifiers"
		})), V((e, n, r, i, a, o) => {
			K(re, `${e ?? ""}${H(v) ? ` · version ${H(v).number} of ${H(v).count}` : ""}`), K(ae, n), K(ke, `${r ?? ""} `), K(Ie, `${i ?? ""} `), K(it, ` · ${H(D)?.coverage ?? "unavailable" ?? ""}`), K(ot, `${a ?? ""}
            calls covered`), K(ct, o), K(Ct, t.item.id);
		}, [
			() => Mo(t.item.kind),
			() => Fo(t.item),
			() => H(D) ? `${Z(H(D).tokens)} · call ${H(T)?.index}` : "Unavailable",
			() => Ka(t.item.tokenTurns, "calculatedTokens"),
			() => qa(t.item.tokenTurnsCoverage.coveredCalls, t.item.tokenTurnsCoverage.totalCalls),
			() => Wa(t.item.displayWeight, "serializedBytes")
		]), G(e, i);
	}, ue = (e) => {
		G(e, Yf());
	};
	q(ce, (e) => {
		t.item ? e(le) : e(ue, -1);
	}), N(se), G(e, se), Ve();
}
kr(["click"]);
//#endregion
//#region src/lib/components/Inspector.svelte
var $f = /* @__PURE__ */ W("<section class=\"panel inspector-empty-prompt svelte-gu3dqx\"><div class=\"panel-head svelte-gu3dqx\"><div class=\"svelte-gu3dqx\"><h2 class=\"svelte-gu3dqx\">Inspect workspace details</h2></div></div> <p class=\"muted svelte-gu3dqx\">Select a call to inspect usage.</p> <p class=\"muted svelte-gu3dqx\">Select an item to inspect its context.</p></section>"), ep = /* @__PURE__ */ W("<section class=\"panel svelte-gu3dqx\"><div class=\"panel-head svelte-gu3dqx\"><div class=\"svelte-gu3dqx\"><h2 class=\"svelte-gu3dqx\">Model call</h2></div> <button type=\"button\" class=\"panel-close svelte-gu3dqx\" aria-label=\"Close pinned call\">×</button></div> <!></section>"), tp = /* @__PURE__ */ W("<section class=\"panel svelte-gu3dqx\"><div class=\"panel-head svelte-gu3dqx\"><div class=\"svelte-gu3dqx\"><h2 class=\"svelte-gu3dqx\">Context item</h2> <p class=\"svelte-gu3dqx\">Selected item</p></div> <button type=\"button\" class=\"panel-close svelte-gu3dqx\" aria-label=\"Close context item\">×</button></div> <!></section>"), np = /* @__PURE__ */ W("<p class=\"inspector-secondary-prompt muted svelte-gu3dqx\"> </p>"), rp = /* @__PURE__ */ W("<p class=\"inspector-secondary-prompt muted svelte-gu3dqx\">Select an item to inspect its context.</p>"), ip = /* @__PURE__ */ W("<!> <!> <!> <!>", 1), ap = {
	hash: "svelte-gu3dqx",
	code: ".panel.svelte-gu3dqx {background:var(--surface);border:0;border-radius:var(--radius);padding:var(--panel-padding);margin-top:0;min-width:0;}.panel-head.svelte-gu3dqx {display:flex;justify-content:space-between;gap:16px;align-items:start;margin-bottom:10px;min-width:0;}.panel-head.svelte-gu3dqx > :where(.svelte-gu3dqx) {min-width:0;}.panel-head.svelte-gu3dqx p:where(.svelte-gu3dqx) {color:var(--secondary);margin:4px 0 0;font-size:var(--text-sm);}h2.svelte-gu3dqx {font-size:var(--text-lg);margin:0;}.inspector-empty-prompt.svelte-gu3dqx {display:flex;flex-wrap:wrap;gap:4px 0;padding:0;background:transparent;}.inspector-empty-prompt.svelte-gu3dqx .panel-head:where(.svelte-gu3dqx) {display:none;}.inspector-empty-prompt.svelte-gu3dqx p:where(.svelte-gu3dqx) {margin:0;color:var(--secondary);font-size:var(--text-sm);}.inspector-empty-prompt.svelte-gu3dqx p:where(.svelte-gu3dqx) + p:where(.svelte-gu3dqx)::before {content:'·';margin:0 10px;}.panel-close.svelte-gu3dqx {flex-shrink:0;align-self:flex-start;font-size:18px;padding:1px 7px;}.inspector-secondary-prompt.svelte-gu3dqx {margin:0;padding:9px 11px;border:1px solid var(--separator);border-radius:var(--radius);background:var(--plot);font-size:var(--text-sm);}.muted.svelte-gu3dqx {color:var(--secondary);}"
};
function op(e, t) {
	ui(e, ap);
	let n = X(t, "sessions", 19, () => []);
	var r = Br(), i = R(r), a = (e) => {
		G(e, $f());
	}, o = (e) => {
		var r = ip(), i = R(r), a = (e) => {
			var n = ep(), r = L(n), i = B(L(r), 2);
			N(r), Hd(B(r, 2), {
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
			}), N(n), U("click", i, function(...e) {
				t.onClosePinnedCall?.apply(this, e);
			}), G(e, n);
		};
		q(i, (e) => {
			t.pinnedCall && e(a);
		});
		var o = B(i, 2), s = (e) => {
			var r = tp(), i = L(r), a = B(L(i), 2);
			N(i);
			var o = B(i, 2);
			{
				let e = /* @__PURE__ */ P(() => t.pinnedCallIndex ?? t.hoveredCallIndex);
				Qf(o, {
					get item() {
						return t.selectedItem;
					},
					get sessionId() {
						return t.sessionId;
					},
					get loadItemContent() {
						return t.loadItemContent;
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
			N(r), U("click", a, function(...e) {
				t.onCloseItem?.apply(this, e);
			}), G(e, r);
		};
		q(o, (e) => {
			t.selectedItem && e(s);
		});
		var c = B(o, 2), l = (e) => {
			var n = np(), r = z(n, !0);
			V(() => K(r, t.hasCalls ? "Select a call to inspect usage." : "No call usage is available in this session.")), G(e, n);
		};
		q(c, (e) => {
			t.pinnedCall || e(l);
		});
		var u = B(c, 2), d = (e) => {
			G(e, rp());
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
var sp = /* @__PURE__ */ W("<p class=\"content-preview svelte-c2davt\"> </p>"), cp = /* @__PURE__ */ W("<p class=\"preview-note svelte-c2davt\">Preview truncated</p>"), lp = /* @__PURE__ */ W("<p class=\"lineage svelte-c2davt\"> </p>"), up = /* @__PURE__ */ W("<section class=\"item-hover-card svelte-c2davt\"><header class=\"svelte-c2davt\"><span class=\"svelte-c2davt\"> </span><strong class=\"svelte-c2davt\"> </strong></header> <!> <!> <dl class=\"svelte-c2davt\"><div class=\"svelte-c2davt\"><dt class=\"svelte-c2davt\">Present</dt> <dd class=\"svelte-c2davt\"> </dd></div> <div class=\"svelte-c2davt\"><dt class=\"svelte-c2davt\">Lifetime</dt> <dd class=\"svelte-c2davt\"> </dd></div> <div class=\"svelte-c2davt\"><dt class=\"svelte-c2davt\">Serialized size</dt> <dd class=\"svelte-c2davt\"> </dd></div> <div class=\"svelte-c2davt\"><dt class=\"svelte-c2davt\">Calculated token-turns</dt> <dd class=\"svelte-c2davt\"> </dd></div> <div class=\"svelte-c2davt\"><dt class=\"svelte-c2davt\">Token coverage</dt> <dd class=\"svelte-c2davt\"> </dd></div></dl> <!></section>"), dp = {
	hash: "svelte-c2davt",
	code: ".item-hover-card.svelte-c2davt {min-width:300px;max-width:360px;padding:10px;color:var(--text);background:var(--surface);border:1px solid var(--control-border);border-radius:var(--radius);box-shadow:0 10px 30px var(--shadow);}header.svelte-c2davt {display:flex;flex-direction:column;gap:4px;margin-bottom:10px;}header.svelte-c2davt span:where(.svelte-c2davt) {width:fit-content;color:var(--text);border:1px solid var(--separator);border-radius:999px;padding:2px 7px;font-size:var(--text-sm);}header.svelte-c2davt strong:where(.svelte-c2davt) {color:var(--text-strong);overflow-wrap:anywhere;}dl.svelte-c2davt {display:grid;grid-template-columns:repeat(2, minmax(120px, 1fr));gap:7px;margin:0;}dl.svelte-c2davt div:where(.svelte-c2davt) {background:var(--plot);border-radius:var(--control-radius);padding:6px 8px;}dt.svelte-c2davt {color:var(--secondary);font-size:var(--text-sm);}dd.svelte-c2davt {margin:1px 0 0;color:var(--text-strong);}p.svelte-c2davt {margin:9px 0 0;}.content-preview.svelte-c2davt {margin:0 0 9px;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--text);}.preview-note.svelte-c2davt {color:var(--secondary);font-size:var(--text-sm);}.lineage.svelte-c2davt {border-left:3px dashed var(--compaction);padding-left:8px;color:var(--compaction-text);}"
};
function fp(e, t) {
	Be(t, !0), ui(e, dp);
	let n = /* @__PURE__ */ P(() => t.item ? t.indexed.compactionBySourceId.get(t.item.id) ?? [] : []), r = /* @__PURE__ */ P(() => t.item ? t.indexed.compactionBySummaryId.get(t.item.id) ?? null : null), i = /* @__PURE__ */ P(() => H(n).length > 0 ? `Removed at the compaction before call ${H(n).map((e) => e.beforeModelCall).join(", ")}` : H(r) ? `Replaces ${Q(H(r).sourceItemIds.length)} items removed at the compaction before call ${H(r).beforeModelCall}` : null);
	var a = Br(), o = R(a), s = (e) => {
		var n = up(), r = L(n), a = L(r), o = z(a, !0), s = z(B(a), !0);
		N(r);
		var c = B(r, 2), l = (e) => {
			var n = sp(), r = z(n, !0);
			V(() => K(r, t.item.preview.text)), G(e, n);
		};
		q(c, (e) => {
			t.item.preview?.text && e(l);
		});
		var u = B(c, 2), d = (e) => {
			G(e, cp());
		};
		q(u, (e) => {
			t.item.preview?.truncated && e(d);
		});
		var f = B(u, 2), p = L(f), m = z(B(L(p), 2));
		N(p);
		var h = B(p, 2), g = z(B(L(h), 2));
		N(h);
		var _ = B(h, 2), v = z(B(L(_), 2), !0);
		N(_);
		var y = B(_, 2), b = z(B(L(y), 2), !0);
		N(y);
		var x = B(y, 2), S = z(B(L(x), 2), !0);
		N(x), N(f);
		var ee = B(f, 2), C = (e) => {
			var t = lp(), n = z(t, !0);
			V(() => K(n, H(i))), G(e, t);
		};
		q(ee, (e) => {
			H(i) && e(C);
		}), N(n), V((e, r, i, a, c, l, u) => {
			Y(n, "aria-label", e), K(o, r), K(s, i), K(m, `Calls ${t.item.firstModelCall ?? ""}–${t.item.lastModelCall ?? ""}`), K(g, `${a ?? ""} calls · ${t.item.presence.length ?? ""} range${t.item.presence.length === 1 ? "" : "s"}`), K(v, c), K(b, l), K(S, u);
		}, [
			() => `Context item ${Fo(t.item)}`,
			() => Mo(t.item.kind),
			() => Fo(t.item),
			() => nc(t.item),
			() => Wa(t.item.displayWeight, "serializedBytes"),
			() => Ka(rc(t.item), "calculatedTokens"),
			() => qa(t.item.tokenTurnsCoverage.coveredCalls, t.item.tokenTurnsCoverage.totalCalls)
		]), G(e, n);
	};
	q(o, (e) => {
		t.item && e(s);
	}), G(e, a), Ve();
}
//#endregion
//#region src/lib/components/SessionSummary.svelte
var pp = /* @__PURE__ */ W("<p class=\"compact-metrics svelte-m8zdew\"><span class=\"svelte-m8zdew\"> </span> <span class=\"svelte-m8zdew\"> </span> <span class=\"svelte-m8zdew\"> </span> <span class=\"svelte-m8zdew\"> </span></p>"), mp = /* @__PURE__ */ W(" <span class=\"price-source svelte-m8zdew\"> <!>.</span>", 1), hp = /* @__PURE__ */ W("<small class=\"metric-note svelte-m8zdew\"> </small>"), gp = /* @__PURE__ */ W("<span class=\"svelte-m8zdew\"> <!></span> <b class=\"svelte-m8zdew\"> </b> <small class=\"metric-note svelte-m8zdew\"> </small> <!>", 1), _p = /* @__PURE__ */ W("<span class=\"svelte-m8zdew\">Cost</span> <b title=\"No call in this session has a known or estimated cost.\" class=\"svelte-m8zdew\">Unknown</b> <!>", 1), vp = /* @__PURE__ */ W("<div class=\"primary-metrics svelte-m8zdew\"><div class=\"svelte-m8zdew\"><span class=\"svelte-m8zdew\">Model calls</span><b class=\"svelte-m8zdew\"> </b></div> <div class=\"svelte-m8zdew\"><span class=\"svelte-m8zdew\">Context items</span><b class=\"svelte-m8zdew\"> </b></div> <div class=\"svelte-m8zdew\"><span class=\"svelte-m8zdew\">Peak calculated context</span> <b class=\"svelte-m8zdew\"> </b></div> <div class=\"cost-metric svelte-m8zdew\"><!></div></div>"), yp = /* @__PURE__ */ W("<p><strong> </strong> <span class=\"svelte-m8zdew\"> </span></p>"), bp = /* @__PURE__ */ W("<li class=\"svelte-m8zdew\"> </li>"), xp = /* @__PURE__ */ W("<ul class=\"estimate-reasons svelte-m8zdew\"></ul>"), Sp = /* @__PURE__ */ W("<p class=\"estimate-lead svelte-m8zdew\"> </p> <!>", 1), Cp = /* @__PURE__ */ W("Not recorded<!>", 1), wp = /* @__PURE__ */ W("<div><dt class=\"svelte-m8zdew\">Billed cost (USD)</dt> <dd class=\"svelte-m8zdew\"> </dd></div>"), Tp = /* @__PURE__ */ W("<div><dt class=\"svelte-m8zdew\"> </dt> <dd class=\"svelte-m8zdew\"> <small class=\"metric-note svelte-m8zdew\"> </small></dd></div>"), Ep = /* @__PURE__ */ W("<div><dt class=\"svelte-m8zdew\">Title</dt> <dd class=\"svelte-m8zdew\"> </dd></div>"), Dp = /* @__PURE__ */ W("<div><dt class=\"svelte-m8zdew\"> </dt> <dd class=\"svelte-m8zdew\"> </dd></div>"), Op = /* @__PURE__ */ W("<div><dt class=\"svelte-m8zdew\">Cache-write limits</dt> <dd class=\"svelte-m8zdew\">Anthropic writes are aggregated across TTLs. Copilot Responses uses separately\n                recorded writes; older direct OpenAI adapter zeros do not establish measured zero\n                writes. See each call's audited policy.</dd></div>"), kp = /* @__PURE__ */ W("<div><dt class=\"svelte-m8zdew\">Fallback code</dt> <dd class=\"svelte-m8zdew\"><code class=\"svelte-m8zdew\"> </code></dd></div>"), Ap = /* @__PURE__ */ W("<div><dt class=\"svelte-m8zdew\">Reconciliation (complete / comparable calls)</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <div><dt class=\"svelte-m8zdew\">Residual median / maximum</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <div><dt class=\"svelte-m8zdew\">Negative residual calls</dt> <dd class=\"svelte-m8zdew\"> </dd></div>", 1), jp = /* @__PURE__ */ W("<div><dt class=\"svelte-m8zdew\">Calls where the estimate exceeds reported input</dt> <dd class=\"svelte-m8zdew\"> </dd></div>"), Mp = /* @__PURE__ */ W("<li> <!></li>"), Np = /* @__PURE__ */ W("<h4 class=\"svelte-m8zdew\">Tokenization profiles</h4> <ul class=\"profiles svelte-m8zdew\"></ul>", 1), Pp = /* @__PURE__ */ W("<p class=\"svelte-m8zdew\">Child session of <a class=\"svelte-m8zdew\"> </a></p>"), Fp = /* @__PURE__ */ W("<p class=\"svelte-m8zdew\">Forked from <a class=\"svelte-m8zdew\"> </a></p>"), Ip = /* @__PURE__ */ W("<li><a class=\"svelte-m8zdew\"> </a></li>"), Lp = /* @__PURE__ */ W("<details><summary class=\"disclosure svelte-m8zdew\"> </summary> <ul class=\"svelte-m8zdew\"></ul></details>"), Rp = /* @__PURE__ */ W("<div class=\"session-relations svelte-m8zdew\"><!> <!> <!></div>"), zp = /* @__PURE__ */ W("<section class=\"summary svelte-m8zdew\" aria-label=\"Session summary\"><!> <!> <div class=\"session-status svelte-m8zdew\"><div> <!></div> <details class=\"session-details svelte-m8zdew\" id=\"session-details\"><summary class=\"disclosure svelte-m8zdew\" id=\"session-details-summary\">Session details</summary> <div class=\"detail-columns svelte-m8zdew\"><section><h3 class=\"svelte-m8zdew\">Usage breakdown</h3> <dl class=\"svelte-m8zdew\"><div><dt class=\"svelte-m8zdew\">Input tokens, all calls<!></dt> <dd class=\"svelte-m8zdew\"> <!></dd></div> <div><dt class=\"svelte-m8zdew\">Output tokens, all calls</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <div><dt class=\"svelte-m8zdew\">Reasoning tokens, all calls</dt> <dd class=\"svelte-m8zdew\"><!></dd></div> <div><dt class=\"svelte-m8zdew\">Cache-read share<!></dt> <dd class=\"svelte-m8zdew\"> </dd></div> <div><dt class=\"svelte-m8zdew\">Compactions</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <!> <div><dt class=\"svelte-m8zdew\"> <!></dt> <dd class=\"svelte-m8zdew\"><!> <!></dd></div> <!></dl></section> <section><h3 class=\"svelte-m8zdew\">Session metadata</h3> <dl class=\"svelte-m8zdew\"><div><dt class=\"svelte-m8zdew\">Provider</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <div><dt class=\"svelte-m8zdew\">Model</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <!> <div><dt class=\"svelte-m8zdew\">Working directory</dt> <dd class=\"svelte-m8zdew\"> </dd></div></dl></section></div> <details class=\"diagnostics svelte-m8zdew\"><summary class=\"disclosure svelte-m8zdew\">Diagnostics</summary> <dl class=\"svelte-m8zdew\"><div><dt class=\"svelte-m8zdew\">Reported usage completeness</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <div><dt class=\"svelte-m8zdew\">Usage policy coverage (complete / partial / missing / unsupported)</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <!> <!> <!> <div><dt class=\"svelte-m8zdew\">Estimate coverage (complete / partial / unavailable)</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <div><dt class=\"svelte-m8zdew\">Calculated token-turns</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <div><dt class=\"svelte-m8zdew\">Token-turn exposure coverage</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <!> <div><dt class=\"svelte-m8zdew\">Tokenizer methods</dt> <dd class=\"svelte-m8zdew\"> </dd></div></dl> <!></details></details></div> <!></section>"), Bp = {
	hash: "svelte-m8zdew",
	code: ".trace-notice.svelte-m8zdew {border-inline-start:2px solid var(--border);margin:0;padding:0.35rem 0.65rem;font-size:0.82rem;}.trace-notice.unreadable.svelte-m8zdew {border-inline-start-color:var(--warning);}.trace-notice.svelte-m8zdew span:where(.svelte-m8zdew) {display:block;}.session-relations.svelte-m8zdew {margin-top:8px;color:var(--secondary);font-size:13px;}.session-relations.svelte-m8zdew p:where(.svelte-m8zdew) {margin:0 0 4px;}.session-relations.svelte-m8zdew ul:where(.svelte-m8zdew) {margin:6px 0 0;padding-left:20px;}.session-relations.svelte-m8zdew a:where(.svelte-m8zdew) {color:var(--accent);}.summary.svelte-m8zdew {margin-top:16px;min-width:0;}.compact-metrics.svelte-m8zdew {display:flex;flex-wrap:wrap;gap:2px 0;margin:0 0 4px;color:var(--text-strong);font-weight:600;font-variant-numeric:tabular-nums;}.compact-metrics.svelte-m8zdew span:where(.svelte-m8zdew):not(:last-child)::after {content:'·';margin:0 6px;color:var(--secondary);font-weight:400;}.primary-metrics.svelte-m8zdew {display:grid;grid-template-columns:repeat(4, minmax(0, 1fr));gap:9px;}.primary-metrics.svelte-m8zdew > div:where(.svelte-m8zdew) {min-width:0;padding:8px 12px 8px 0;}.primary-metrics.svelte-m8zdew span:where(.svelte-m8zdew) {display:block;color:var(--secondary);font-size:var(--text-sm);}.primary-metrics.svelte-m8zdew b:where(.svelte-m8zdew) {display:block;color:var(--text-strong);margin-top:2px;overflow-wrap:anywhere;font-variant-numeric:tabular-nums;}.metric-note.svelte-m8zdew {display:block;color:var(--secondary);font-size:var(--text-sm);font-weight:normal;}\n  /* Keep status and trigger inline; the full-width body clears both in either state. */.session-status.svelte-m8zdew {margin-top:8px;}.session-status.svelte-m8zdew::after {content:'';display:block;clear:both;}.estimate-level.svelte-m8zdew {float:left;display:inline-flex;align-items:center;margin:0 16px 0 0;color:var(--secondary);font-size:var(--text-md);}.estimate-level.good.svelte-m8zdew {color:var(--accent);}.estimate-level.partial.svelte-m8zdew {color:var(--warning);}.estimate-level.rough.svelte-m8zdew {color:var(--error);}.price-source.svelte-m8zdew {display:block;margin-top:6px;color:var(--secondary);}.estimate-lead.svelte-m8zdew {margin:0;}.estimate-reasons.svelte-m8zdew {margin:8px 0 0;padding-left:18px;}.estimate-reasons.svelte-m8zdew li:where(.svelte-m8zdew) + li:where(.svelte-m8zdew) {margin-top:4px;}.session-details.svelte-m8zdew {max-width:100%;color:var(--text);}.session-details.svelte-m8zdew > summary:where(.svelte-m8zdew) {float:left;}.profiles.svelte-m8zdew {color:var(--secondary);}summary.svelte-m8zdew {cursor:pointer;width:fit-content;}.detail-columns.svelte-m8zdew {clear:both;display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));align-items:start;gap:14px 24px;margin-top:10px;padding:12px;background:var(--surface);border:1px solid var(--separator);border-radius:var(--radius);}h3.svelte-m8zdew {margin:0 0 7px;color:var(--text);font-size:var(--text-md);}h4.svelte-m8zdew {margin:10px 0 4px;font-size:var(--text-sm);}dl.svelte-m8zdew {display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:6px 14px;margin:0;}dt.svelte-m8zdew {color:var(--secondary);font-size:var(--text-sm);}dd.svelte-m8zdew {margin:1px 0 0;overflow-wrap:anywhere;color:var(--text);}.diagnostics.svelte-m8zdew {margin-top:10px;padding:0 12px;}.diagnostics.svelte-m8zdew > dl:where(.svelte-m8zdew) {margin-top:8px;}.profiles.svelte-m8zdew {margin:0;padding-left:18px;font-size:var(--text-sm);overflow-wrap:anywhere;}code.svelte-m8zdew {overflow-wrap:anywhere;color:var(--secondary);}\n  /* Narrower views show the figures on one line instead (see SessionView), so the four\n     figures stay in one row whenever they are shown separately. */\n  @container highwater (max-width: 800px) {.detail-columns.svelte-m8zdew {grid-template-columns:1fr;}\n  }"
};
function Vp(e, t) {
	Be(t, !0), ui(e, Bp);
	let n = X(t, "sessionId", 3, null), r = X(t, "sessions", 19, () => []), i = X(t, "compact", 3, !1), a = /* @__PURE__ */ P(() => r().find((e) => e.id === n())), o = /* @__PURE__ */ P(() => H(a)?.parentReference ? r().find((e) => e.id === H(a).parentReference) : void 0), s = /* @__PURE__ */ P(() => n() ? rf(r(), n()) : []), c = /* @__PURE__ */ P(() => H(a)?.forkedFromReference ? r().find((e) => e.id === H(a)?.forkedFromReference) : void 0), l = (e) => [
		e.displayName,
		e.subagentType,
		Xl(e.startedAt)
	].filter(Boolean).join(" · "), u = /* @__PURE__ */ P(() => t.indexed.analysis), d = /* @__PURE__ */ P(() => H(u).session), f = /* @__PURE__ */ P(() => H(u).tokenAnalysis), p = /* @__PURE__ */ P(() => H(u).economics), m = /* @__PURE__ */ P(() => [...new Set(H(u).modelCalls.map((e) => e.provider).filter(Boolean))].join(", ") || "Unknown"), h = /* @__PURE__ */ P(() => [...new Set(H(u).modelCalls.filter((e) => !e.usage.placeholder).map((e) => e.model).filter(Boolean))].join(", ") || "Unknown"), g = /* @__PURE__ */ P(() => H(f).itemEstimateCoverage), _ = /* @__PURE__ */ P(() => Ll(t.indexed)), v = /* @__PURE__ */ P(() => El(H(u))), y = /* @__PURE__ */ P(() => Ul(H(p).costBasis, H(d).source)), b = /* @__PURE__ */ P(() => H(d).reconciliationComparableCalls > 0), x = /* @__PURE__ */ P(() => H(b) ? null : yl(t.indexed)), S = /* @__PURE__ */ P(() => H(d).costSummary), ee = /* @__PURE__ */ P(() => lu(H(S))), C = /* @__PURE__ */ P(() => uu(H(S))), w = /* @__PURE__ */ P(() => H(S).priceData), T = /* @__PURE__ */ P(() => H(d).reportedCostTotal === null ? null : hu(H(d).reportedCostCoverage)), E = /* @__PURE__ */ P(() => H(d).reportedPromptTokens === null ? null : hu(H(d).reportedUsageCoverage)), D = /* @__PURE__ */ P(() => H(d).harnessSessionCost !== null && !(H(d).source === "vscode-copilot" && H(d).reportedCostTotal !== null && Math.abs(H(d).reportedCostTotal - H(d).harnessSessionCost.totalUsd) < 1e-9));
	var O = zp(), k = L(O), te = (e) => {
		var t = pp(), n = L(t), r = z(n), i = B(n, 2), a = z(i), o = B(i, 2), s = z(o, !0), c = z(B(o, 2), !0);
		N(t), V((e, n, i) => {
			Y(t, "title", H(ee) ? `${H(ee).label}: ${H(ee).note}` : void 0), K(r, `${e ?? ""} calls`), K(a, `${n ?? ""} items`), K(s, i), K(c, H(ee) ? H(ee).value : "Cost unknown");
		}, [
			() => Q(H(u).modelCalls.length),
			() => Q(H(u).contextItems.length),
			() => H(d).peakCalculatedVisibleTokens === null ? "Peak unknown" : `${Z(H(d).peakCalculatedVisibleTokens)} peak`
		]), G(e, t);
	}, A = (e) => {
		var t = vp(), n = L(t), r = z(B(L(n)), !0);
		N(n);
		var i = B(n, 2), a = z(B(L(i)), !0);
		N(i);
		var o = B(i, 2), s = z(B(L(o), 2), !0);
		N(o);
		var c = B(o, 2), l = L(c), f = (e) => {
			var t = gp(), n = R(t), r = L(n, !0);
			va(B(r), {
				id: "session-cost-note",
				label: "How the cost is worked out",
				children: (e, t) => {
					be();
					var n = mp(), r = R(n), i = B(r), a = L(i), o = B(a), s = (e) => {
						var t = zr();
						V((e) => K(t, `, with corrections from model-prices ${e ?? ""}`), [() => H(w).amendmentsImportedFrom.slice(0, 7)]), G(e, t);
					};
					q(o, (e) => {
						H(w).amendmentsImportedFrom && e(s);
					}), be(), N(i), V((e, t) => {
						K(r, `${H(ee).title ?? ""} `), K(a, `Prices from models.dev ${e ?? ""} (${t ?? ""})`);
					}, [() => H(w).modelsDevCommit.slice(0, 7), () => H(w).modelsDevCommittedAt.slice(0, 10)]), G(e, n);
				},
				$$slots: { default: !0 }
			}), N(n);
			var i = B(n, 2), a = z(i, !0), o = B(i, 2), s = z(o), c = B(o, 2), l = (e) => {
				var t = hp(), n = z(t, !0);
				V(() => K(n, H(ee).split)), G(e, t);
			};
			q(c, (e) => {
				H(ee).split && e(l);
			}), V(() => {
				K(r, H(ee).label), K(a, H(ee).value), K(s, `${H(ee).note ?? ""}${H(C) ? ` · ${H(C)}` : ""}`);
			}), G(e, t);
		}, p = (e) => {
			var t = _p(), n = B(R(t), 4), r = (e) => {
				var t = hp(), n = z(t, !0);
				V(() => K(n, H(C))), G(e, t);
			};
			q(n, (e) => {
				H(C) && e(r);
			}), G(e, t);
		};
		q(l, (e) => {
			H(ee) ? e(f) : e(p, -1);
		}), N(c), N(t), V((e, t, n) => {
			K(r, e), K(a, t), K(s, n);
		}, [
			() => Q(H(u).modelCalls.length),
			() => Q(H(u).contextItems.length),
			() => H(d).peakCalculatedVisibleTokens === null ? "Unknown" : Wa(H(d).peakCalculatedVisibleTokens, "calculatedTokens")
		]), G(e, t);
	};
	q(k, (e) => {
		i() ? e(te) : e(A, -1);
	});
	var ne = B(k, 2), re = (e) => {
		var t = yp();
		let n;
		var r = L(t), i = z(r, !0), a = z(B(r, 2), !0);
		N(t), V(() => {
			n = _i(t, 1, "trace-notice svelte-m8zdew", null, n, { unreadable: H(v).unreadable }), K(i, H(v).title), K(a, H(v).detail);
		}), G(e, t);
	};
	q(ne, (e) => {
		H(v) && e(re);
	});
	var ie = B(ne, 2), ae = L(ie), oe = L(ae, !0), se = B(oe);
	{
		let e = /* @__PURE__ */ P(() => `Why are estimates ${H(_).level}?`);
		va(se, {
			id: "estimate-quality-note",
			get label() {
				return H(e);
			},
			children: (e, t) => {
				var n = Sp(), r = R(n), i = z(r, !0), a = B(r, 2), o = (e) => {
					var t = xp();
					J(t, 20, () => H(_).reasons, (e) => e, (e, t) => {
						var n = bp(), r = z(n, !0);
						V(() => K(r, t)), G(e, n);
					}), N(t), G(e, t);
				};
				q(a, (e) => {
					H(_).reasons.length > 0 && e(o);
				}), V(() => K(i, H(_).lead)), G(e, n);
			},
			$$slots: { default: !0 }
		});
	}
	N(ae);
	var ce = B(ae, 2), le = B(L(ce), 2), ue = L(le), de = B(L(ue), 2), fe = L(de), pe = L(fe);
	va(B(L(pe)), {
		id: "input-tokens-note",
		label: "About input tokens",
		children: (e, t) => {
			be(), G(e, zr("Input tokens summed over every call. Each call sends the whole context again, so\n                  most of these are cache reads."));
		},
		$$slots: { default: !0 }
	}), N(pe);
	var me = B(pe, 2), he = L(me), ge = B(he), j = (e) => {
		var t = hp(), n = z(t, !0);
		V(() => K(n, H(E))), G(e, t);
	};
	q(ge, (e) => {
		H(E) && e(j);
	}), N(me), N(fe);
	var _e = B(fe, 2), M = z(B(L(_e), 2), !0);
	N(_e);
	var ve = B(_e, 2), ye = B(L(ve), 2), xe = L(ye), Se = (e) => {
		var t = Cp();
		va(B(R(t)), {
			id: "reasoning-tokens-note",
			label: "Why reasoning tokens are not recorded",
			children: (e, t) => {
				be();
				var n = zr();
				V((e) => K(n, `${e ?? ""} does not record reasoning tokens separately for these
                    calls. Any reasoning is included in the output tokens.`), [() => Zl(H(d).source)]), G(e, n);
			},
			$$slots: { default: !0 }
		}), G(e, t);
	}, Ce = (e) => {
		var t = zr();
		V((e) => K(t, e), [() => Z(H(d).reportedReasoningTokens)]), G(e, t);
	};
	q(xe, (e) => {
		H(d).reportedReasoningTokens === null ? e(Se) : e(Ce, -1);
	}), N(ye), N(ve);
	var we = B(ve, 2), Te = L(we);
	va(B(L(Te)), {
		id: "cache-read-share-note",
		label: "About cache-read share",
		children: (e, t) => {
			be();
			var n = zr();
			V((e) => K(n, `The share of input tokens read from the provider's cache, over the ${e ?? ""} calls with complete usage.`), [() => qa(H(p).cacheReadEligibleCalls, H(u).modelCalls.length)]), G(e, n);
		},
		$$slots: { default: !0 }
	}), N(Te);
	var Ee = z(B(Te, 2), !0);
	N(we);
	var De = B(we, 2), Oe = z(B(L(De), 2), !0);
	N(De);
	var ke = B(De, 2), Ae = (e) => {
		var t = wp(), n = z(B(L(t), 2), !0);
		N(t), V((e) => K(n, e), [() => H(S).billed.calls > 0 ? nu(H(S).billed, !0) : "None"]), G(e, t);
	}, je = /* @__PURE__ */ P(() => !["claude-code", "codex"].includes(H(d).source));
	q(ke, (e) => {
		H(je) && e(Ae);
	});
	var Me = B(ke, 2), Ne = L(Me), Pe = L(Ne);
	va(B(Pe), {
		id: "recorded-cost-note",
		label: "About the recorded cost",
		children: (e, t) => {
			be();
			var n = zr();
			V(() => K(n, H(y).note)), G(e, n);
		},
		$$slots: { default: !0 }
	}), N(Ne);
	var Fe = B(Ne, 2), Ie = L(Fe), Le = (e) => {
		G(e, zr("Not recorded"));
	}, Re = (e) => {
		var t = zr();
		V((e) => K(t, e), [() => Va(H(d).reportedCostTotal)]), G(e, t);
	};
	q(Ie, (e) => {
		H(d).reportedCostTotal === null ? e(Le) : e(Re, -1);
	});
	var ze = B(Ie, 2), He = (e) => {
		var t = hp(), n = z(t, !0);
		V(() => K(n, H(T))), G(e, t);
	};
	q(ze, (e) => {
		H(T) && e(He);
	}), N(Fe), N(Me);
	var Ue = B(Me, 2), We = (e) => {
		var t = Tp(), n = L(t), r = z(n), i = B(n, 2), a = L(i), o = z(B(a), !0);
		N(i), N(t), V((e, t, n) => {
			K(r, `${e ?? ""}'s own total (USD)`), K(a, `${t ?? ""} `), K(o, n);
		}, [
			() => Zl(H(d).source),
			() => Va(H(d).harnessSessionCost.totalUsd),
			() => du(H(d).harnessSessionCost, H(d).source)
		]), G(e, t);
	};
	q(Ue, (e) => {
		H(D) && H(d).harnessSessionCost && e(We);
	}), N(de), N(ue);
	var Ge = B(ue, 2), Ke = B(L(Ge), 2), qe = L(Ke), Je = z(B(L(qe), 2));
	N(qe);
	var Ye = B(qe, 2), Xe = z(B(L(Ye), 2), !0);
	N(Ye);
	var Ze = B(Ye, 2), Qe = (e) => {
		var t = Ep(), n = z(B(L(t), 2), !0);
		N(t), V(() => K(n, H(d).title)), G(e, t);
	};
	q(Ze, (e) => {
		H(d).title && e(Qe);
	});
	var $e = B(Ze, 2), et = z(B(L($e), 2), !0);
	N($e), N(Ke), N(Ge), N(le);
	var tt = B(le, 2), nt = B(L(tt), 2), rt = L(nt), it = z(B(L(rt), 2), !0);
	N(rt);
	var at = B(rt, 2), ot = z(B(L(at), 2));
	N(at);
	var st = B(at, 2), ct = (e) => {
		var t = Dp(), n = L(t), r = z(n), i = z(B(n, 2));
		N(t), V((e, t, n, a) => {
			K(r, `${H(y).label ?? ""} component coverage (complete / partial / missing / unsupported)`), K(i, `${e ?? ""} complete ·
                ${t ?? ""} partial ·
                ${n ?? ""} missing ·
                ${a ?? ""} unsupported`);
		}, [
			() => Q(H(p).costCompleteness.complete),
			() => Q(H(p).costCompleteness.partial),
			() => Q(H(p).costCompleteness.missing),
			() => Q(H(p).costCompleteness.unsupported)
		]), G(e, t);
	}, lt = /* @__PURE__ */ P(() => ![
		"claude-code",
		"codex",
		"copilot",
		"vscode-copilot"
	].includes(H(d).source));
	q(st, (e) => {
		H(lt) && e(ct);
	});
	var ut = B(st, 2), dt = (e) => {
		G(e, Op());
	}, ft = /* @__PURE__ */ P(() => Wl(H(d).source));
	q(ut, (e) => {
		H(ft) && e(dt);
	});
	var pt = B(ut, 2), mt = (e) => {
		var t = kp(), n = B(L(t), 2), r = z(L(n), !0);
		N(n), N(t), V(() => K(r, H(f).fallbackReason)), G(e, t);
	};
	q(pt, (e) => {
		H(f).fallbackReason && e(mt);
	});
	var ht = B(pt, 2), gt = z(B(L(ht), 2));
	N(ht);
	var _t = B(ht, 2), vt = z(B(L(_t), 2), !0);
	N(_t);
	var yt = B(_t, 2), bt = z(B(L(yt), 2), !0);
	N(yt);
	var xt = B(yt, 2), St = (e) => {
		var t = Ap(), n = R(t), r = z(B(L(n), 2));
		N(n);
		var i = B(n, 2), a = z(B(L(i), 2));
		N(i);
		var o = B(i, 2), s = z(B(L(o), 2), !0);
		N(o), V((e, t, n, i, o) => {
			K(r, `${e ?? ""} /
                ${t ?? ""}`), K(a, `${n ?? ""} /
                ${i ?? ""}`), K(s, o);
		}, [
			() => Q(H(d).reconciliationCompleteCalls),
			() => Q(H(d).reconciliationComparableCalls),
			() => Ha(H(d).medianAbsoluteResidualPercent),
			() => Ha(H(d).maximumAbsoluteResidualPercent),
			() => Q(H(d).negativeResidualCalls)
		]), G(e, t);
	}, Ct = (e) => {
		var t = jp(), n = z(B(L(t), 2), !0);
		N(t), V((e) => K(n, e), [() => Q(H(x).estimateAboveReportedCalls)]), G(e, t);
	};
	q(xt, (e) => {
		H(b) ? e(St) : H(x) && e(Ct, 1);
	});
	var wt = B(xt, 2), Tt = z(B(L(wt), 2), !0);
	N(wt), N(nt);
	var Et = B(nt, 2), Dt = (e) => {
		var t = Np(), n = B(R(t), 2);
		J(n, 21, () => H(f).profiles, (e) => e.id, (e, t) => {
			var n = Mp(), r = L(n), i = B(r), a = (e) => {
				var n = zr();
				V(() => K(n, `· ${H(t).api ?? ""}`)), G(e, n);
			};
			q(i, (e) => {
				H(t).api && e(a);
			}), N(n), V(() => K(r, `${H(t).provider ?? ""} / ${H(t).model ?? ""} · ${H(t).method ?? ""} · ${H(t).tokenizerFamily ?? ""}
                (v${H(t).version ?? ""})`)), G(e, n);
		}), N(n), G(e, t);
	};
	q(Et, (e) => {
		H(f).profiles.length > 0 && e(Dt);
	}), N(tt), N(ce), N(ie);
	var Ot = B(ie, 2), kt = (e) => {
		var t = Rp(), r = L(t), i = (e) => {
			var t = Pp(), r = B(L(t)), i = z(r, !0);
			N(t), V((e) => {
				Y(r, "href", e), K(i, H(o).displayName);
			}, [() => nf(H(o).id, n())]), G(e, t);
		};
		q(r, (e) => {
			H(o) && n() && e(i);
		});
		var a = B(r, 2), u = (e) => {
			var t = Fp(), n = B(L(t)), r = z(n, !0);
			N(t), V((e) => {
				Y(n, "href", e), K(r, H(c).displayName);
			}, [() => nf(H(c).id)]), G(e, t);
		};
		q(a, (e) => {
			H(c) && e(u);
		});
		var d = B(a, 2), f = (e) => {
			var t = Lp(), n = L(t), r = z(n), i = B(n, 2);
			J(i, 21, () => H(s), (e) => e.id, (e, t) => {
				var n = Ip(), r = L(n), i = z(r, !0);
				N(n), V((e, t) => {
					Y(r, "href", e), K(i, t);
				}, [() => nf(H(t).id), () => l(H(t))]), G(e, n);
			}), N(i), N(t), V((e) => K(r, `${e ?? ""}
            ${H(s).length === 1 ? "child session" : "child sessions"}`), [() => Q(H(s).length)]), G(e, t);
		};
		q(d, (e) => {
			H(s).length > 0 && e(f);
		}), N(t), G(e, t);
	};
	q(Ot, (e) => {
		(H(o) || H(c) || H(s).length > 0) && e(kt);
	}), N(O), V((e, t, n, r, i, a, o, s, c, l, u, f, p, g, v, y) => {
		_i(ae, 1, `estimate-level ${H(_).level}`, "svelte-m8zdew"), K(oe, H(_).label), K(he, `${e ?? ""} `), K(M, t), K(Ee, n), K(Oe, r), K(Pe, `Recorded by ${i ?? ""} (USD)`), K(Je, `${H(m) ?? ""} · recorded by ${a ?? ""}`), K(Xe, H(h)), K(et, H(d).workingDirectory ?? "Unknown"), K(it, H(d).reportedUsageCompleteness), K(ot, `${o ?? ""} complete ·
              ${s ?? ""} partial ·
              ${c ?? ""} missing ·
              ${l ?? ""} unsupported`), K(gt, `${u ?? ""} complete ·
              ${f ?? ""} partial ·
              ${p ?? ""} unavailable`), K(vt, g), K(bt, v), K(Tt, y);
	}, [
		() => Z(H(d).reportedPromptTokens),
		() => Z(H(d).reportedCompletionTokens),
		() => Ha(H(p).cacheReadRatio),
		() => Q(H(u).compactions.length),
		() => Zl(H(d).source),
		() => Zl(H(d).source),
		() => Q(H(p).usageCompleteness.complete),
		() => Q(H(p).usageCompleteness.partial),
		() => Q(H(p).usageCompleteness.missing),
		() => Q(H(p).usageCompleteness.unsupported),
		() => qa(H(g).completeItems, H(g).totalItems),
		() => Q(H(g).partialItems),
		() => Q(H(g).unavailableItems),
		() => Z(H(d).calculatedTokenTurns),
		() => qa(H(d).calculatedTokenTurnsCoverage.coveredCalls, H(d).calculatedTokenTurnsCoverage.totalCalls),
		() => Object.entries(H(f).tokenizerMethods).map(([e, t]) => `${e}: ${Q(t)}`).join(" · ") || "None"
	]), G(e, O), Ve();
}
//#endregion
//#region src/lib/components/ChartHelp.svelte
var Hp = /* @__PURE__ */ W("<h4 class=\"svelte-1f7lrk7\">System and tools</h4> <p class=\"svelte-1f7lrk7\">Recorded Pi instructions and tool declarations are replayed into per-call revisions. Their\n        token sizes estimate logical context, not exact provider wire framing. Older logs may lack\n        this material; missing does not mean zero. Provider-reported input and cost remain\n        independent totals.</p>", 1), Up = /* @__PURE__ */ W("<div class=\"chart-help svelte-1f7lrk7\"><button type=\"button\" aria-label=\"Chart help\" aria-controls=\"chart-help-popover\" title=\"Chart help\"> </button> <div id=\"chart-help-popover\" class=\"help-popover svelte-1f7lrk7\" role=\"group\" aria-labelledby=\"chart-help-title\"><div class=\"help-heading svelte-1f7lrk7\"><h3 id=\"chart-help-title\" class=\"svelte-1f7lrk7\">Chart help</h3> <button type=\"button\" class=\"help-close svelte-1f7lrk7\" aria-label=\"Close help\" title=\"Close (Esc)\">×</button></div> <h4 class=\"svelte-1f7lrk7\">Navigate the river</h4> <ul class=\"svelte-1f7lrk7\"><li class=\"svelte-1f7lrk7\">Drag across a range to zoom; scroll horizontally or Shift-drag to pan.</li> <li class=\"svelte-1f7lrk7\">Use pinch or modifier-wheel zoom; ordinary page scrolling remains available.</li> <li class=\"svelte-1f7lrk7\">Use Go to call beside the zoom controls to pin a call without changing zoom. Drag an area to\n        zoom to a range.</li> <li class=\"svelte-1f7lrk7\">The lifespan list spans the full session; filter or search it to locate an item.</li> <li class=\"svelte-1f7lrk7\">Use Find in lifespans from Composition to open and focus a selected item's row.</li> <li class=\"svelte-1f7lrk7\">Escape closes this help first, then clears the selected item, the pin, and Fit all.</li></ul> <!> <h4 class=\"svelte-1f7lrk7\">Read the scale</h4> <p class=\"svelte-1f7lrk7\">Session scale keeps ribbon heights comparable across calls. Visible calls mode rescales to\n      visible columns and interpolated viewport edges, so heights can change while panning or\n      zooming. Cached tokens still occupy context capacity.</p></div></div>"), Wp = {
	hash: "svelte-1f7lrk7",
	code: ".chart-help.svelte-1f7lrk7 {display:flex;align-items:center;gap:6px 12px;min-height:var(--toggle-height);color:var(--secondary);font-size:var(--text-sm);}.help-trigger.svelte-1f7lrk7 {cursor:pointer;padding:5px 8px;white-space:nowrap;border:1px solid var(--separator);border-radius:var(--control-radius);color:var(--text);background:var(--surface);font:inherit;}.help-trigger.svelte-1f7lrk7:hover {background:var(--surface-raised);}.help-heading.svelte-1f7lrk7 {display:flex;align-items:center;justify-content:space-between;gap:12px;}.help-heading.svelte-1f7lrk7 h3:where(.svelte-1f7lrk7) {margin:0;}.help-close.svelte-1f7lrk7 {display:inline-flex;align-items:center;justify-content:center;width:var(--control-size);height:var(--control-size);padding:0;font-size:18px;line-height:1;}.help-popover.svelte-1f7lrk7 {position:fixed;z-index:20;left:12px;top:12px;width:min(30rem, calc(100vw - 24px));max-height:min(70vh, calc(100vh - 24px));overflow:auto;overscroll-behavior:contain;padding:14px 16px;border:1px solid var(--control-border);border-radius:var(--radius);background:var(--surface);color:var(--text);box-shadow:0 12px 32px var(--shadow-strong);font-size:var(--text-md);}h3.svelte-1f7lrk7,\n  h4.svelte-1f7lrk7 {margin:0 0 6px;color:var(--text-strong);}h3.svelte-1f7lrk7 {font-size:var(--text-lg);}h4.svelte-1f7lrk7 {margin-top:12px;font-size:var(--text-sm);}p.svelte-1f7lrk7 {margin:5px 0;}ul.svelte-1f7lrk7 {margin:5px 0;padding-left:20px;}li.svelte-1f7lrk7 + li:where(.svelte-1f7lrk7) {margin-top:4px;}"
};
function Gp(e, t) {
	Be(t, !0), ui(e, Wp);
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
	var p = Up();
	Or("resize", rn, u), Or("scroll", rn, u);
	var m = L(p);
	let h;
	var g = z(m, !0);
	Ri(m, (e) => I(a, e), () => H(a));
	var _ = B(m, 2), v = L(_), y = B(L(v), 2);
	Ri(y, (e) => I(s, e), () => H(s)), N(v);
	var b = B(v, 6), x = (e) => {
		var t = Hp();
		be(2), G(e, t);
	};
	q(b, (e) => {
		t.source === "pi" && e(x);
	}), be(4), N(_), Ri(_, (e) => I(o, e), () => H(o)), N(p), Ri(p, (e) => i = e, () => i), V(() => {
		h = _i(m, 1, "help-trigger svelte-1f7lrk7", null, h, { compact: r() }), Y(m, "aria-expanded", H(l)), K(g, r() ? "?" : "Chart help"), Y(_, "aria-hidden", !H(l)), Y(_, "hidden", !H(l)), yi(_, H(c));
	}), U("click", m, f), U("click", y, () => d()), G(e, p), Ve();
}
kr(["click"]);
//#endregion
//#region src/lib/context-river/navigation.ts
function Kp(e, t, n) {
	let r = e.find((e) => e.callIndex === t);
	return r ? {
		callIndex: t,
		sourceRecordId: r.sourceRecordId ?? null,
		offsetFromViewportLeft: n
	} : null;
}
function qp(e, t, n, r) {
	let i = e.findIndex((e) => e.callIndex === t), a = e.findIndex((e) => e.callIndex === n);
	if (i < 0 || a < 0) return null;
	if (i === a) {
		let n = Kp(e, t, r);
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
function Jp(e, t, n) {
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
function Yp(e, t, n) {
	return e === 0 ? t / (Math.min(15, n) - 1) : t / e;
}
function Xp(e, t, n, r, i) {
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
function Zp(e, t) {
	let n = !1, r = Hi(e), i = () => {
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
function Qp(e) {
	return {
		pointerId: e.pointerId,
		pointerType: e.pointerType,
		button: e.button,
		x: e.clientX,
		y: e.clientY,
		shiftKey: e.shiftKey
	};
}
function $p(e, t) {
	try {
		e.setPointerCapture(t);
	} catch {}
}
function em(e, t) {
	try {
		e.hasPointerCapture?.(t) && e.releasePointerCapture(t);
	} catch {}
}
//#endregion
//#region src/lib/context-river/overlay-focus.ts
function tm(e = gr) {
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
function nm(e, t) {
	return e == null || t == null ? NaN : e < t ? -1 : e > t ? 1 : e >= t ? 0 : NaN;
}
//#endregion
//#region node_modules/d3-array/src/descending.js
function rm(e, t) {
	return e == null || t == null ? NaN : t < e ? -1 : t > e ? 1 : t >= e ? 0 : NaN;
}
//#endregion
//#region node_modules/d3-array/src/bisector.js
function im(e) {
	let t, n, r;
	e.length === 2 ? (t = e === nm || e === rm ? e : am, n = e, r = e) : (t = nm, n = (t, n) => nm(e(t), n), r = (t, n) => e(t) - n);
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
function am() {
	return 0;
}
//#endregion
//#region node_modules/d3-array/src/number.js
function om(e) {
	return e === null ? NaN : +e;
}
//#endregion
//#region node_modules/d3-array/src/bisect.js
var sm = im(nm), cm = sm.right;
sm.left, im(om).center;
//#endregion
//#region node_modules/d3-array/src/ticks.js
var lm = Math.sqrt(50), um = Math.sqrt(10), dm = Math.sqrt(2);
function fm(e, t, n) {
	let r = (t - e) / Math.max(0, n), i = Math.floor(Math.log10(r)), a = r / 10 ** i, o = a >= lm ? 10 : a >= um ? 5 : a >= dm ? 2 : 1, s, c, l;
	return i < 0 ? (l = 10 ** -i / o, s = Math.round(e * l), c = Math.round(t * l), s / l < e && ++s, c / l > t && --c, l = -l) : (l = 10 ** i * o, s = Math.round(e / l), c = Math.round(t / l), s * l < e && ++s, c * l > t && --c), c < s && .5 <= n && n < 2 ? fm(e, t, n * 2) : [
		s,
		c,
		l
	];
}
function pm(e, t, n) {
	if (t = +t, e = +e, n = +n, !(n > 0)) return [];
	if (e === t) return [e];
	let r = t < e, [i, a, o] = r ? fm(t, e, n) : fm(e, t, n);
	if (!(a >= i)) return [];
	let s = a - i + 1, c = Array(s);
	if (r) {
		if (o < 0) for (let e = 0; e < s; ++e) c[e] = (a - e) / -o;
		else for (let e = 0; e < s; ++e) c[e] = (a - e) * o;
	} else if (o < 0) for (let e = 0; e < s; ++e) c[e] = (i + e) / -o;
	else for (let e = 0; e < s; ++e) c[e] = (i + e) * o;
	return c;
}
function mm(e, t, n) {
	return t = +t, e = +e, n = +n, fm(e, t, n)[2];
}
function hm(e, t, n) {
	t = +t, e = +e, n = +n;
	let r = t < e, i = r ? mm(t, e, n) : mm(e, t, n);
	return (r ? -1 : 1) * (i < 0 ? 1 / -i : i);
}
//#endregion
//#region src/lib/context-river/vertical-scale.ts
function gm(e, t, n) {
	if (e.length === 0 || !Number.isFinite(t) || !Number.isFinite(n)) return {
		maxWeight: 0,
		visibleCallCount: 0,
		usesInterpolatedEdge: !1
	};
	let r = e, i = Math.min(t, n), a = Math.max(t, n), o = Sm(r, i), s = Cm(r, a), c = wm(r, i), l = wm(r, a), u = Math.max(0, c.weight, l.weight);
	for (let e = o; e < s; e += 1) u = Math.max(u, r[e].totalDisplayWeight);
	return {
		maxWeight: u,
		visibleCallCount: Math.max(0, s - o),
		usesInterpolatedEdge: c.interpolated || l.interpolated
	};
}
function _m(e, t = 4, n = .06) {
	if (!Number.isFinite(e) || e <= 0) return [0];
	let r = e * (1 - n);
	return [
		0,
		...pm(0, e, Math.max(1, Math.floor(t))).filter((e) => e > 0 && e < r),
		e
	];
}
var vm = new Intl.NumberFormat(void 0, {
	notation: "compact",
	maximumFractionDigits: 1
}), ym = new Intl.NumberFormat(void 0, { maximumFractionDigits: 1 }), bm = new Intl.NumberFormat(void 0, { maximumFractionDigits: 0 });
function xm(e) {
	return Number.isFinite(e) ? Math.abs(e) >= 1e3 ? vm.format(e) : Number.isInteger(e) ? bm.format(e) : ym.format(e) : "—";
}
function Sm(e, t) {
	let n = 0, r = e.length;
	for (; n < r;) {
		let i = Math.floor((n + r) / 2);
		e[i].x < t ? n = i + 1 : r = i;
	}
	return n;
}
function Cm(e, t) {
	let n = 0, r = e.length;
	for (; n < r;) {
		let i = Math.floor((n + r) / 2);
		e[i].x <= t ? n = i + 1 : r = i;
	}
	return n;
}
function wm(e, t) {
	let n = e[0], r = e[e.length - 1];
	if (t <= n.x) return {
		weight: Math.max(0, n.totalDisplayWeight),
		interpolated: !1
	};
	if (t >= r.x) return {
		weight: Math.max(0, r.totalDisplayWeight),
		interpolated: !1
	};
	let i = Sm(e, t), a = e[i];
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
var Tm = /* @__PURE__ */ Rr("<rect x=\"1\" y=\"1\" rx=\"4\" class=\"glyph-compaction svelte-1kmdkag\"></rect><text text-anchor=\"middle\" class=\"svelte-1kmdkag\">C</text>", 1), Em = /* @__PURE__ */ Rr("<path class=\"glyph-target svelte-1kmdkag\"></path><text text-anchor=\"middle\" class=\"svelte-1kmdkag\">M</text>", 1), Dm = /* @__PURE__ */ Rr("<circle class=\"glyph-ratio svelte-1kmdkag\"></circle><text text-anchor=\"middle\" class=\"svelte-1kmdkag\"> </text>", 1), Om = /* @__PURE__ */ Rr("<g><!></g>"), km = /* @__PURE__ */ Rr("<svg><!></svg>"), Am = {
	hash: "svelte-1kmdkag",
	code: ".event-glyph-svg.svelte-1kmdkag {display:inline-block;flex:0 0 auto;overflow:visible;vertical-align:middle;}.event-glyph-svg.svelte-1kmdkag text:where(.svelte-1kmdkag) {fill:var(--active-text);font:750 9px ui-sans-serif,\n      system-ui,\n      sans-serif;pointer-events:none;}.event-glyph-svg-compaction.svelte-1kmdkag text:where(.svelte-1kmdkag) {fill:var(--event-compaction-text);}.event-glyph-svg-ratioChange.svelte-1kmdkag text:where(.svelte-1kmdkag) {fill:var(--event-warning-text);}.event-glyph-svg.rise.svelte-1kmdkag text:where(.svelte-1kmdkag) {fill:var(--event-success-text);}.glyph-compaction.svelte-1kmdkag {fill:var(--event-compaction-fill);stroke:var(--compaction);stroke-width:1.25;}.glyph-target.svelte-1kmdkag {fill:var(--action);stroke:var(--event-target);stroke-width:1.25;}.glyph-ratio.svelte-1kmdkag {fill:var(--event-warning);stroke:var(--page);stroke-width:1.25;}.event-glyph-svg.rise.svelte-1kmdkag .glyph-ratio:where(.svelte-1kmdkag) {fill:var(--event-success);}"
};
function jm(e, t) {
	ui(e, Am);
	let n = X(t, "direction", 3, void 0), r = X(t, "size", 3, 22), i = X(t, "label", 3, void 0), a = X(t, "svg", 3, !1), o = X(t, "x", 3, void 0), s = X(t, "y", 3, void 0);
	var c = Br(), l = R(c), u = (e) => {
		var a = Om(), c = L(a), l = (e) => {
			var t = Tm(), n = R(t), i = B(n);
			V(() => {
				Y(n, "width", r() - 2), Y(n, "height", r() - 2), Y(i, "x", r() / 2), Y(i, "y", r() / 2 + 4);
			}), G(e, t);
		}, u = (e) => {
			var t = Em(), n = R(t), i = B(n);
			V(() => {
				Y(n, "d", `M ${r() / 2} 1 l ${r() / 2 - 1} ${r() / 2 - 1} l -${r() / 2 - 1} ${r() / 2 - 1} l -${r() / 2 - 1} -${r() / 2 - 1} Z`), Y(i, "x", r() / 2), Y(i, "y", r() / 2 + 4);
			}), G(e, t);
		}, d = (e) => {
			var t = Dm(), i = R(t), a = B(i), o = z(a, !0);
			V(() => {
				Y(i, "cx", r() / 2), Y(i, "cy", r() / 2), Y(i, "r", r() / 2 - 2), Y(a, "x", r() / 2), Y(a, "y", r() / 2 + 4), K(o, n() === "drop" ? "↓" : "↑");
			}), G(e, t);
		};
		q(c, (e) => {
			t.kind === "compaction" ? e(l) : t.kind === "targetChange" ? e(u, 1) : e(d, -1);
		}), N(a), V(() => {
			_i(a, 0, `event-glyph-svg event-glyph-svg-${t.kind} ${n() ?? ""}`, "svelte-1kmdkag"), Y(a, "transform", `translate(${o() ?? 0} ${s() ?? 0})`), Y(a, "aria-label", i());
		}), G(e, a);
	}, d = (e) => {
		var a = km(), o = L(a), s = (e) => {
			var t = Tm(), n = R(t), i = B(n);
			V(() => {
				Y(n, "width", r() - 2), Y(n, "height", r() - 2), Y(i, "x", r() / 2), Y(i, "y", r() / 2 + 4);
			}), G(e, t);
		}, c = (e) => {
			var t = Em(), n = R(t), i = B(n);
			V(() => {
				Y(n, "d", `M ${r() / 2} 1 l ${r() / 2 - 1} ${r() / 2 - 1} l -${r() / 2 - 1} ${r() / 2 - 1} l -${r() / 2 - 1} -${r() / 2 - 1} Z`), Y(i, "x", r() / 2), Y(i, "y", r() / 2 + 4);
			}), G(e, t);
		}, l = (e) => {
			var t = Dm(), i = R(t), a = B(i), o = z(a, !0);
			V(() => {
				Y(i, "cx", r() / 2), Y(i, "cy", r() / 2), Y(i, "r", r() / 2 - 2), Y(a, "x", r() / 2), Y(a, "y", r() / 2 + 4), K(o, n() === "drop" ? "↓" : "↑");
			}), G(e, t);
		};
		q(o, (e) => {
			t.kind === "compaction" ? e(s) : t.kind === "targetChange" ? e(c, 1) : e(l, -1);
		}), N(a), V(() => {
			_i(a, 0, `event-glyph-svg event-glyph-svg-${t.kind} ${n() ?? ""}`, "svelte-1kmdkag"), Y(a, "width", r()), Y(a, "height", r()), Y(a, "viewBox", `0 0 ${r()} ${r()}`), Y(a, "aria-label", i()), Y(a, "aria-hidden", i() ? void 0 : "true"), Y(a, "role", i() ? "img" : void 0);
		}), G(e, a);
	};
	q(l, (e) => {
		a() ? e(u) : e(d, -1);
	}), G(e, c);
}
//#endregion
//#region src/lib/context-river/event-clustering.ts
var Mm = {
	compaction: "compaction",
	targetChange: "model/provider change",
	ratioChange: "cache-share change"
};
function Nm(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e) {
		let e = Mm[n.kind];
		t.set(e, (t.get(e) ?? 0) + 1);
	}
	let n = [...t.entries()].sort(([e], [t]) => e.localeCompare(t)).map(([e, t]) => `${t} ${e}${t === 1 ? "" : "s"}`).join(" · ");
	return `${e.length} economics event${e.length === 1 ? "" : "s"} · ${n}`;
}
function Pm(e) {
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
function Fm(e) {
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
function Im(e, t) {
	return e.length === 1 ? t : Math.max(46, 14 + Pm(e).length * 7.2);
}
function Lm(e, t) {
	let n = Im(e, t.markerSize), r = Math.max(1, t.chartWidth - t.left - t.right), i = Math.min(n + 16, r), a = Math.min(n, i), o = e.reduce((e, t) => e + t.x, 0) / e.length, s = Math.max(t.left + i / 2, Math.min(t.chartWidth - t.right - i / 2, o));
	return {
		id: `event-cluster-${e[0]?.id ?? "empty"}`,
		x: s,
		anchorX: o,
		events: e,
		badgeWidth: a,
		hitWidth: i,
		left: s - i / 2,
		right: s + i / 2,
		compositionLabel: Nm(e),
		badgeLabel: Pm(e),
		callRanges: Fm(e)
	};
}
function Rm(e, t) {
	let n = {
		chartWidth: Math.max(0, t.chartWidth),
		left: Math.max(0, t.left),
		right: Math.max(0, t.right),
		markerSize: t.markerSize ?? 22,
		collisionGap: t.collisionGap ?? 6
	}, r = [...e].sort((e, t) => e.x - t.x || e.id.localeCompare(t.id)), i = [];
	for (let e of r) {
		let t = Lm([e], n), r = i[i.length - 1];
		r && t.left < r.right + n.collisionGap ? i[i.length - 1] = Lm([...r.events, e], n) : i.push(t);
	}
	for (let e = 1; e < i.length;) {
		let t = i[e - 1], r = i[e];
		t && r && r.left < t.right + n.collisionGap ? (i.splice(e - 1, 2, Lm([...t.events, ...r.events], n)), e = Math.max(1, e - 1)) : e += 1;
	}
	return i;
}
//#endregion
//#region src/lib/context-river/EconomicsTrack.svelte
var zm = /* @__PURE__ */ Rr("<line class=\"track-gridline svelte-18b1ucv\"></line><text class=\"track-y-label svelte-18b1ucv\" text-anchor=\"end\"> </text>", 1), Bm = /* @__PURE__ */ Rr("<line class=\"compaction-span svelte-18b1ucv\"><title> </title></line>"), Vm = /* @__PURE__ */ Rr("<rect class=\"event-count-badge svelte-18b1ucv\" rx=\"5\"></rect><text class=\"event-count svelte-18b1ucv\" text-anchor=\"middle\"> </text>", 1), Hm = /* @__PURE__ */ Rr("<g role=\"button\" tabindex=\"0\"><title> </title><rect class=\"event-hit svelte-18b1ucv\" rx=\"5\"></rect><!></g>"), Um = /* @__PURE__ */ Rr("<rect></rect>"), Wm = /* @__PURE__ */ Rr("<circle class=\"zero-mark svelte-18b1ucv\" r=\"3\"></circle>"), Gm = /* @__PURE__ */ Rr("<rect class=\"missing-mark svelte-18b1ucv\" width=\"8\" height=\"8\"></rect>"), Km = /* @__PURE__ */ Rr("<path class=\"uncertain-mark svelte-18b1ucv\"></path>"), qm = /* @__PURE__ */ Rr("<line class=\"track-pin svelte-18b1ucv\"></line>"), Jm = /* @__PURE__ */ Rr("<line class=\"track-hover svelte-18b1ucv\"></line>"), Ym = /* @__PURE__ */ Rr("<g role=\"button\"><title> </title><!><!><!></g>"), Xm = /* @__PURE__ */ Rr("<line class=\"cost-range svelte-18b1ucv\"></line>"), Zm = /* @__PURE__ */ Rr("<line></line><circle r=\"3.5\"></circle>", 1), Qm = /* @__PURE__ */ Rr("<circle r=\"3.5\"></circle>"), $m = /* @__PURE__ */ Rr("<g role=\"button\"><title> </title><!><!><!><!></g>"), eh = /* @__PURE__ */ W("<div class=\"track-shell svelte-18b1ucv\" role=\"presentation\"><svg class=\"economics-track-svg svelte-18b1ucv\" role=\"group\"><defs><pattern id=\"economics-write-pattern\" width=\"6\" height=\"6\" patternUnits=\"userSpaceOnUse\" patternTransform=\"rotate(45)\"><rect width=\"6\" height=\"6\" fill=\"var(--cache-write)\"></rect><path d=\"M0 0V6\" stroke=\"var(--cache-write-mark)\" stroke-width=\"1.5\" opacity=\".7\"></path></pattern><pattern id=\"economics-fresh-pattern\" width=\"6\" height=\"6\" patternUnits=\"userSpaceOnUse\"><rect width=\"6\" height=\"6\" fill=\"var(--cache-fresh)\"></rect><circle cx=\"2\" cy=\"2\" r=\"1\" fill=\"var(--cache-fresh-mark)\"></circle></pattern><pattern id=\"economics-nonread-pattern\" width=\"7\" height=\"7\" patternUnits=\"userSpaceOnUse\" patternTransform=\"rotate(45)\"><rect width=\"7\" height=\"7\" fill=\"var(--cache-nonread)\"></rect><path d=\"M0 0V7\" stroke=\"var(--cache-nonread-mark)\" stroke-width=\"1.5\" opacity=\".8\"></path></pattern></defs><rect class=\"track-background svelte-18b1ucv\" x=\"0\" y=\"0\"></rect><rect class=\"track-plot svelte-18b1ucv\"></rect><!><g class=\"track-event-header svelte-18b1ucv\" aria-label=\"Economics event annotations\"><text class=\"svelte-18b1ucv\">Events</text></g><g class=\"track-event-lane svelte-18b1ucv\" aria-label=\"Economics event lane\"><rect class=\"svelte-18b1ucv\"></rect><!><!></g><!></svg></div>"), th = {
	hash: "svelte-18b1ucv",
	code: ".track-shell.svelte-18b1ucv {position:relative;min-width:0;}.economics-track-svg.svelte-18b1ucv {display:block;max-width:none;background:var(--plot);touch-action:pan-y;}.track-background.svelte-18b1ucv {fill:var(--plot);pointer-events:none;}.track-plot.svelte-18b1ucv {fill:var(--plot);pointer-events:none;}.track-gridline.svelte-18b1ucv {stroke:var(--separator);stroke-width:0.75;opacity:0.7;pointer-events:none;}.track-event-header.svelte-18b1ucv {fill:var(--muted);font-size:var(--text-xs);pointer-events:none;}.track-event-header.svelte-18b1ucv text:where(.svelte-18b1ucv):first-child {fill:var(--text);font-weight:750;}.track-event-lane.svelte-18b1ucv {pointer-events:all;}.track-event-lane.svelte-18b1ucv > rect:where(.svelte-18b1ucv) {fill:none;stroke:none;pointer-events:none;}.track-event-trigger.svelte-18b1ucv {cursor:pointer;pointer-events:all;outline:none;}.event-hit.svelte-18b1ucv {fill:transparent;stroke:transparent;stroke-width:2;pointer-events:all;}.event-count-badge.svelte-18b1ucv {stroke-width:1.25;fill:var(--action);stroke:var(--text);}.event-count.svelte-18b1ucv {fill:var(--active-text);font-size:var(--text-xs);font-weight:750;pointer-events:none;}.track-event-trigger.svelte-18b1ucv:focus-visible .event-hit:where(.svelte-18b1ucv) {fill:var(--action);fill-opacity:0.35;stroke:var(--selection);stroke-width:2.5;}.track-y-label.svelte-18b1ucv {fill:var(--text);font-size:9px;pointer-events:none;}.economics-mark.svelte-18b1ucv {cursor:pointer;outline:none;}.cache-segment.svelte-18b1ucv {stroke:var(--plot);stroke-width:0.6;}.cache-segment.cacheRead.svelte-18b1ucv {fill:var(--cache-read);}.cache-segment.cacheWrite.svelte-18b1ucv {fill:url(#economics-write-pattern);}.cache-segment.fresh.svelte-18b1ucv,\n  .cache-segment.uncached.svelte-18b1ucv {fill:url(#economics-fresh-pattern);}.cache-segment.nonRead.svelte-18b1ucv {fill:url(#economics-nonread-pattern);}.economics-mark.zero.svelte-18b1ucv .zero-mark:where(.svelte-18b1ucv) {fill:var(--plot);stroke:var(--text);stroke-width:1.5;}.uncertain-mark.svelte-18b1ucv {fill:var(--surface-raised);stroke:var(--warning);stroke-width:1.5;}.economics-mark.partial.svelte-18b1ucv .uncertain-mark:where(.svelte-18b1ucv) {fill:var(--surface-raised);stroke:var(--warning);}.economics-mark.unsupported.svelte-18b1ucv .uncertain-mark:where(.svelte-18b1ucv) {fill:var(--error-surface);stroke:var(--error);stroke-dasharray:2 1;}.missing-mark.svelte-18b1ucv {fill:none;stroke:var(--cache-nonread-mark);stroke-dasharray:2 1;stroke-width:1.5;}.cost-stem.svelte-18b1ucv {stroke:var(--cost);stroke-width:1.5;}.cost-stem.partial.svelte-18b1ucv {stroke:var(--warning);stroke-dasharray:3 2;}.cost-dot.svelte-18b1ucv {fill:var(--cost);stroke:var(--plot);stroke-width:1;}.cost-dot.partial.svelte-18b1ucv {stroke:var(--warning);stroke-width:2;}.cost-zero.svelte-18b1ucv {fill:var(--plot);stroke:var(--cost);stroke-width:1.5;}.cost-zero.partial.svelte-18b1ucv {stroke:var(--warning);stroke-dasharray:2 1;}\n  /* API-equivalent costs are not charges: hollow marks in a separate colour. */.api-equivalent.svelte-18b1ucv .cost-stem:where(.svelte-18b1ucv) {stroke:var(--api-cost);stroke-dasharray:3 2;}.api-equivalent.svelte-18b1ucv .cost-dot:where(.svelte-18b1ucv) {fill:var(--plot);stroke:var(--api-cost);stroke-width:1.5;}.api-equivalent.svelte-18b1ucv .cost-zero:where(.svelte-18b1ucv) {stroke:var(--api-cost);}.cost-range.svelte-18b1ucv {stroke:var(--cost);stroke-width:4;stroke-linecap:round;opacity:0.45;}.api-equivalent.svelte-18b1ucv .cost-range:where(.svelte-18b1ucv) {stroke:var(--api-cost);}.track-pin.svelte-18b1ucv {stroke:var(--selection);stroke-width:1.5;pointer-events:none;}.track-hover.svelte-18b1ucv {stroke:var(--secondary);stroke-width:1;stroke-dasharray:3 3;pointer-events:none;}.economics-mark.svelte-18b1ucv:focus-visible .cache-segment:where(.svelte-18b1ucv),\n  .economics-mark.svelte-18b1ucv:focus-visible .cost-dot:where(.svelte-18b1ucv),\n  .economics-mark.svelte-18b1ucv:focus-visible .cost-zero:where(.svelte-18b1ucv),\n  .economics-mark.svelte-18b1ucv:focus-visible .zero-mark:where(.svelte-18b1ucv),\n  .economics-mark.svelte-18b1ucv:focus-visible .uncertain-mark:where(.svelte-18b1ucv) {stroke:var(--selection);stroke-width:2.5;}.compaction-span.svelte-18b1ucv {stroke:var(--compaction);stroke-width:2;stroke-dasharray:4 3;stroke-linecap:round;}"
};
function nh(e, t) {
	Be(t, !0), ui(e, th);
	let n, r = X(t, "cacheView", 3, "tokens"), i = X(t, "onReadoutChange", 3, () => {}), a = X(t, "onEventBreakdownChange", 3, () => {}), o = tm();
	Tn(() => o.observeIdentity(t.indexed)), Vi(() => o.dispose());
	let s = /* @__PURE__ */ P(() => t.mode === "cost" ? 190 : 262), c = /* @__PURE__ */ P(() => t.mode === "cost" ? 116 : 188), l = /* @__PURE__ */ P(() => H(c) + 16 + 2), u = /* @__PURE__ */ P(() => Math.max(44, H(s) - H(l) - 10)), d = /* @__PURE__ */ P(() => H(l) + H(u) / 2), f = {
		top: 14,
		right: 24,
		bottom: 62,
		left: 42
	}, p = /* @__PURE__ */ P(() => t.mode === "cache" ? 180 : 108), m = /* @__PURE__ */ P(() => H(p) - f.top), h = /* @__PURE__ */ F(null), g = "", _ = "", v = /* @__PURE__ */ P(() => Gl(t.indexed.analysis.session.source)), y = /* @__PURE__ */ P(() => t.mode === "cache" ? ku(t.indexed.analysis) : null), b = /* @__PURE__ */ P(() => t.mode === "cost" ? Mu(t.indexed.analysis) : null), x = /* @__PURE__ */ P(() => new Map(H(y)?.points.map((e) => [e.callIndex, e]) ?? [])), S = /* @__PURE__ */ P(() => H(y)?.maximum ?? H(b)?.maximum ?? 0), ee = /* @__PURE__ */ P(() => t.mode === "cost" ? H(S) > 0 ? H(S) : 1 : r() === "share" ? 100 : Math.max(1, H(S))), C = /* @__PURE__ */ P(() => new Map(t.columns.map((e) => [e.callIndex, e]))), w = /* @__PURE__ */ P(() => ue(t.indexed.analysis.compactions, t.columns, t.width)), T = /* @__PURE__ */ P(() => le(t.indexed.analysis.compactions, t.columns, H(w))), E = /* @__PURE__ */ P(() => de(t.indexed.analysis.modelCalls, t.columns)), D = /* @__PURE__ */ P(() => new Map(H(E).map((e) => [e.callIndex, e]))), O = /* @__PURE__ */ P(() => t.columns.length < 2 ? 14 : t.columns.reduce((e, n, r) => r === 0 ? e : Math.min(e, n.x - t.columns[r - 1].x), Infinity)), k = /* @__PURE__ */ P(() => Math.max(1.5, Math.min(12, H(O) * .68))), te = /* @__PURE__ */ P(() => _m(t.mode === "cache" && r() === "share" ? 100 : H(S), 3, .25)), A = /* @__PURE__ */ P(() => H(te).map((e) => ({
		value: e,
		y: f.top + H(m) * (1 - e / H(ee))
	}))), ne = /* @__PURE__ */ P(() => H(y) ? M(H(y), H(C), {
		cacheView: r(),
		domainMaximum: H(ee),
		baseline: H(p),
		innerHeight: H(m),
		targetChangesByCall: H(D),
		usageMappingLabel: H(v)
	}) : []), re = /* @__PURE__ */ P(() => H(b) ? ve(H(b), H(C), {
		domainMaximum: H(ee),
		baseline: H(p),
		innerHeight: H(m),
		targetChangesByCall: H(D)
	}) : []), ie = /* @__PURE__ */ P(() => fe(H(w), H(E), H(y), H(C))), ae = /* @__PURE__ */ P(() => Rm(H(ie), {
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
		let r = new Map(t.map((e) => [e.callIndex, e.x])), i = new Map(n.map((e) => [e.callIndex, e.x]));
		return e.flatMap((e) => {
			let t = e.details.startedBeforeModelCall, n = i.get(e.beforeModelCall);
			if (t === null || t >= e.beforeModelCall || n === void 0) return [];
			let a = r.get(t), o = r.get(t - 1);
			if (a === void 0) return [];
			let s = o === void 0 ? a : (o + a) / 2;
			return [{
				callIndex: e.beforeModelCall,
				startX: s,
				endX: n,
				label: `Compaction ran in the background from before call ${t} to before call ${e.beforeModelCall}`
			}];
		});
	}
	function ue(e, t, n) {
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
	function de(e, t) {
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
	function fe(e, t, n, r) {
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
				label: Ou(t, e.callIndex)
			});
		}
		return i.sort((e, t) => e.x - t.x || e.id.localeCompare(t.id));
	}
	function pe(e) {
		return `${e.label} · call ${e.callIndex}`;
	}
	Cn(() => {
		if (H(h) !== null && !H(ae).some((e) => e.id === H(h))) {
			let e = H(h);
			I(h, null), o.focusAfterUpdate(() => ge(e), () => H(h) === null);
		}
	});
	function me(e) {
		let t = e.id;
		I(h, t, !0), o.focusAfterUpdate(() => Hi(n).getElementById(`${t}-close`), () => H(h) === t);
	}
	function he(e = !0) {
		let t = H(h);
		I(h, null), o.cancel(), e && t && o.focusAfterUpdate(() => ge(t), () => H(h) === null);
	}
	function ge(e) {
		return Hi(n).getElementById(e) ?? Hi(n).querySelector(".economics-track-header button");
	}
	function j(e, t) {
		(e.key === "Enter" || e.key === " ") && (e.preventDefault(), me(t));
	}
	function _e(e) {
		let n = t.indexed.callByIndex.get(e);
		if (!n) return "";
		if (t.mode === "cache") {
			let i = H(x).get(e);
			if (!i || i.status !== "complete" && i.status !== "zero") return `Call ${e} · ${i?.note ?? "Cache data unavailable"}`;
			let a = i.segments.map((e) => `${e.label} ${Q(e.value)}`).join(" · "), o = i.shareStatus === "complete" ? `${we(i)} · ${H(v)} denominator of ${Q(i.shareDenominator ?? 0)} prompt tokens` : we(i), s = n.economics.promptTokens, c = n.economics.cacheReadRatio, l = s === null || s <= 0 ? "cache-read share unavailable; prompt-token denominator is zero or unavailable" : c === null ? `cache-read share unavailable of ${Q(s)} prompt tokens` : `cache-read share ${Ua(c)} of ${Q(s)} prompt tokens`, u = n.costAssessment.amount === null ? "" : ` · ${$l(n.costAssessment, t.indexed.analysis.session.source)} cost ${tu(n.costAssessment)} USD`;
			return `Call ${e}${t.pinnedCallIndex === e && t.hoveredCallIndex !== e ? " · pinned" : ""} · ${a} · ${t.mode === "cache" && r() === "share" ? `${o} · ` : ""}${l}${u}`;
		}
		return n.costAssessment.amount === null ? `Call ${e} · cost unavailable` : `Call ${e} · ${$l(n.costAssessment, t.indexed.analysis.session.source)} cost ${tu(n.costAssessment)} USD`;
	}
	function M(e, t, n) {
		return e.points.flatMap((e) => {
			let r = t.get(e.callIndex)?.x;
			return r === void 0 ? [] : [ye(e, r, n)];
		});
	}
	function ve(e, t, n) {
		return e.points.flatMap((e) => {
			let r = t.get(e.callIndex)?.x;
			return r === void 0 ? [] : [xe(e, r, n)];
		});
	}
	function ye(e, n, { cacheView: r, domainMaximum: i, baseline: a, innerHeight: o, targetChangesByCall: s, usageMappingLabel: c }) {
		let l = a, u = (r === "share" ? e.shareSegments : e.segments).map((e) => {
			let t = r === "share" && "percentage" in e ? e.percentage : e.value, n = t / i * o, a = l - n;
			return l = a, {
				...e,
				displayValue: t,
				y: a,
				height: n
			};
		}), d = t.indexed.callByIndex.get(e.callIndex), f = e.segments.map((e) => `${e.label} ${Q(e.value)}`).join(" · "), p = we(e), m = d ? Ha(d.economics.cacheReadRatio) : "Unknown", h = d?.economics.promptTokens === null || d?.economics.promptTokens === void 0 ? `${c} prompt-token denominator unavailable` : `${c} denominator of ${Q(d.economics.promptTokens)} prompt tokens`, g = e.discontinuity, _ = s.get(e.callIndex)?.label, v = _ ? ` · ${_}.` : "", y = g ? ` · ${Ou(g, e.callIndex)} (${(g.delta * 100).toFixed(1)} percentage points, ${g.magnitude})` : "", b = r === "share" ? ` · ${p} · ${h}` : "", x = e.status === "complete" || e.status === "zero";
		return {
			point: e,
			x: n,
			segments: u,
			labelDetail: x ? ` · prompt ${Q(e.promptTokens ?? 0)} tokens · ${f}${b} · cache-read share ${m} ${h}${e.note ? ` · ${e.note}` : ""}${v}${y}` : ` · ${e.note}`,
			showsPin: x
		};
	}
	function be(e, t, n) {
		let r = e.point.callIndex;
		return `Call ${r}${e.showsPin && t === r && n !== r ? " · pinned" : ""}${e.labelDetail}`;
	}
	function xe(e, n, { domainMaximum: r, baseline: i, innerHeight: a, targetChangesByCall: o }) {
		let s = (e) => e === null ? i : i - e / r * a, c = s(e.total), l = e.high === null ? null : s(e.high), u = o.get(e.callIndex)?.label, d = u ? ` · ${u}.` : "", f = t.indexed.callByIndex.get(e.callIndex)?.costAssessment, p = e.kind === "recorded" ? ` · cost components ${e.componentStatus}` : "";
		return {
			point: e,
			x: n,
			y: c,
			yHigh: l,
			ariaLabel: (e.status === "known" || e.status === "zero") && f ? `Call ${e.callIndex} · ${$l(f, t.indexed.analysis.session.source)} cost ${tu(f)} USD${p}${d}` : e.status === "partial" ? `Call ${e.callIndex} · cost unavailable · some recorded cost components are present` : `Call ${e.callIndex} · cost unavailable`
		};
	}
	function Se(e) {
		return r() === "share" ? `${e.toFixed(0)}%` : xm(e);
	}
	function Ce(e) {
		return za(e);
	}
	function we(e) {
		return e.shareStatus === "complete" ? e.shareSegments.map((e) => `${e.label} ${Ua(e.percentage / 100)}`).join(" · ") : e.shareStatus === "zeroPrompt" ? "share undefined: zero prompt tokens" : "share unavailable: incomplete or unsupported usage";
	}
	function Te(e) {
		Hi(n).getElementById(`economics-call-${e}`)?.focus();
	}
	function Ee(e, n) {
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
		o && (I(De, o.index), t.onHoverCall(o.index), Te(o.index));
	}
	let De = /* @__PURE__ */ P(() => t.pinnedCallIndex ?? t.indexed.analysis.modelCalls[0]?.index ?? null);
	var Oe = { closeEventBreakdown: he }, ke = eh(), Ae = L(ke), je = B(L(Ae)), Me = B(je), Ne = B(Me);
	J(Ne, 17, () => H(A), ei, (e, n) => {
		var r = zm(), i = R(r), a = B(i), o = z(a, !0);
		V((e) => {
			Y(i, "x1", f.left), Y(i, "x2", t.width - f.right), Y(i, "y1", H(n).y), Y(i, "y2", H(n).y), Y(a, "x", f.left - 5), Y(a, "y", H(n).y + 3), K(o, e);
		}, [() => t.mode === "cache" ? Se(H(n).value) : Ce(H(n).value)]), G(e, r);
	});
	var Pe = B(Ne), Fe = z(Pe), Ie = B(Pe), Le = L(Ie), Re = B(Le);
	J(Re, 17, () => H(T), (e) => e.callIndex, (e, t) => {
		var n = Bm(), r = z(L(n), !0);
		N(n), V(() => {
			Y(n, "x1", H(t).startX), Y(n, "x2", H(t).endX), Y(n, "y1", H(d)), Y(n, "y2", H(d)), K(r, H(t).label);
		}), G(e, n);
	}), J(B(Re), 17, () => H(ae), (e) => e.id, (e, t) => {
		let n = /* @__PURE__ */ P(() => H(t).events[0]);
		var r = Hm();
		let i;
		var a = L(r), o = z(a), s = B(a), c = B(s), f = (e) => {
			{
				let r = /* @__PURE__ */ P(() => H(t).x - 11), i = /* @__PURE__ */ P(() => H(d) - 11), a = /* @__PURE__ */ P(() => H(n).kind === "compaction" ? "Compaction" : H(n).kind === "targetChange" ? "Model / provider change" : `Cache-share ${H(n).direction === "drop" ? "drop" : "rise"}`);
				jm(e, {
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
			var n = Vm(), r = R(n);
			Y(r, "height", 22);
			var i = B(r), a = z(i, !0);
			V(() => {
				Y(r, "x", H(t).x - H(t).badgeWidth / 2), Y(r, "y", H(d) - 11), Y(r, "width", H(t).badgeWidth), Y(i, "x", H(t).x), Y(i, "y", H(d) + 4), K(a, H(t).badgeLabel);
			}), G(e, n);
		};
		q(c, (e) => {
			H(t).events.length === 1 ? e(f) : e(p, -1);
		}), N(r), V((e, a) => {
			Y(r, "id", H(t).id), i = _i(r, 0, `track-event-trigger ${H(t).events.length === 1 ? "track-event-singleton" : "track-event-cluster"} track-${H(n)?.kind ?? "cluster"} ${H(n)?.kind === "compaction" ? "track-compaction-marker" : H(n)?.kind === "targetChange" ? "track-target-change" : H(n)?.kind === "ratioChange" ? "track-ratioChange ratio-change-marker" : ""}`, "svelte-18b1ucv", i, {
				rise: H(n)?.direction === "rise",
				large: H(n)?.magnitude === "large"
			}), Y(r, "aria-label", e), K(o, `${H(t).compositionLabel ?? ""} at calls ${H(t).callRanges ?? ""} ·
            ${a ?? ""}`), Y(s, "x", H(t).x - H(t).hitWidth / 2), Y(s, "y", H(l) + 6), Y(s, "width", H(t).hitWidth), Y(s, "height", H(u) - 12);
		}, [() => H(t).events.length === 1 ? `${pe(H(n))}; activate for details` : `${H(t).compositionLabel} at calls ${H(t).callRanges}; activate for breakdown`, () => H(t).events.map((e) => pe(e)).join("; ")]), U("click", r, (e) => {
			e.stopPropagation(), me(H(t));
		}), U("keydown", r, (e) => j(e, H(t))), G(e, r);
	}), N(Ie);
	var ze = B(Ie), He = (e) => {
		var n = Br();
		J(R(n), 17, () => H(ne), (e) => e.point.callIndex, (e, n) => {
			var r = Ym();
			let i;
			var a = L(r), o = z(a, !0), s = B(a), c = (e) => {
				var t = Br();
				J(R(t), 19, () => H(n).segments, (e, t) => `${e.kind}-${t}`, (e, t) => {
					var r = Br(), i = R(r), a = (e) => {
						var r = Um();
						V(() => {
							_i(r, 0, `cache-segment ${H(t).kind}`, "svelte-18b1ucv"), Y(r, "x", H(n).x - H(k) / 2), Y(r, "y", H(t).y), Y(r, "width", H(k)), Y(r, "height", H(t).height);
						}), G(e, r);
					};
					q(i, (e) => {
						H(t).height > 0 && e(a);
					}), G(e, r);
				}), G(e, t);
			}, l = (e) => {
				var t = Wm();
				V(() => {
					Y(t, "cx", H(n).x), Y(t, "cy", H(p) - 2);
				}), G(e, t);
			}, u = (e) => {
				var t = Gm();
				V(() => {
					Y(t, "x", H(n).x - 4), Y(t, "y", H(p) - 7);
				}), G(e, t);
			}, d = (e) => {
				var t = Km();
				V(() => Y(t, "d", `M ${H(n).x} ${H(p) - 8} l 5 5 l -5 5 l -5 -5 Z`)), G(e, t);
			};
			q(s, (e) => {
				H(n).point.status === "complete" ? e(c) : H(n).point.status === "zero" ? e(l, 1) : H(n).point.status === "missing" ? e(u, 2) : e(d, -1);
			});
			var m = B(s), h = (e) => {
				var t = qm();
				V(() => {
					Y(t, "x1", H(n).x), Y(t, "x2", H(n).x), Y(t, "y1", f.top), Y(t, "y2", H(p));
				}), G(e, t);
			};
			q(m, (e) => {
				t.pinnedCallIndex === H(n).point.callIndex && e(h);
			});
			var g = B(m), _ = (e) => {
				var t = Jm();
				V(() => {
					Y(t, "x1", H(n).x), Y(t, "x2", H(n).x), Y(t, "y1", f.top), Y(t, "y2", H(p));
				}), G(e, t);
			};
			q(g, (e) => {
				t.hoveredCallIndex === H(n).point.callIndex && e(_);
			}), N(r), V((e, a) => {
				Y(r, "id", `economics-call-${H(n).point.callIndex}`), i = _i(r, 0, "economics-mark cache-mark svelte-18b1ucv", null, i, {
					partial: H(n).point.status === "partial",
					missing: H(n).point.status === "missing",
					unsupported: H(n).point.status === "unsupported",
					zero: H(n).point.status === "zero",
					pinned: t.pinnedCallIndex === H(n).point.callIndex,
					hovered: t.hoveredCallIndex === H(n).point.callIndex
				}), Y(r, "tabindex", H(De) === H(n).point.callIndex ? 0 : -1), Y(r, "aria-label", e), Y(r, "aria-current", t.pinnedCallIndex === H(n).point.callIndex ? "true" : void 0), K(o, a);
			}, [() => be(H(n), t.pinnedCallIndex, t.hoveredCallIndex), () => be(H(n), t.pinnedCallIndex, t.hoveredCallIndex)]), Or("pointerenter", r, () => t.onHoverCall(H(n).point.callIndex)), Or("pointerleave", r, () => t.onHoverCall(null)), Or("focus", r, () => t.onHoverCall(H(n).point.callIndex)), U("keydown", r, (e) => Ee(e, H(n).point.callIndex)), U("click", r, (e) => t.onMarkClick(e, H(n).point.callIndex)), G(e, r);
		}), G(e, n);
	}, Ue = (e) => {
		var n = Br();
		J(R(n), 17, () => H(re), (e) => e.point.callIndex, (e, n) => {
			var r = $m();
			let i;
			var a = L(r), o = z(a, !0), s = B(a), c = (e) => {
				var t = Xm();
				V(() => {
					Y(t, "x1", H(n).x), Y(t, "x2", H(n).x), Y(t, "y1", H(n).y), Y(t, "y2", H(n).yHigh);
				}), G(e, t);
			};
			q(s, (e) => {
				H(n).point.status === "known" && H(n).yHigh !== null && e(c);
			});
			var l = B(s), u = (e) => {
				var t = Zm(), r = R(t);
				let i;
				var a = B(r);
				let o;
				V(() => {
					i = _i(r, 0, "cost-stem svelte-18b1ucv", null, i, { partial: H(n).point.componentStatus === "partial" }), Y(r, "x1", H(n).x), Y(r, "x2", H(n).x), Y(r, "y1", H(p)), Y(r, "y2", H(n).y), o = _i(a, 0, "cost-dot svelte-18b1ucv", null, o, { partial: H(n).point.componentStatus === "partial" }), Y(a, "cx", H(n).x), Y(a, "cy", H(n).y);
				}), G(e, t);
			}, d = (e) => {
				var t = Qm();
				let r;
				V(() => {
					r = _i(t, 0, "cost-zero svelte-18b1ucv", null, r, { partial: H(n).point.componentStatus === "partial" }), Y(t, "cx", H(n).x), Y(t, "cy", H(p) - 2);
				}), G(e, t);
			}, m = (e) => {
				var t = Km();
				V(() => Y(t, "d", `M ${H(n).x} ${H(p) - 8} l 5 5 l -5 5 l -5 -5 Z`)), G(e, t);
			}, h = (e) => {
				var t = Gm();
				V(() => {
					Y(t, "x", H(n).x - 4), Y(t, "y", H(p) - 7);
				}), G(e, t);
			};
			q(l, (e) => {
				H(n).point.status === "known" ? e(u) : H(n).point.status === "zero" ? e(d, 1) : H(n).point.status === "partial" ? e(m, 2) : e(h, -1);
			});
			var g = B(l), _ = (e) => {
				var t = qm();
				V(() => {
					Y(t, "x1", H(n).x), Y(t, "x2", H(n).x), Y(t, "y1", f.top), Y(t, "y2", H(p));
				}), G(e, t);
			};
			q(g, (e) => {
				t.pinnedCallIndex === H(n).point.callIndex && e(_);
			});
			var v = B(g), y = (e) => {
				var t = Jm();
				V(() => {
					Y(t, "x1", H(n).x), Y(t, "x2", H(n).x), Y(t, "y1", f.top), Y(t, "y2", H(p));
				}), G(e, t);
			};
			q(v, (e) => {
				t.hoveredCallIndex === H(n).point.callIndex && e(y);
			}), N(r), V(() => {
				Y(r, "id", `economics-call-${H(n).point.callIndex}`), i = _i(r, 0, "economics-mark cost-mark svelte-18b1ucv", null, i, {
					partial: H(n).point.status === "partial" || H(n).point.componentStatus === "partial",
					missing: H(n).point.status === "missing",
					zero: H(n).point.status === "zero",
					"api-equivalent": H(n).point.kind === "apiEquivalent",
					pinned: t.pinnedCallIndex === H(n).point.callIndex,
					hovered: t.hoveredCallIndex === H(n).point.callIndex
				}), Y(r, "tabindex", H(De) === H(n).point.callIndex ? 0 : -1), Y(r, "aria-label", H(n).ariaLabel), Y(r, "aria-current", t.pinnedCallIndex === H(n).point.callIndex ? "true" : void 0), K(o, H(n).ariaLabel);
			}), Or("pointerenter", r, () => t.onHoverCall(H(n).point.callIndex)), Or("focus", r, () => t.onHoverCall(H(n).point.callIndex)), U("keydown", r, (e) => Ee(e, H(n).point.callIndex)), U("click", r, (e) => t.onMarkClick(e, H(n).point.callIndex)), G(e, r);
		}), G(e, n);
	};
	return q(ze, (e) => {
		t.mode === "cache" ? e(He) : e(Ue, -1);
	}), N(Ae), N(ke), Ri(ke, (e) => n = e, () => n), V((e, n) => {
		yi(ke, `width:${t.width}px`), Y(Ae, "viewBox", `0 0 ${t.width} ${H(s)}`), Y(Ae, "width", t.width), Y(Ae, "height", H(s)), Y(Ae, "aria-label", t.mode === "cache" ? "Cache usage track. One keyboard stop; use left and right arrows to inspect calls." : "Cost track. One keyboard stop; use left and right arrows to inspect calls."), Y(je, "width", t.width), Y(je, "height", H(s)), Y(Me, "x", f.left), Y(Me, "y", f.top), Y(Me, "width", e), Y(Me, "height", H(m)), Y(Fe, "x", f.left + 4), Y(Fe, "y", H(c) + 12), Y(Le, "x", f.left), Y(Le, "y", H(l)), Y(Le, "width", n), Y(Le, "height", H(u));
	}, [() => Math.max(0, t.width - f.left - f.right), () => Math.max(0, t.width - f.left - f.right)]), Or("pointerleave", ke, () => t.onHoverCall(null)), G(e, ke), Ve(Oe);
}
kr(["click", "keydown"]);
//#endregion
//#region src/lib/context-river/EconomicsBreakdown.svelte
var rh = /* @__PURE__ */ W("<button type=\"button\" class=\"svelte-51gj1f\">Compaction details</button>"), ih = /* @__PURE__ */ W("<li class=\"svelte-51gj1f\"><span class=\"event-list-label svelte-51gj1f\"><!> </span> <span class=\"event-actions svelte-51gj1f\"><!> <button type=\"button\" class=\"svelte-51gj1f\"> </button></span></li>"), ah = /* @__PURE__ */ W("<div class=\"event-breakdown svelte-51gj1f\" role=\"dialog\" tabindex=\"-1\" aria-label=\"Economics event breakdown\"><div class=\"event-breakdown-header svelte-51gj1f\"><strong> </strong> <button type=\"button\" aria-label=\"Close event breakdown\" class=\"svelte-51gj1f\">×</button></div> <button type=\"button\" class=\"zoom-events-button\">Zoom to these calls</button> <ul class=\"svelte-51gj1f\"></ul></div>"), oh = {
	hash: "svelte-51gj1f",
	code: ".event-breakdown.svelte-51gj1f {position:fixed;z-index:6;width:min(300px, calc(100vw - 16px));max-height:min(220px, calc(100vh - 16px));overflow:auto;padding:8px;color:var(--text);background:var(--surface);border:1px solid var(--control-border);border-radius:var(--control-radius);box-shadow:0 8px 24px var(--shadow);}.event-breakdown-header.svelte-51gj1f,\n  li.svelte-51gj1f {display:flex;align-items:start;justify-content:space-between;gap:8px;}.event-breakdown-header.svelte-51gj1f {color:var(--text-strong);font-size:var(--text-sm);}.event-breakdown-header.svelte-51gj1f button:where(.svelte-51gj1f) {padding:1px 6px;font-size:var(--text-lg);line-height:1.1;}ul.svelte-51gj1f {display:grid;gap:7px;margin:7px 0 0;padding:0;list-style:none;font-size:var(--text-xs);}li.svelte-51gj1f > span:where(.svelte-51gj1f) {min-width:0;overflow-wrap:anywhere;}.event-list-label.svelte-51gj1f {display:inline-flex;align-items:center;gap:4px;}li.svelte-51gj1f button:where(.svelte-51gj1f) {flex:0 0 auto;padding:3px 6px;font-size:10px;white-space:nowrap;}\n  @container highwater (max-width: 620px) {.event-breakdown.svelte-51gj1f {position:static;width:100%;max-height:180px;margin:8px 0 0;}\n  }.event-actions.svelte-51gj1f {display:flex;flex-wrap:wrap;justify-content:flex-end;gap:4px;}"
};
function sh(e, t) {
	Be(t, !0), ui(e, oh);
	let n = X(t, "element", 15, null), r = X(t, "positionStyle", 3, ""), i = X(t, "onInspectCompaction", 3, () => {});
	function a(e) {
		e.key === "Escape" && (e.preventDefault(), e.stopPropagation(), t.onClose());
	}
	var o = ah(), s = L(o), c = L(s), l = z(c), u = B(c, 2);
	N(s);
	var d = B(s, 2), f = B(d, 2);
	J(f, 21, () => t.breakdown.events, (e) => e.id, (e, n) => {
		var r = ih(), a = L(r), o = L(a);
		jm(o, {
			get kind() {
				return H(n).kind;
			},
			get direction() {
				return H(n).direction;
			},
			size: 18
		});
		var s = B(o);
		N(a);
		var c = B(a, 2), l = L(c), u = (e) => {
			var t = rh();
			U("click", t, () => i()(H(n).callIndex)), G(e, t);
		};
		q(l, (e) => {
			H(n).kind === "compaction" && e(u);
		});
		var d = B(l, 2), f = z(d);
		N(c), N(r), V(() => {
			K(s, `${H(n).label ?? ""} · call
          ${H(n).callIndex ?? ""}`), K(f, `Inspect call ${H(n).callIndex ?? ""}`);
		}), U("click", d, () => t.onInspect(H(n).callIndex)), G(e, r);
	}), N(f), N(o), Ri(o, (e) => n(e), () => n()), V((e) => {
		yi(o, r()), K(l, `${t.breakdown.events.length ?? ""}
      ${t.breakdown.events.length === 1 ? "event" : "events"} · calls ${e ?? ""}`), Y(u, "id", `${t.breakdown.id}-close`), d.disabled = !t.canZoomIn || t.breakdown.callIndices.length === 0;
	}, [() => t.breakdown.callIndices.join(", ")]), U("keydown", o, a), U("click", u, function(...e) {
		t.onClose?.apply(this, e);
	}), U("click", d, function(...e) {
		t.onZoom?.apply(this, e);
	}), G(e, o), Ve();
}
kr(["keydown", "click"]);
//#endregion
//#region src/lib/context-river/GroupBreakdown.svelte
var ch = /* @__PURE__ */ W("<li> </li>"), lh = /* @__PURE__ */ W("<p class=\"svelte-17hzezc\">Showing the first 12 members.</p>"), uh = /* @__PURE__ */ W("<div class=\"group-breakdown svelte-17hzezc\" role=\"dialog\" tabindex=\"-1\"><div class=\"event-breakdown-header svelte-17hzezc\"><strong> </strong> <button id=\"group-breakdown-close\" type=\"button\" aria-label=\"Close item type breakdown\" class=\"svelte-17hzezc\">×</button></div> <p class=\"svelte-17hzezc\"> </p> <ul class=\"svelte-17hzezc\"></ul> <!> <button type=\"button\">Show items here</button></div>"), dh = {
	hash: "svelte-17hzezc",
	code: ".group-breakdown.svelte-17hzezc {position:fixed;box-sizing:border-box;z-index:6;width:min(340px, calc(100vw - 16px));max-height:min(220px, calc(100vh - 16px));overflow:auto;padding:9px;color:var(--text);background:var(--surface);border:1px solid var(--control-border);border-radius:var(--control-radius);box-shadow:0 8px 24px var(--shadow);}.event-breakdown-header.svelte-17hzezc {display:flex;align-items:start;justify-content:space-between;gap:8px;color:var(--text-strong);font-size:var(--text-sm);}.event-breakdown-header.svelte-17hzezc button:where(.svelte-17hzezc) {padding:1px 6px;font-size:var(--text-lg);line-height:1.1;}p.svelte-17hzezc {margin:7px 0;color:var(--text);font-size:var(--text-xs);}ul.svelte-17hzezc {max-height:150px;overflow:auto;margin:7px 0;padding-left:18px;color:var(--text);font-size:var(--text-xs);}"
};
function fh(e, t) {
	Be(t, !0), ui(e, dh);
	let n, r = /* @__PURE__ */ F(340), i = /* @__PURE__ */ F(220), a = /* @__PURE__ */ F(1280), o = /* @__PURE__ */ F(800), s = /* @__PURE__ */ P(() => Math.max(8, Math.min(t.anchor.x + 8, H(a) - H(r) - 8))), c = /* @__PURE__ */ P(() => Math.max(8, Math.min(t.anchor.y + 8, H(o) - H(i) - 8)));
	Bi(() => {
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
	var u = uh();
	let d;
	var f = L(u), p = L(f), m = z(p), h = B(p, 2);
	N(f);
	var g = B(f, 2), _ = z(g), v = B(g, 2);
	J(v, 21, () => t.memberLabels, ei, (e, t, n, r) => {
		var i = ch(), a = z(i, !0);
		V(() => K(a, H(t))), G(e, i);
	}), N(v);
	var y = B(v, 2), b = (e) => {
		G(e, lh());
	};
	q(y, (e) => {
		t.memberCount > 12 && e(b);
	});
	var x = B(y, 2);
	N(u), Ri(u, (e) => n = e, () => n), V(() => {
		Y(u, "aria-label", `Item type ${t.label} breakdown`), d = yi(u, "", d, {
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
function ph(e) {
	return e.querySelector(".economics-track-svg");
}
function mh(e, t) {
	let n = ph(e);
	if (!n) return null;
	let r = n.getBoundingClientRect(), i = Number(n.getAttribute("width")) || n.viewBox.baseVal.width, a = i > 0 ? r.width / i : 1, o = n.viewBox.baseVal.height > 0 ? r.height / n.viewBox.baseVal.height : 1;
	return {
		x: r.left + t.anchorX * a,
		y: r.top + t.anchorY * o
	};
}
function hh(e, t) {
	let n = mh(e, t);
	if (!n) return !1;
	let r = e.getBoundingClientRect(), i = e.parentElement?.getBoundingClientRect(), a = Math.max(0, r.left, i?.left ?? -Infinity), o = Math.min(window.innerWidth, r.right, i?.right ?? Infinity), s = Math.max(0, r.top, i?.top ?? -Infinity), c = Math.min(window.innerHeight, r.bottom, i?.bottom ?? Infinity);
	return o >= a && c >= s && n.x >= a && n.x <= o && n.y >= s && n.y <= c;
}
function gh(e, t, n) {
	if (!n || !t || window.innerWidth <= 620) return "";
	let r = mh(e, n), i = ph(e);
	if (!r || !i) return "";
	let a = i.getBoundingClientRect(), o = t.getBoundingClientRect(), s = e.getBoundingClientRect(), c = Math.min(300, Math.max(120, o.width || 300)), l = o.height || 160, u = Math.max(8, s.left + 8), d = Math.max(u, Math.min(window.innerWidth - c - 8, s.right - c - 8)), f = Math.max(u, Math.min(d, r.x - c / 2)), p = i.viewBox.baseVal.height > 0 ? a.height / i.viewBox.baseVal.height : 1, m = a.top + n.laneTop * p, h = a.top + (n.laneTop + n.laneHeight) * p + 8, g = m - l - 8;
	return `left:${f}px;top:${h + l <= window.innerHeight - 8 ? h : g >= 8 ? g : Math.max(8, Math.min(window.innerHeight - l - 8, h))}px;width:${c}px`;
}
//#endregion
//#region src/lib/context-river/EconomicsControls.svelte
var _h = /* @__PURE__ */ W("<div class=\"toggle-group cache-view-toggle\" role=\"group\" aria-label=\"Cache view\"><span class=\"toggle-label\">Cache view</span> <button type=\"button\">Tokens</button> <button type=\"button\">Share (%)</button><!></div>"), vh = /* @__PURE__ */ W("<div class=\"economics-track-controls svelte-1x8cxwu\"><div class=\"toggle-group\" role=\"group\" aria-label=\"Economics track\"><span class=\"toggle-label\">Economics</span> <button type=\"button\">Cache</button> <button type=\"button\">Cost</button> <button type=\"button\">Off</button></div> <!> <span class=\"track-title svelte-1x8cxwu\"> </span></div>"), yh = /* @__PURE__ */ W("<span class=\"svelte-1x8cxwu\"><i></i> </span>"), bh = /* @__PURE__ */ W("<span class=\"legend-muted svelte-1x8cxwu\">No supported numeric cache categories</span>"), xh = /* @__PURE__ */ W("<span class=\"inline-availability svelte-1x8cxwu\"> </span>"), Sh = /* @__PURE__ */ W("<div class=\"track-legend-group svelte-1x8cxwu\" aria-label=\"Token categories\"><span class=\"legend-group-title svelte-1x8cxwu\">Token categories</span> <div class=\"track-legend svelte-1x8cxwu\"></div></div> <!>", 1), Ch = /* @__PURE__ */ W("<span class=\"svelte-1x8cxwu\"><i class=\"swatch api-equivalent svelte-1x8cxwu\"></i>API-equivalent (subscription) · USD</span>"), wh = /* @__PURE__ */ W("<div class=\"track-legend-group svelte-1x8cxwu\" aria-label=\"Cost values\"><span class=\"legend-group-title svelte-1x8cxwu\">Cost values</span> <div class=\"track-legend svelte-1x8cxwu\"><span class=\"svelte-1x8cxwu\"><i class=\"swatch cost svelte-1x8cxwu\"></i>Billed · USD</span> <!></div></div>"), Th = /* @__PURE__ */ W("<span class=\"svelte-1x8cxwu\"><!>Share rise/drop</span>"), Eh = /* @__PURE__ */ W("<p class=\"availability-summary svelte-1x8cxwu\"> </p>"), Dh = /* @__PURE__ */ W("<div class=\"track-legend-groups essential-legend svelte-1x8cxwu\"><!></div> <details class=\"economics-legend svelte-1x8cxwu\"><summary class=\"disclosure svelte-1x8cxwu\">Key</summary> <div class=\"track-legend-group svelte-1x8cxwu\" aria-label=\"Events\"><span class=\"legend-group-title svelte-1x8cxwu\">Events</span> <div class=\"track-legend svelte-1x8cxwu\"><!> <span class=\"svelte-1x8cxwu\"><!>Compaction</span> <span class=\"svelte-1x8cxwu\"><!>Model / provider change</span></div></div> <div class=\"track-legend-group svelte-1x8cxwu\" aria-label=\"Data quality\"><span class=\"legend-group-title svelte-1x8cxwu\">Data quality</span> <div class=\"track-legend svelte-1x8cxwu\"><span class=\"svelte-1x8cxwu\"><i class=\"swatch uncertain svelte-1x8cxwu\"></i>Partial / unsupported</span> <span class=\"svelte-1x8cxwu\"><i class=\"swatch missing svelte-1x8cxwu\"></i>Missing</span> <span class=\"svelte-1x8cxwu\"><i class=\"swatch zero svelte-1x8cxwu\"></i>Measured zero</span></div></div> <!></details>", 1), Oh = /* @__PURE__ */ W("<div class=\"economics-track-header svelte-1x8cxwu\" role=\"group\" aria-label=\"Economics track controls and legend\"><button class=\"economics-disclosure disclosure svelte-1x8cxwu\" type=\"button\" aria-controls=\"economics-expanded\"><span>Cache &amp; cost</span></button> <div id=\"economics-expanded\"><!> <!></div></div>"), kh = {
	hash: "svelte-1x8cxwu",
	code: ".economics-disclosure.svelte-1x8cxwu {justify-self:start;display:inline-flex;align-items:center;gap:6px;min-height:28px;padding:4px 0;border:0;border-radius:0;background:transparent;color:var(--secondary);font:inherit;font-size:var(--text-md);}.economics-disclosure.svelte-1x8cxwu:hover {background:transparent;color:var(--text);}.economics-track-header.svelte-1x8cxwu {position:sticky;left:0;z-index:3;display:grid;width:100%;gap:6px;margin:0 0 8px;padding:8px 0;border:0;border-top:1px solid var(--separator);border-radius:0;background:var(--surface);}.economics-track-controls.svelte-1x8cxwu {display:flex;flex-wrap:wrap;align-items:center;gap:7px 14px;color:var(--text);font-size:var(--text-sm);}.economics-legend.svelte-1x8cxwu {min-width:0;color:var(--text);font-size:var(--text-xs);}.economics-legend[open].svelte-1x8cxwu {padding-top:2px;}.economics-legend.svelte-1x8cxwu summary:where(.svelte-1x8cxwu) {width:fit-content;color:var(--secondary);cursor:pointer;}\n  /* Matches the River's legend: 12px text, with each group's title leading its items. */.track-legend-groups.svelte-1x8cxwu {display:flex;flex-wrap:wrap;align-items:start;gap:8px 18px;padding-top:6px;color:var(--text);font-size:var(--text-sm);}.essential-legend.svelte-1x8cxwu {padding:2px 0 0;}.legend-muted.svelte-1x8cxwu,\n  .availability-summary.svelte-1x8cxwu {color:var(--secondary);}.inline-availability.svelte-1x8cxwu {align-self:center;max-width:38rem;color:var(--warning);line-height:1.35;}.availability-summary.svelte-1x8cxwu {margin:6px 0;line-height:1.4;}.track-title.svelte-1x8cxwu {min-width:0;color:var(--text);font-weight:650;overflow-wrap:anywhere;}.track-legend-group.svelte-1x8cxwu {display:flex;flex-wrap:wrap;align-items:center;gap:5px 12px;min-width:0;}.legend-group-title.svelte-1x8cxwu {color:var(--text-strong);font-weight:650;}.track-legend.svelte-1x8cxwu {display:flex;flex-wrap:wrap;gap:5px 12px;align-items:center;}.track-legend.svelte-1x8cxwu span:where(.svelte-1x8cxwu) {display:inline-flex;align-items:center;gap:4px;max-width:100%;overflow-wrap:anywhere;}.swatch.svelte-1x8cxwu {display:inline-block;width:10px;height:10px;border:1px solid var(--text);border-radius:var(--radius-small);flex:0 0 auto;}.swatch.read.svelte-1x8cxwu,\n  .swatch.cacheRead.svelte-1x8cxwu {background:var(--cache-read);}.swatch.write.svelte-1x8cxwu,\n  .swatch.cacheWrite.svelte-1x8cxwu {background:repeating-linear-gradient(\n      135deg,\n      var(--cache-write) 0 3px,\n      var(--cache-write-mark) 3px 4px\n    );}.swatch.fresh.svelte-1x8cxwu {background:radial-gradient(circle, var(--cache-fresh-mark) 1px, var(--cache-fresh) 1.5px);}.swatch.nonread.svelte-1x8cxwu,\n  .swatch.nonRead.svelte-1x8cxwu {background:repeating-linear-gradient(\n      135deg,\n      var(--cache-nonread) 0 3px,\n      var(--cache-nonread-mark) 3px 4px\n    );}.swatch.uncached.svelte-1x8cxwu {background:radial-gradient(circle, var(--cache-fresh-mark) 1px, var(--cache-fresh) 1.5px);}.swatch.uncertain.svelte-1x8cxwu {background:transparent;border-color:var(--warning);transform:rotate(45deg) scale(0.78);}.swatch.change-rise.svelte-1x8cxwu,\n  .swatch.change-drop.svelte-1x8cxwu {display:inline-flex;align-items:center;justify-content:center;width:14px;border:0;color:var(--event-warning-text);background:var(--event-warning);font-size:10px;font-style:normal;font-weight:800;line-height:1;}.swatch.change-drop.svelte-1x8cxwu {margin-left:-4px;}.swatch.compaction.svelte-1x8cxwu,\n  .swatch.target.svelte-1x8cxwu {display:inline-flex;width:16px;justify-content:center;border-color:var(--accent);background:var(--action);color:var(--active-text);font-size:7px;font-style:normal;font-weight:750;}.swatch.target.svelte-1x8cxwu {border-radius:0;transform:rotate(45deg) scale(0.8);}.swatch.missing.svelte-1x8cxwu {background:transparent;border-style:dashed;}.swatch.zero.svelte-1x8cxwu {border-radius:50%;background:transparent;}.swatch.cost.svelte-1x8cxwu {border-radius:50%;background:var(--cost);}.swatch.api-equivalent.svelte-1x8cxwu {border-radius:50%;background:transparent;border-color:var(--api-cost);}\n  @container highwater (max-width: 620px) {.economics-track-controls.svelte-1x8cxwu {align-items:start;}.track-legend.svelte-1x8cxwu {gap:5px 9px;}\n  }"
};
function Ah(e, t) {
	Be(t, !0), ui(e, kh);
	let n = X(t, "hasApiEquivalentCost", 3, !1), r = X(t, "headerElement", 15), i = X(t, "triggerElement", 15);
	var a = Oh(), o = L(a);
	Ri(o, (e) => i(e), () => i());
	var s = B(o, 2), c = L(s), l = (e) => {
		var n = vh(), r = L(n), i = B(L(r), 2), a = B(i, 2), o = B(a, 2);
		Y(o, "aria-pressed", !1), N(r);
		var s = B(r, 2), c = (e) => {
			var n = _h(), r = B(L(n), 2), i = B(r, 2);
			va(B(i), {
				id: "cache-share-note",
				label: "About Share (%)",
				children: (e, t) => {
					be(), G(e, zr("Shows cache reads, cache writes and fresh input as shares of each call's input\n              tokens. Calls with missing, partial or zero input are marked, not drawn as zero."));
				},
				$$slots: { default: !0 }
			}), N(n), V(() => {
				Y(r, "aria-pressed", t.cacheView === "tokens"), Y(i, "aria-pressed", t.cacheView === "share");
			}), U("click", r, () => t.onCacheViewChange("tokens")), U("click", i, () => t.onCacheViewChange("share")), G(e, n);
		};
		q(s, (e) => {
			t.mode === "cache" && e(c);
		});
		var l = z(B(s, 2), !0);
		N(n), V(() => {
			Y(i, "aria-pressed", t.mode === "cache"), Y(a, "aria-pressed", t.mode === "cost"), K(l, t.mode === "cache" ? t.cacheView === "share" ? "Cache share per call · share of each call's input · fixed 0–100% axis" : "Prompt tokens per call · session-wide scale" : t.mode === "cost" ? "Cost per call · USD · session-wide scale · recorded or estimated, not invoices" : "Economics off · details remain available in the inspector");
		}), U("click", i, () => t.onModeChange("cache")), U("click", a, () => t.onModeChange("cost")), U("click", o, () => t.onModeChange("off")), G(e, n);
	};
	q(c, (e) => {
		t.mode !== "off" && e(l);
	});
	var u = B(c, 2), d = (e) => {
		var r = Dh(), i = R(r), a = L(i), o = (e) => {
			var n = Sh(), r = R(n), i = B(L(r), 2);
			J(i, 21, () => t.cachePresentation.categories, (e) => e.kind, (e, t) => {
				var n = yh(), r = L(n), i = B(r);
				N(n), V(() => {
					_i(r, 1, `swatch ${H(t).kind}`, "svelte-1x8cxwu"), K(i, `${H(t).label ?? ""}${H(t).availability === "measuredZero" ? " · 0 in this session" : ""}`);
				}), G(e, n);
			}, (e) => {
				G(e, bh());
			}), N(i), N(r), J(B(r, 2), 17, () => t.cachePresentation.notes, ei, (e, t) => {
				var n = xh(), r = z(n, !0);
				V(() => K(r, H(t))), G(e, n);
			}), G(e, n);
		}, s = (e) => {
			var t = wh(), r = B(L(t), 2), i = B(L(r), 2), a = (e) => {
				G(e, Ch());
			};
			q(i, (e) => {
				n() && e(a);
			}), N(r), N(t), G(e, t);
		};
		q(a, (e) => {
			t.mode === "cache" ? e(o) : e(s, -1);
		}), N(i);
		var c = B(i, 2), l = B(L(c), 2), u = B(L(l), 2), d = L(u), f = (e) => {
			var t = Th();
			jm(L(t), {
				kind: "ratioChange",
				direction: "rise",
				size: 16
			}), be(), N(t), G(e, t);
		};
		q(d, (e) => {
			t.mode === "cache" && e(f);
		});
		var p = B(d, 2);
		jm(L(p), {
			kind: "compaction",
			size: 16
		}), be(), N(p);
		var m = B(p, 2);
		jm(L(m), {
			kind: "targetChange",
			size: 16
		}), be(), N(m), N(u), N(l);
		var h = B(l, 4), g = (e) => {
			var n = Eh(), r = z(n);
			V(() => K(r, `Billed calls show the cost the harness recorded, or an estimate at the provider's rate
            when it recorded none. Subscription calls show what they would have cost at the lab's
            API rate; that is not a charge. A shaded bar marks a range. ${t.costCopy.note ?? ""}
            Unavailable values are not zero.`)), G(e, n);
		};
		q(h, (e) => {
			t.mode === "cost" && e(g);
		}), N(c), G(e, r);
	};
	q(u, (e) => {
		t.mode !== "off" && e(d);
	}), N(s), N(a), Ri(a, (e) => r(e), () => r()), V(() => {
		Y(o, "aria-expanded", t.mode !== "off"), Y(s, "hidden", t.mode === "off");
	}), U("pointerdown", a, (e) => e.stopPropagation()), U("click", a, (e) => e.stopPropagation()), U("click", o, () => t.onModeChange(t.mode === "off" ? t.lastMode : "off")), G(e, a), Ve();
}
kr(["pointerdown", "click"]);
//#endregion
//#region src/lib/context-river/hit-testing.ts
function jh(e, t) {
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
function Mh(e, t, n, r) {
	return n <= 0 ? 0 : (e - t) / n * r;
}
//#endregion
//#region src/lib/context-river/axis-labels.ts
function Nh(e) {
	return String(e).length * 7;
}
function Ph(e, t) {
	return (Nh(e.callIndex) + Nh(t.callIndex)) / 2 + 8;
}
function Fh(e, t) {
	return Math.abs(e.x - t.x) < Ph(e, t);
}
function Ih(e, t, n) {
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
			return r !== void 0 && !Fh(n, r);
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
		r && Fh(n, r) || i && Fh(n, i) || (f.add(t), p = t);
	}
	return f;
}
//#endregion
//#region node_modules/d3-scale/src/init.js
function Lh(e, t) {
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
function Rh(e, t, n) {
	e.prototype = t.prototype = n, n.constructor = e;
}
function zh(e, t) {
	var n = Object.create(e.prototype);
	for (var r in t) n[r] = t[r];
	return n;
}
//#endregion
//#region node_modules/d3-color/src/color.js
function Bh() {}
var Vh = .7, Hh = 1 / Vh, Uh = "\\s*([+-]?\\d+)\\s*", Wh = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*", Gh = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*", Kh = /^#([0-9a-f]{3,8})$/, qh = RegExp(`^rgb\\(${Uh},${Uh},${Uh}\\)$`), Jh = RegExp(`^rgb\\(${Gh},${Gh},${Gh}\\)$`), Yh = RegExp(`^rgba\\(${Uh},${Uh},${Uh},${Wh}\\)$`), Xh = RegExp(`^rgba\\(${Gh},${Gh},${Gh},${Wh}\\)$`), Zh = RegExp(`^hsl\\(${Wh},${Gh},${Gh}\\)$`), Qh = RegExp(`^hsla\\(${Wh},${Gh},${Gh},${Wh}\\)$`), $h = {
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
Rh(Bh, ig, {
	copy(e) {
		return Object.assign(new this.constructor(), this, e);
	},
	displayable() {
		return this.rgb().displayable();
	},
	hex: eg,
	formatHex: eg,
	formatHex8: tg,
	formatHsl: ng,
	formatRgb: rg,
	toString: rg
});
function eg() {
	return this.rgb().formatHex();
}
function tg() {
	return this.rgb().formatHex8();
}
function ng() {
	return _g(this).formatHsl();
}
function rg() {
	return this.rgb().formatRgb();
}
function ig(e) {
	var t, n;
	return e = (e + "").trim().toLowerCase(), (t = Kh.exec(e)) ? (n = t[1].length, t = parseInt(t[1], 16), n === 6 ? ag(t) : n === 3 ? new lg(t >> 8 & 15 | t >> 4 & 240, t >> 4 & 15 | t & 240, (t & 15) << 4 | t & 15, 1) : n === 8 ? og(t >> 24 & 255, t >> 16 & 255, t >> 8 & 255, (t & 255) / 255) : n === 4 ? og(t >> 12 & 15 | t >> 8 & 240, t >> 8 & 15 | t >> 4 & 240, t >> 4 & 15 | t & 240, ((t & 15) << 4 | t & 15) / 255) : null) : (t = qh.exec(e)) ? new lg(t[1], t[2], t[3], 1) : (t = Jh.exec(e)) ? new lg(t[1] * 255 / 100, t[2] * 255 / 100, t[3] * 255 / 100, 1) : (t = Yh.exec(e)) ? og(t[1], t[2], t[3], t[4]) : (t = Xh.exec(e)) ? og(t[1] * 255 / 100, t[2] * 255 / 100, t[3] * 255 / 100, t[4]) : (t = Zh.exec(e)) ? gg(t[1], t[2] / 100, t[3] / 100, 1) : (t = Qh.exec(e)) ? gg(t[1], t[2] / 100, t[3] / 100, t[4]) : $h.hasOwnProperty(e) ? ag($h[e]) : e === "transparent" ? new lg(NaN, NaN, NaN, 0) : null;
}
function ag(e) {
	return new lg(e >> 16 & 255, e >> 8 & 255, e & 255, 1);
}
function og(e, t, n, r) {
	return r <= 0 && (e = t = n = NaN), new lg(e, t, n, r);
}
function sg(e) {
	return e instanceof Bh || (e = ig(e)), e ? (e = e.rgb(), new lg(e.r, e.g, e.b, e.opacity)) : new lg();
}
function cg(e, t, n, r) {
	return arguments.length === 1 ? sg(e) : new lg(e, t, n, r ?? 1);
}
function lg(e, t, n, r) {
	this.r = +e, this.g = +t, this.b = +n, this.opacity = +r;
}
Rh(lg, cg, zh(Bh, {
	brighter(e) {
		return e = e == null ? Hh : Hh ** +e, new lg(this.r * e, this.g * e, this.b * e, this.opacity);
	},
	darker(e) {
		return e = e == null ? Vh : Vh ** +e, new lg(this.r * e, this.g * e, this.b * e, this.opacity);
	},
	rgb() {
		return this;
	},
	clamp() {
		return new lg(mg(this.r), mg(this.g), mg(this.b), pg(this.opacity));
	},
	displayable() {
		return -.5 <= this.r && this.r < 255.5 && -.5 <= this.g && this.g < 255.5 && -.5 <= this.b && this.b < 255.5 && 0 <= this.opacity && this.opacity <= 1;
	},
	hex: ug,
	formatHex: ug,
	formatHex8: dg,
	formatRgb: fg,
	toString: fg
}));
function ug() {
	return `#${hg(this.r)}${hg(this.g)}${hg(this.b)}`;
}
function dg() {
	return `#${hg(this.r)}${hg(this.g)}${hg(this.b)}${hg((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
}
function fg() {
	let e = pg(this.opacity);
	return `${e === 1 ? "rgb(" : "rgba("}${mg(this.r)}, ${mg(this.g)}, ${mg(this.b)}${e === 1 ? ")" : `, ${e})`}`;
}
function pg(e) {
	return isNaN(e) ? 1 : Math.max(0, Math.min(1, e));
}
function mg(e) {
	return Math.max(0, Math.min(255, Math.round(e) || 0));
}
function hg(e) {
	return e = mg(e), (e < 16 ? "0" : "") + e.toString(16);
}
function gg(e, t, n, r) {
	return r <= 0 ? e = t = n = NaN : n <= 0 || n >= 1 ? e = t = NaN : t <= 0 && (e = NaN), new yg(e, t, n, r);
}
function _g(e) {
	if (e instanceof yg) return new yg(e.h, e.s, e.l, e.opacity);
	if (e instanceof Bh || (e = ig(e)), !e) return new yg();
	if (e instanceof yg) return e;
	e = e.rgb();
	var t = e.r / 255, n = e.g / 255, r = e.b / 255, i = Math.min(t, n, r), a = Math.max(t, n, r), o = NaN, s = a - i, c = (a + i) / 2;
	return s ? (o = t === a ? (n - r) / s + (n < r) * 6 : n === a ? (r - t) / s + 2 : (t - n) / s + 4, s /= c < .5 ? a + i : 2 - a - i, o *= 60) : s = c > 0 && c < 1 ? 0 : o, new yg(o, s, c, e.opacity);
}
function vg(e, t, n, r) {
	return arguments.length === 1 ? _g(e) : new yg(e, t, n, r ?? 1);
}
function yg(e, t, n, r) {
	this.h = +e, this.s = +t, this.l = +n, this.opacity = +r;
}
Rh(yg, vg, zh(Bh, {
	brighter(e) {
		return e = e == null ? Hh : Hh ** +e, new yg(this.h, this.s, this.l * e, this.opacity);
	},
	darker(e) {
		return e = e == null ? Vh : Vh ** +e, new yg(this.h, this.s, this.l * e, this.opacity);
	},
	rgb() {
		var e = this.h % 360 + (this.h < 0) * 360, t = isNaN(e) || isNaN(this.s) ? 0 : this.s, n = this.l, r = n + (n < .5 ? n : 1 - n) * t, i = 2 * n - r;
		return new lg(Sg(e >= 240 ? e - 240 : e + 120, i, r), Sg(e, i, r), Sg(e < 120 ? e + 240 : e - 120, i, r), this.opacity);
	},
	clamp() {
		return new yg(bg(this.h), xg(this.s), xg(this.l), pg(this.opacity));
	},
	displayable() {
		return (0 <= this.s && this.s <= 1 || isNaN(this.s)) && 0 <= this.l && this.l <= 1 && 0 <= this.opacity && this.opacity <= 1;
	},
	formatHsl() {
		let e = pg(this.opacity);
		return `${e === 1 ? "hsl(" : "hsla("}${bg(this.h)}, ${xg(this.s) * 100}%, ${xg(this.l) * 100}%${e === 1 ? ")" : `, ${e})`}`;
	}
}));
function bg(e) {
	return e = (e || 0) % 360, e < 0 ? e + 360 : e;
}
function xg(e) {
	return Math.max(0, Math.min(1, e || 0));
}
function Sg(e, t, n) {
	return (e < 60 ? t + (n - t) * e / 60 : e < 180 ? n : e < 240 ? t + (n - t) * (240 - e) / 60 : t) * 255;
}
//#endregion
//#region node_modules/d3-interpolate/src/constant.js
var Cg = (e) => () => e;
//#endregion
//#region node_modules/d3-interpolate/src/color.js
function wg(e, t) {
	return function(n) {
		return e + n * t;
	};
}
function Tg(e, t, n) {
	return e **= +n, t = t ** +n - e, n = 1 / n, function(r) {
		return (e + r * t) ** +n;
	};
}
function Eg(e) {
	return (e = +e) == 1 ? Dg : function(t, n) {
		return n - t ? Tg(t, n, e) : Cg(isNaN(t) ? n : t);
	};
}
function Dg(e, t) {
	var n = t - e;
	return n ? wg(e, n) : Cg(isNaN(e) ? t : e);
}
//#endregion
//#region node_modules/d3-interpolate/src/rgb.js
var Og = (function e(t) {
	var n = Eg(t);
	function r(e, t) {
		var r = n((e = cg(e)).r, (t = cg(t)).r), i = n(e.g, t.g), a = n(e.b, t.b), o = Dg(e.opacity, t.opacity);
		return function(t) {
			return e.r = r(t), e.g = i(t), e.b = a(t), e.opacity = o(t), e + "";
		};
	}
	return r.gamma = e, r;
})(1);
//#endregion
//#region node_modules/d3-interpolate/src/numberArray.js
function kg(e, t) {
	t ||= [];
	var n = e ? Math.min(t.length, e.length) : 0, r = t.slice(), i;
	return function(a) {
		for (i = 0; i < n; ++i) r[i] = e[i] * (1 - a) + t[i] * a;
		return r;
	};
}
function Ag(e) {
	return ArrayBuffer.isView(e) && !(e instanceof DataView);
}
//#endregion
//#region node_modules/d3-interpolate/src/array.js
function jg(e, t) {
	for (var n = t ? t.length : 0, r = e ? Math.min(n, e.length) : 0, i = Array(r), a = Array(n), o = 0; o < r; ++o) i[o] = Bg(e[o], t[o]);
	for (; o < n; ++o) a[o] = t[o];
	return function(e) {
		for (o = 0; o < r; ++o) a[o] = i[o](e);
		return a;
	};
}
//#endregion
//#region node_modules/d3-interpolate/src/date.js
function Mg(e, t) {
	var n = /* @__PURE__ */ new Date();
	return e = +e, t = +t, function(r) {
		return n.setTime(e * (1 - r) + t * r), n;
	};
}
//#endregion
//#region node_modules/d3-interpolate/src/number.js
function Ng(e, t) {
	return e = +e, t = +t, function(n) {
		return e * (1 - n) + t * n;
	};
}
//#endregion
//#region node_modules/d3-interpolate/src/object.js
function Pg(e, t) {
	var n = {}, r = {}, i;
	for (i in (typeof e != "object" || !e) && (e = {}), (typeof t != "object" || !t) && (t = {}), t) i in e ? n[i] = Bg(e[i], t[i]) : r[i] = t[i];
	return function(e) {
		for (i in n) r[i] = n[i](e);
		return r;
	};
}
//#endregion
//#region node_modules/d3-interpolate/src/string.js
var Fg = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g, Ig = new RegExp(Fg.source, "g");
function Lg(e) {
	return function() {
		return e;
	};
}
function Rg(e) {
	return function(t) {
		return e(t) + "";
	};
}
function zg(e, t) {
	var n = Fg.lastIndex = Ig.lastIndex = 0, r, i, a, o = -1, s = [], c = [];
	for (e += "", t += ""; (r = Fg.exec(e)) && (i = Ig.exec(t));) (a = i.index) > n && (a = t.slice(n, a), s[o] ? s[o] += a : s[++o] = a), (r = r[0]) === (i = i[0]) ? s[o] ? s[o] += i : s[++o] = i : (s[++o] = null, c.push({
		i: o,
		x: Ng(r, i)
	})), n = Ig.lastIndex;
	return n < t.length && (a = t.slice(n), s[o] ? s[o] += a : s[++o] = a), s.length < 2 ? c[0] ? Rg(c[0].x) : Lg(t) : (t = c.length, function(e) {
		for (var n = 0, r; n < t; ++n) s[(r = c[n]).i] = r.x(e);
		return s.join("");
	});
}
//#endregion
//#region node_modules/d3-interpolate/src/value.js
function Bg(e, t) {
	var n = typeof t, r;
	return t == null || n === "boolean" ? Cg(t) : (n === "number" ? Ng : n === "string" ? (r = ig(t)) ? (t = r, Og) : zg : t instanceof ig ? Og : t instanceof Date ? Mg : Ag(t) ? kg : Array.isArray(t) ? jg : typeof t.valueOf != "function" && typeof t.toString != "function" || isNaN(t) ? Pg : Ng)(e, t);
}
//#endregion
//#region node_modules/d3-interpolate/src/round.js
function Vg(e, t) {
	return e = +e, t = +t, function(n) {
		return Math.round(e * (1 - n) + t * n);
	};
}
//#endregion
//#region node_modules/d3-scale/src/constant.js
function Hg(e) {
	return function() {
		return e;
	};
}
//#endregion
//#region node_modules/d3-scale/src/number.js
function Ug(e) {
	return +e;
}
//#endregion
//#region node_modules/d3-scale/src/continuous.js
var Wg = [0, 1];
function Gg(e) {
	return e;
}
function Kg(e, t) {
	return (t -= e = +e) ? function(n) {
		return (n - e) / t;
	} : Hg(isNaN(t) ? NaN : .5);
}
function qg(e, t) {
	var n;
	return e > t && (n = e, e = t, t = n), function(n) {
		return Math.max(e, Math.min(t, n));
	};
}
function Jg(e, t, n) {
	var r = e[0], i = e[1], a = t[0], o = t[1];
	return i < r ? (r = Kg(i, r), a = n(o, a)) : (r = Kg(r, i), a = n(a, o)), function(e) {
		return a(r(e));
	};
}
function Yg(e, t, n) {
	var r = Math.min(e.length, t.length) - 1, i = Array(r), a = Array(r), o = -1;
	for (e[r] < e[0] && (e = e.slice().reverse(), t = t.slice().reverse()); ++o < r;) i[o] = Kg(e[o], e[o + 1]), a[o] = n(t[o], t[o + 1]);
	return function(t) {
		var n = cm(e, t, 1, r) - 1;
		return a[n](i[n](t));
	};
}
function Xg(e, t) {
	return t.domain(e.domain()).range(e.range()).interpolate(e.interpolate()).clamp(e.clamp()).unknown(e.unknown());
}
function Zg() {
	var e = Wg, t = Wg, n = Bg, r, i, a, o = Gg, s, c, l;
	function u() {
		var n = Math.min(e.length, t.length);
		return o !== Gg && (o = qg(e[0], e[n - 1])), s = n > 2 ? Yg : Jg, c = l = null, d;
	}
	function d(i) {
		return i == null || isNaN(i = +i) ? a : (c ||= s(e.map(r), t, n))(r(o(i)));
	}
	return d.invert = function(n) {
		return o(i((l ||= s(t, e.map(r), Ng))(n)));
	}, d.domain = function(t) {
		return arguments.length ? (e = Array.from(t, Ug), u()) : e.slice();
	}, d.range = function(e) {
		return arguments.length ? (t = Array.from(e), u()) : t.slice();
	}, d.rangeRound = function(e) {
		return t = Array.from(e), n = Vg, u();
	}, d.clamp = function(e) {
		return arguments.length ? (o = e ? !0 : Gg, u()) : o !== Gg;
	}, d.interpolate = function(e) {
		return arguments.length ? (n = e, u()) : n;
	}, d.unknown = function(e) {
		return arguments.length ? (a = e, d) : a;
	}, function(e, t) {
		return r = e, i = t, u();
	};
}
function Qg() {
	return Zg()(Gg, Gg);
}
//#endregion
//#region node_modules/d3-format/src/formatDecimal.js
function $g(e) {
	return Math.abs(e = Math.round(e)) >= 1e21 ? e.toLocaleString("en").replace(/,/g, "") : e.toString(10);
}
function e_(e, t) {
	if (!isFinite(e) || e === 0) return null;
	var n = (e = t ? e.toExponential(t - 1) : e.toExponential()).indexOf("e"), r = e.slice(0, n);
	return [r.length > 1 ? r[0] + r.slice(2) : r, +e.slice(n + 1)];
}
//#endregion
//#region node_modules/d3-format/src/exponent.js
function t_(e) {
	return e = e_(Math.abs(e)), e ? e[1] : NaN;
}
//#endregion
//#region node_modules/d3-format/src/formatGroup.js
function n_(e, t) {
	return function(n, r) {
		for (var i = n.length, a = [], o = 0, s = e[0], c = 0; i > 0 && s > 0 && (c + s + 1 > r && (s = Math.max(1, r - c)), a.push(n.substring(i -= s, i + s)), !((c += s + 1) > r));) s = e[o = (o + 1) % e.length];
		return a.reverse().join(t);
	};
}
//#endregion
//#region node_modules/d3-format/src/formatNumerals.js
function r_(e) {
	return function(t) {
		return t.replace(/[0-9]/g, function(t) {
			return e[+t];
		});
	};
}
//#endregion
//#region node_modules/d3-format/src/formatSpecifier.js
var i_ = /^(?:(.)?([<>=^]))?([+\-( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?(~)?([a-z%])?$/i;
function a_(e) {
	if (!(t = i_.exec(e))) throw Error("invalid format: " + e);
	var t;
	return new o_({
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
a_.prototype = o_.prototype;
function o_(e) {
	this.fill = e.fill === void 0 ? " " : e.fill + "", this.align = e.align === void 0 ? ">" : e.align + "", this.sign = e.sign === void 0 ? "-" : e.sign + "", this.symbol = e.symbol === void 0 ? "" : e.symbol + "", this.zero = !!e.zero, this.width = e.width === void 0 ? void 0 : +e.width, this.comma = !!e.comma, this.precision = e.precision === void 0 ? void 0 : +e.precision, this.trim = !!e.trim, this.type = e.type === void 0 ? "" : e.type + "";
}
o_.prototype.toString = function() {
	return this.fill + this.align + this.sign + this.symbol + (this.zero ? "0" : "") + (this.width === void 0 ? "" : Math.max(1, this.width | 0)) + (this.comma ? "," : "") + (this.precision === void 0 ? "" : "." + Math.max(0, this.precision | 0)) + (this.trim ? "~" : "") + this.type;
};
//#endregion
//#region node_modules/d3-format/src/formatTrim.js
function s_(e) {
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
var c_;
function l_(e, t) {
	var n = e_(e, t);
	if (!n) return c_ = void 0, e.toPrecision(t);
	var r = n[0], i = n[1], a = i - (c_ = Math.max(-8, Math.min(8, Math.floor(i / 3))) * 3) + 1, o = r.length;
	return a === o ? r : a > o ? r + Array(a - o + 1).join("0") : a > 0 ? r.slice(0, a) + "." + r.slice(a) : "0." + Array(1 - a).join("0") + e_(e, Math.max(0, t + a - 1))[0];
}
//#endregion
//#region node_modules/d3-format/src/formatRounded.js
function u_(e, t) {
	var n = e_(e, t);
	if (!n) return e + "";
	var r = n[0], i = n[1];
	return i < 0 ? "0." + Array(-i).join("0") + r : r.length > i + 1 ? r.slice(0, i + 1) + "." + r.slice(i + 1) : r + Array(i - r.length + 2).join("0");
}
//#endregion
//#region node_modules/d3-format/src/formatTypes.js
var d_ = {
	"%": (e, t) => (e * 100).toFixed(t),
	b: (e) => Math.round(e).toString(2),
	c: (e) => e + "",
	d: $g,
	e: (e, t) => e.toExponential(t),
	f: (e, t) => e.toFixed(t),
	g: (e, t) => e.toPrecision(t),
	o: (e) => Math.round(e).toString(8),
	p: (e, t) => u_(e * 100, t),
	r: u_,
	s: l_,
	X: (e) => Math.round(e).toString(16).toUpperCase(),
	x: (e) => Math.round(e).toString(16)
};
//#endregion
//#region node_modules/d3-format/src/identity.js
function f_(e) {
	return e;
}
//#endregion
//#region node_modules/d3-format/src/locale.js
var p_ = Array.prototype.map, m_ = [
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
function h_(e) {
	var t = e.grouping === void 0 || e.thousands === void 0 ? f_ : n_(p_.call(e.grouping, Number), e.thousands + ""), n = e.currency === void 0 ? "" : e.currency[0] + "", r = e.currency === void 0 ? "" : e.currency[1] + "", i = e.decimal === void 0 ? "." : e.decimal + "", a = e.numerals === void 0 ? f_ : r_(p_.call(e.numerals, String)), o = e.percent === void 0 ? "%" : e.percent + "", s = e.minus === void 0 ? "−" : e.minus + "", c = e.nan === void 0 ? "NaN" : e.nan + "";
	function l(e, l) {
		e = a_(e);
		var u = e.fill, d = e.align, f = e.sign, p = e.symbol, m = e.zero, h = e.width, g = e.comma, _ = e.precision, v = e.trim, y = e.type;
		y === "n" ? (g = !0, y = "g") : d_[y] || (_ === void 0 && (_ = 12), v = !0, y = "g"), (m || u === "0" && d === "=") && (m = !0, u = "0", d = "=");
		var b = (l && l.prefix !== void 0 ? l.prefix : "") + (p === "$" ? n : p === "#" && /[boxX]/.test(y) ? "0" + y.toLowerCase() : ""), x = (p === "$" ? r : /[%p]/.test(y) ? o : "") + (l && l.suffix !== void 0 ? l.suffix : ""), S = d_[y], ee = /[defgprs%]/.test(y);
		_ = _ === void 0 ? 6 : /[gprs]/.test(y) ? Math.max(1, Math.min(21, _)) : Math.max(0, Math.min(20, _));
		function C(e) {
			var n = b, r = x, o, l, p;
			if (y === "c") r = S(e) + r, e = "";
			else {
				e = +e;
				var C = e < 0 || 1 / e < 0;
				if (e = isNaN(e) ? c : S(Math.abs(e), _), v && (e = s_(e)), C && +e == 0 && f !== "+" && (C = !1), n = (C ? f === "(" ? f : s : f === "-" || f === "(" ? "" : f) + n, r = (y === "s" && !isNaN(e) && c_ !== void 0 ? m_[8 + c_ / 3] : "") + r + (C && f === "(" ? ")" : ""), ee) {
					for (o = -1, l = e.length; ++o < l;) if (p = e.charCodeAt(o), 48 > p || p > 57) {
						r = (p === 46 ? i + e.slice(o + 1) : e.slice(o)) + r, e = e.slice(0, o);
						break;
					}
				}
			}
			g && !m && (e = t(e, Infinity));
			var w = n.length + e.length + r.length, T = w < h ? Array(h - w + 1).join(u) : "";
			switch (g && m && (e = t(T + e, T.length ? h - r.length : Infinity), T = ""), d) {
				case "<":
					e = n + e + r + T;
					break;
				case "=":
					e = n + T + e + r;
					break;
				case "^":
					e = T.slice(0, w = T.length >> 1) + n + e + r + T.slice(w);
					break;
				default: e = T + n + e + r;
			}
			return a(e);
		}
		return C.toString = function() {
			return e + "";
		}, C;
	}
	function u(e, t) {
		var n = Math.max(-8, Math.min(8, Math.floor(t_(t) / 3))) * 3, r = 10 ** -n, i = l((e = a_(e), e.type = "f", e), { suffix: m_[8 + n / 3] });
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
var g_, __, v_;
y_({
	thousands: ",",
	grouping: [3],
	currency: ["$", ""]
});
function y_(e) {
	return g_ = h_(e), __ = g_.format, v_ = g_.formatPrefix, g_;
}
//#endregion
//#region node_modules/d3-format/src/precisionFixed.js
function b_(e) {
	return Math.max(0, -t_(Math.abs(e)));
}
//#endregion
//#region node_modules/d3-format/src/precisionPrefix.js
function x_(e, t) {
	return Math.max(0, Math.max(-8, Math.min(8, Math.floor(t_(t) / 3))) * 3 - t_(Math.abs(e)));
}
//#endregion
//#region node_modules/d3-format/src/precisionRound.js
function S_(e, t) {
	return e = Math.abs(e), t = Math.abs(t) - e, Math.max(0, t_(t) - t_(e)) + 1;
}
//#endregion
//#region node_modules/d3-scale/src/tickFormat.js
function C_(e, t, n, r) {
	var i = hm(e, t, n), a;
	switch (r = a_(r ?? ",f"), r.type) {
		case "s":
			var o = Math.max(Math.abs(e), Math.abs(t));
			return r.precision == null && !isNaN(a = x_(i, o)) && (r.precision = a), v_(r, o);
		case "":
		case "e":
		case "g":
		case "p":
		case "r":
			r.precision == null && !isNaN(a = S_(i, Math.max(Math.abs(e), Math.abs(t)))) && (r.precision = a - (r.type === "e"));
			break;
		case "f":
		case "%": r.precision == null && !isNaN(a = b_(i)) && (r.precision = a - (r.type === "%") * 2);
	}
	return __(r);
}
//#endregion
//#region node_modules/d3-scale/src/linear.js
function w_(e) {
	var t = e.domain;
	return e.ticks = function(e) {
		var n = t();
		return pm(n[0], n[n.length - 1], e ?? 10);
	}, e.tickFormat = function(e, n) {
		var r = t();
		return C_(r[0], r[r.length - 1], e ?? 10, n);
	}, e.nice = function(n) {
		n ??= 10;
		var r = t(), i = 0, a = r.length - 1, o = r[i], s = r[a], c, l, u = 10;
		for (s < o && (l = o, o = s, s = l, l = i, i = a, a = l); u-- > 0;) {
			if (l = mm(o, s, n), l === c) return r[i] = o, r[a] = s, t(r);
			if (l > 0) o = Math.floor(o / l) * l, s = Math.ceil(s / l) * l;
			else if (l < 0) o = Math.ceil(o * l) / l, s = Math.floor(s * l) / l;
			else break;
			c = l;
		}
		return e;
	}, e;
}
function T_() {
	var e = Qg();
	return e.copy = function() {
		return Xg(e, T_());
	}, Lh.apply(e, arguments), w_(e);
}
//#endregion
//#region src/lib/context-river/compaction-merge.ts
function E_(e, t, n, r, i, a, o) {
	let s = Math.max(0, Math.min(o, (r - e) / 2)), c = e + s, l = r - s, u = (t + n) / 2, d = (i + a) / 2;
	return {
		path: `M ${e} ${u} C ${c} ${u}, ${l} ${d}, ${r} ${d}`,
		mergePath: n > t && a > i ? `M ${e} ${t} C ${c} ${t}, ${l} ${i}, ${r} ${i} L ${r} ${a} C ${l} ${a}, ${c} ${n}, ${e} ${n} Z` : ""
	};
}
//#endregion
//#region src/lib/context-river/layout.ts
function D_(e, t) {
	return ul().x((e) => e.x).y0((e) => e.y0).y1((e) => e.y1).curve(t ? ol : gl)(O_(e)) ?? "";
}
function O_(e) {
	if (e.length < 3) return e;
	let t = [e[0]];
	for (let n = 1; n < e.length - 1; n += 1) {
		let r = e[n - 1], i = e[n], a = e[n + 1];
		(r.y0 !== i.y0 || i.y0 !== a.y0 || r.y1 !== i.y1 || i.y1 !== a.y1) && t.push(i);
	}
	return t.push(e[e.length - 1]), t;
}
function k_(e) {
	return (e.y0 + e.y1) / 2;
}
function A_(e) {
	let t = [...new Set(e)].sort((e, t) => e - t), n = [];
	for (let e of t) {
		let t = n[n.length - 1];
		t && e === t[t.length - 1] + 1 ? t.push(e) : n.push([e]);
	}
	return n;
}
function j_(e, t, n) {
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
function M_(e, t, n) {
	return e.itemById.has(n) ? e.analysis.displayWeightUnit === "calculatedTokens" || e.analysis.displayWeightUnit === "estimatedTokens" ? e.itemEstimateByProfile.get(n)?.get(t.tokenizationProfileId ?? "")?.tokens ?? 0 : 1 : 0;
}
function N_(e, t, n) {
	let r = e.analysis.modelCalls, i = Math.max(0, t - n.left - n.right);
	if (r.length === 0 || i === 0) return [];
	let a = r.length > 1 ? i / (r.length - 1) : i;
	return r.map((t, o) => ({
		callIndex: t.index,
		x: r.length > 1 ? n.left + o * a : n.left + i / 2,
		totalDisplayWeight: t.contextItemIds.reduce((n, r) => n + M_(e, t, r), 0)
	}));
}
function P_(e) {
	return e.reduce((e, t) => t.y1 > t.y0 ? Math.min(e, t.y1 - t.y0) : e, Infinity);
}
function F_(e, t, n) {
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
	let u = n ? [...n] : N_(e, t.width, t.margin), d = s > 1 ? a / (s - 1) : a, f = new Map(u.map((e) => [e.callIndex, e.x])), p = Math.max(0, ...u.map((e) => e.totalDisplayWeight)), m = t.verticalDomainMax ?? p, h = Number.isFinite(m) && m >= 0 ? m : p, g = T_().domain([0, Math.max(1, h)]).range([t.margin.top + o, t.margin.top]), _ = /* @__PURE__ */ new Map(), v = /* @__PURE__ */ new Map();
	for (let n of r.modelCalls) {
		let r = 0, i = c ? [...l.entries()].map(([e, t]) => ({
			key: `kind:${e}`,
			memberItemIds: t
		})) : (e.orderedItemIdsByCall.get(n.index) ?? []).map((e) => ({
			key: e,
			memberItemIds: [e]
		}));
		for (let a of i) {
			let i = a.memberItemIds.reduce((t, r) => t + (e.contextSetByCall.get(n.index)?.has(r) ? M_(e, n, r) : 0), 0);
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
		let a = A_(r.modelCalls.filter((t) => i.some((n) => e.contextSetByCall.get(t.index)?.has(n))).map((e) => e.index));
		for (let [e, r] of a.entries()) {
			let a = r.flatMap((e) => {
				let t = _.get(`kind:${n}`)?.get(e);
				return t ? [t] : [];
			});
			if (a.length === 0) continue;
			let o = j_(a, d, t), s = P_(o), c = s < t.minimumVisibleThickness, l = D_(o, !1);
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
			let e = o[o.length - 1], t = k_(e);
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
		})), o = o.length === 1 && l ? [j_(o, d, t)[0], o[0]] : j_(o, d, t);
		let m = P_(o), h = m < t.minimumVisibleThickness, g = D_(o, s);
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
	let ee = c ? [] : r.compactions.flatMap((t) => {
		let n = _.get(t.summaryItemId)?.get(t.beforeModelCall);
		if (!n) return [];
		let r = k_(n), i = y(t.beforeModelCall);
		return (e.incomingLineage.get(t.summaryItemId) ?? []).filter((e) => e.kind === "frameworkCompaction" && t.sourceItemIds.includes(e.from)).flatMap((e) => {
			let a = _.get(e.from)?.get(t.beforeModelCall - 1);
			if (!a) return [];
			let o = k_(a), s = Math.max(8, Math.min(d * .25, 24));
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
				...E_(a.x, a.y0, a.y1, i, n.y0, n.y1, s)
			}];
		});
	});
	return {
		chartUnit: r.displayWeightUnit,
		columns: u,
		ribbons: x,
		compactions: b,
		lineageConnectors: ee,
		versionMarks: S,
		innerWidth: a,
		innerHeight: o,
		maxTotalDisplayWeight: p
	};
}
//#endregion
//#region src/lib/context-river/horizontal-projection.ts
function I_(e, t, n, r) {
	let i = t - r.left - r.right, a = Math.max(0, n - r.left - r.right);
	if (a === 0 || i <= 0) return [];
	let o = a / i;
	return e.map((e) => ({
		...e,
		x: r.left + (e.x - r.left) * o
	}));
}
function L_(e, t, n, r) {
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
	let c = I_(e.columns, t, n, r), l = new Map(c.map((e) => [e.callIndex, e.x])), u = c.length > 1 ? i / (c.length - 1) : i, d = (e) => {
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
		let i = D_(r, e.linear === !0);
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
			...E_(e.sourceX, e.sourceY0, e.sourceY1, t, e.summaryY0, e.summaryY1, h)
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
function R_(e, t, n) {
	return !Number.isFinite(n.left) || !Number.isFinite(n.right) || n.right < n.left ? !1 : t.some((t) => {
		if (t.itemId !== e || t.points.length === 0) return !1;
		let r = Infinity, i = -Infinity;
		for (let e of t.points) Number.isFinite(e.x) && (r = Math.min(r, e.x), i = Math.max(i, e.x));
		return i >= n.left && r <= n.right;
	});
}
function z_(e, t) {
	return e.some((e) => e.startCall <= t && t <= e.endCall);
}
function B_(e, t, n, r = null) {
	if (r !== null && z_(e, r)) return t.some((e) => e.callIndex === r) ? r : null;
	if (e.length === 0 || t.length === 0) return null;
	let i = Number.isFinite(n) ? n : r === null ? NaN : t.find((e) => e.callIndex === r)?.x ?? NaN;
	if (!Number.isFinite(i)) return null;
	let a = null;
	for (let n of t) {
		if (!z_(e, n.callIndex) || !Number.isFinite(n.x)) continue;
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
function V_() {
	return {
		pointers: [],
		gesture: null,
		suppressClick: !1
	};
}
function H_(e, t) {
	return Q_(e, t);
}
function U_(e, t) {
	return e.filter((e) => e.pointerId !== t);
}
function W_(e, t) {
	let n = t ? t.map((t) => e.find((e) => e.pointerId === t)) : e.slice(0, 2);
	if (n.length < 2 || n.some((e) => e === void 0)) return null;
	let r = n[0], i = n[1];
	return {
		x: (r.x + i.x) / 2,
		y: (r.y + i.y) / 2
	};
}
function G_(e, t, n) {
	if (t.pointerType === "mouse" && t.button !== 0 && t.button !== 1) return {
		state: e,
		effects: []
	};
	let r = Q_(e.pointers, t), i = {
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
			startDistance: Math.max(1, $_(e, t)),
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
function K_(e, t, n) {
	if (!e.pointers.some((e) => e.pointerId === t.pointerId)) return {
		state: e,
		effects: []
	};
	let r = Q_(e.pointers, t), i = {
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
		let o = W_(r, a.pointerIds);
		return o ? {
			state: i,
			effects: [{
				kind: "pinch-zoom",
				centerX: o.x,
				distance: Math.max(1, $_(e, n)),
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
function q_(e, t, n) {
	if (!e.pointers.some((e) => e.pointerId === t)) return {
		state: e,
		effects: []
	};
	let r = U_(e.pointers, t), i = [{ kind: "clear-selection" }], a = e.gesture, o = a, s = e.suppressClick;
	if (a?.kind === "pinch") {
		if (s = !0, i.push({ kind: "suppress-click" }), a.pointerIds.includes(t)) {
			let e = W_(r);
			o = r.length >= 2 && e && n.pinchAnchor ? {
				kind: "pinch",
				pointerIds: [r[0].pointerId, r[1].pointerId],
				startDistance: Math.max(1, $_(r[0], r[1])),
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
function J_(e, t) {
	return e.pointers.some((e) => e.pointerId === t) ? {
		state: V_(),
		effects: [{ kind: "clear-selection" }, {
			kind: "release",
			pointerIds: e.pointers.map((e) => e.pointerId)
		}]
	} : {
		state: e,
		effects: []
	};
}
function Y_(e) {
	return e.pointers.length === 0 && e.gesture === null ? {
		state: V_(),
		effects: []
	} : {
		state: V_(),
		effects: [{ kind: "clear-selection" }, {
			kind: "release",
			pointerIds: e.pointers.map((e) => e.pointerId)
		}]
	};
}
function X_(e) {
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
function Z_(e) {
	return e.suppressClick ? {
		...e,
		suppressClick: !1
	} : e;
}
function Q_(e, t) {
	let n = e.findIndex((e) => e.pointerId === t.pointerId);
	return n < 0 ? [...e, t] : e.map((e, r) => r === n ? t : e);
}
function $_(e, t) {
	return Math.hypot(t.x - e.x, t.y - e.y);
}
//#endregion
//#region src/lib/context-river/ContextRiver.svelte
var ev = 0, tv = /* @__PURE__ */ W("<span> </span>"), nv = /* @__PURE__ */ Rr("<path fill=\"black\" vector-effect=\"non-scaling-stroke\"></path>"), rv = /* @__PURE__ */ Rr("<path fill=\"black\"></path>"), iv = /* @__PURE__ */ Rr("<pattern width=\"8\" height=\"8\" patternUnits=\"userSpaceOnUse\"><rect width=\"8\" height=\"8\" fill=\"var(--input-gap-base)\" opacity=\".08\"></rect><path d=\"M-2 2L2-2M0 8L8 0M6 10L10 6\" stroke=\"var(--input-gap)\" stroke-width=\"1\" opacity=\".45\"></path></pattern><mask maskUnits=\"userSpaceOnUse\" style=\"mask-type:luminance\"><rect fill=\"white\"></rect><g><!><!></g></mask>", 1), av = /* @__PURE__ */ Rr("<linearGradient gradientUnits=\"userSpaceOnUse\"><stop offset=\"0%\"></stop><stop offset=\"100%\"></stop></linearGradient>"), ov = /* @__PURE__ */ Rr("<line class=\"weight-gridline svelte-13ao2q1\"></line>"), sv = /* @__PURE__ */ Rr("<line class=\"column-guide svelte-13ao2q1\"></line>"), cv = /* @__PURE__ */ Rr("<g class=\"compaction-marker svelte-13ao2q1\"><title> </title><line class=\"svelte-13ao2q1\"></line><text class=\"svelte-13ao2q1\"> </text></g>"), lv = /* @__PURE__ */ Rr("<path class=\"compaction-merge svelte-13ao2q1\" aria-hidden=\"true\"></path>"), uv = /* @__PURE__ */ Rr("<title> </title>"), dv = /* @__PURE__ */ Rr("<g><path vector-effect=\"non-scaling-stroke\"></path><path class=\"ribbon-hit svelte-13ao2q1\" vector-effect=\"non-scaling-stroke\" pointer-events=\"fill\" role=\"button\"><!></path></g>"), fv = /* @__PURE__ */ Rr("<path class=\"unreconciled-input\"></path>"), pv = /* @__PURE__ */ Rr("<!><path class=\"reported-input-line svelte-13ao2q1\"></path>", 1), mv = /* @__PURE__ */ Rr("<g class=\"reported-input-overlay svelte-13ao2q1\" aria-hidden=\"true\" data-testid=\"reported-input-overlay\"></g>"), hv = /* @__PURE__ */ Rr("<g role=\"button\"><rect width=\"44\" height=\"38\" class=\"svelte-13ao2q1\"></rect><text text-anchor=\"middle\" class=\"svelte-13ao2q1\"> </text></g>"), gv = /* @__PURE__ */ Rr("<path class=\"lineage-connector visible svelte-13ao2q1\" vector-effect=\"non-scaling-stroke\"></path>"), _v = /* @__PURE__ */ Rr("<path></path><!>", 1), vv = /* @__PURE__ */ Rr("<path class=\"ribbon-emphasis hovered svelte-13ao2q1\" vector-effect=\"non-scaling-stroke\"></path>"), yv = /* @__PURE__ */ Rr("<path class=\"ribbon-emphasis selected svelte-13ao2q1\" vector-effect=\"non-scaling-stroke\"></path>"), bv = /* @__PURE__ */ Rr("<line class=\"version-mark svelte-13ao2q1\" vector-effect=\"non-scaling-stroke\"></line>"), xv = /* @__PURE__ */ Rr("<rect class=\"zoom-selection svelte-13ao2q1\"></rect>"), Sv = /* @__PURE__ */ Rr("<line class=\"crosshair svelte-13ao2q1\"></line>"), Cv = /* @__PURE__ */ Rr("<line class=\"pin-line svelte-13ao2q1\"></line>"), wv = /* @__PURE__ */ W("<div role=\"status\"><strong class=\"svelte-13ao2q1\"> </strong> <span> </span> <span> </span></div>"), Tv = /* @__PURE__ */ W("<span class=\"svelte-13ao2q1\"><i class=\"svelte-13ao2q1\"></i> </span>"), Ev = /* @__PURE__ */ W("<div class=\"group-type-legend svelte-13ao2q1\" role=\"group\" aria-label=\"Item type legend\"><strong class=\"svelte-13ao2q1\">Item types</strong> <!></div>"), Dv = /* @__PURE__ */ W("<span class=\"svelte-13ao2q1\"><i class=\"input-gap-key svelte-13ao2q1\"></i>Unreconciled input<!></span>"), Ov = /* @__PURE__ */ W("<span class=\"input-comparison-readout svelte-13ao2q1\"> <!> tokens</span>"), kv = /* @__PURE__ */ W("<span class=\"input-comparison-readout svelte-13ao2q1\"> </span>"), Av = /* @__PURE__ */ W("<span class=\"input-comparison-readout svelte-13ao2q1\">Hover or pin a call to compare its estimated and reported input.</span>"), jv = /* @__PURE__ */ W("<div class=\"input-reference-legend svelte-13ao2q1\" role=\"group\" aria-label=\"Input reference legend\"><span class=\"svelte-13ao2q1\"><i class=\"input-reference-key svelte-13ao2q1\"></i>Reported input</span> <!> <!></div>"), Mv = /* @__PURE__ */ W("<div class=\"economics-readout svelte-13ao2q1\" aria-label=\"Economics call readout\"> </div>"), Nv = /* @__PURE__ */ W("<div class=\"vertical-scale-controls svelte-13ao2q1\"><div class=\"toggle-group svelte-13ao2q1\" role=\"group\" aria-label=\"Vertical scale\"><span class=\"toggle-label\">Vertical scale</span> <button type=\"button\">Session scale</button> <button type=\"button\">Visible calls</button></div> <div class=\"toggle-group svelte-13ao2q1\" role=\"group\" aria-label=\"River display\"><span class=\"toggle-label\">Display</span> <button type=\"button\">Items</button> <button type=\"button\">Item types</button></div></div> <div class=\"chart-frame svelte-13ao2q1\"><div class=\"chart-plot svelte-13ao2q1\"><div class=\"vertical-axis-overlay svelte-13ao2q1\" role=\"img\"></div> <div class=\"river-scroll svelte-13ao2q1\" data-testid=\"river-host\" role=\"application\" tabindex=\"0\" aria-label=\"Context River\" aria-describedby=\"context-river-description\"><span id=\"context-river-description\" class=\"sr-only\"> </span>  <div class=\"river-canvas svelte-13ao2q1\"><svg class=\"river-plot svelte-13ao2q1\"><defs><!><!><pattern id=\"unknown-geometry\" width=\"8\" height=\"8\" patternUnits=\"userSpaceOnUse\"><rect width=\"8\" height=\"8\" fill=\"var(--unknown-fill)\"></rect><path d=\"M0 0V8\" stroke=\"var(--unknown-mark)\" stroke-width=\"2\" opacity=\".65\"></path></pattern></defs><rect class=\"plot-background svelte-13ao2q1\"></rect><!><!><!><g data-testid=\"river-ribbon-geometry\"><!><!></g><!></svg> <svg class=\"river-overlay svelte-13ao2q1\"><!><g aria-hidden=\"true\"><!><!><!><!></g><!><!><!></svg></div> <!> <!> <!> <!> <!></div></div> <!> <!> <!></div>", 1), Pv = {
	hash: "svelte-13ao2q1",
	code: ".vertical-scale-controls.svelte-13ao2q1 {display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:6px 0 10px;color:var(--secondary);font-size:var(--text-md);}.vertical-scale-controls.svelte-13ao2q1 > .toggle-group:where(.svelte-13ao2q1) {white-space:nowrap;}.chart-frame.svelte-13ao2q1 {position:relative;max-width:100%;}\n  /* The legends sit in the chart's horizontal scroller; sticky, like the Cache & cost header,\n     they stay in view while a zoomed chart is scrolled, starting where the plot does. */.group-type-legend.svelte-13ao2q1 {position:sticky;left:0;display:flex;flex-wrap:wrap;align-items:center;gap:5px 12px;width:100%;margin:6px 0 0;padding-left:var(--plot-left);color:var(--text);font-size:var(--text-sm);}.group-type-legend.svelte-13ao2q1 strong:where(.svelte-13ao2q1) {color:var(--text-strong);}.group-type-legend.svelte-13ao2q1 span:where(.svelte-13ao2q1) {display:inline-flex;align-items:center;gap:4px;}.group-type-legend.svelte-13ao2q1 i:where(.svelte-13ao2q1) {width:10px;height:10px;border-radius:var(--radius-small);border:1px solid var(--swatch-border);}.group-hover-card.svelte-13ao2q1 {position:absolute;z-index:4;display:grid;gap:2px;width:max-content;max-width:240px;padding:6px 9px;border:1px solid var(--separator);border-left:3px solid var(--group-color);border-radius:var(--control-radius);background:var(--plot);color:var(--text);font-size:var(--text-sm);box-shadow:0 6px 18px var(--shadow);pointer-events:none;transform:translate(14px, 14px);}.group-hover-card.flip.svelte-13ao2q1 {transform:translate(calc(-100% - 14px), 14px);}.group-hover-card.svelte-13ao2q1 strong:where(.svelte-13ao2q1) {color:var(--text-strong);}.chart-plot.svelte-13ao2q1 {position:relative;min-width:0;max-width:100%;}.economics-readout.svelte-13ao2q1 {min-height:28px;padding:0.45rem 0 0 var(--plot-left);color:var(--secondary);font-size:var(--text-sm);font-variant-numeric:tabular-nums;overflow-wrap:anywhere;}.vertical-axis-overlay.svelte-13ao2q1 {position:absolute;z-index:2;left:0;width:var(--plot-left);border-right:1px solid var(--control-border);background:var(--plot);pointer-events:none;}.vertical-axis-tick.svelte-13ao2q1 {position:absolute;right:5px;color:var(--text);font-size:10px;line-height:1;white-space:nowrap;transform:translateY(-50%);}.vertical-axis-tick.top.svelte-13ao2q1 {transform:none;}.vertical-axis-tick.bottom.svelte-13ao2q1 {transform:translateY(-100%);}.river-scroll.svelte-13ao2q1 {overflow-x:auto;max-width:100%;overscroll-behavior-x:contain;scrollbar-color:var(--control-border) var(--plot);scrollbar-width:thin;outline:none;user-select:none;-webkit-user-select:none;}.river-scroll.svelte-13ao2q1:focus-visible {outline:2px solid var(--accent);outline-offset:2px;}.river-scroll.svelte-13ao2q1::-webkit-scrollbar {height:9px;}.river-scroll.svelte-13ao2q1::-webkit-scrollbar-track {background:var(--plot);border-radius:var(--control-radius);}.river-scroll.svelte-13ao2q1::-webkit-scrollbar-thumb {background:var(--control-border);border:2px solid var(--plot);border-radius:var(--control-radius);}svg.svelte-13ao2q1 {display:block;background:var(--plot);border-radius:var(--radius);touch-action:pan-y;}.plot-background.svelte-13ao2q1 {fill:var(--plot);}.weight-gridline.svelte-13ao2q1 {stroke:var(--separator);stroke-width:0.75;opacity:0.72;pointer-events:none;}.column-guide.svelte-13ao2q1 {stroke:var(--chart-guide);stroke-width:1;pointer-events:none;}.river-overlay.svelte-13ao2q1 .call-target:where(.svelte-13ao2q1) {pointer-events:all;}.call-target.svelte-13ao2q1 {cursor:pointer;color:var(--secondary);}.call-target.svelte-13ao2q1 rect:where(.svelte-13ao2q1) {fill:transparent;}.call-target.svelte-13ao2q1 text:where(.svelte-13ao2q1) {fill:currentColor;font-size:var(--text-sm);}.call-target.svelte-13ao2q1:hover,\n  .call-target.svelte-13ao2q1:focus-visible,\n  .call-target.pinned.svelte-13ao2q1 {color:var(--text-strong);outline:none;}.call-target.svelte-13ao2q1:focus-visible rect:where(.svelte-13ao2q1) {stroke:var(--selection);stroke-width:2;}.call-target.condensed.svelte-13ao2q1 {pointer-events:none;}.call-target.condensed.svelte-13ao2q1:focus-visible {pointer-events:all;}.compaction-marker.svelte-13ao2q1 {pointer-events:none;}.compaction-marker.svelte-13ao2q1 line:where(.svelte-13ao2q1) {stroke:var(--compaction);stroke-width:1.5;stroke-dasharray:6 5;}.compaction-marker.svelte-13ao2q1 text:where(.svelte-13ao2q1) {fill:var(--compaction-text);font-size:10px;font-weight:700;letter-spacing:0.08em;}.reported-input-overlay.svelte-13ao2q1 {pointer-events:none;}.reported-input-line.svelte-13ao2q1 {fill:none;stroke:var(--secondary);stroke-width:1.5;stroke-dasharray:5 4;pointer-events:none;}.input-reference-legend.svelte-13ao2q1 {position:sticky;left:0;width:100%;display:flex;flex-wrap:wrap;align-items:center;gap:0.35rem 1rem;padding:0.45rem 0 0.45rem var(--plot-left);color:var(--secondary);font-size:var(--text-sm);}.input-reference-legend.svelte-13ao2q1 span:where(.svelte-13ao2q1) {display:inline-flex;align-items:center;gap:0.4rem;}.input-reference-legend.svelte-13ao2q1 i:where(.svelte-13ao2q1) {display:inline-block;width:18px;height:10px;flex-shrink:0;}.input-reference-key.svelte-13ao2q1 {border-top:2px dashed var(--secondary);margin-top:8px;}.input-gap-key.svelte-13ao2q1 {background:repeating-linear-gradient(\n      135deg,\n      transparent 0 4px,\n      color-mix(in srgb, var(--input-gap) 46%, transparent) 4px 5px\n    );border:1px solid color-mix(in srgb, var(--input-gap-base) 34%, transparent);}.input-comparison-readout.svelte-13ao2q1 {flex-basis:100%;}\n\n  /* Hover and selection never restyle ribbons: that would re-rasterise every\n     ribbon. Emphasis is drawn in .river-overlay instead. */.river-canvas.svelte-13ao2q1 {position:relative;}\n  /* Composite the overlay, not the ribbon SVG: promoting the ribbon SVG changes\n     how Chrome hit-tests sub-pixel ribbons. */.river-overlay.svelte-13ao2q1 {position:absolute;top:0;left:0;background:none;pointer-events:none;will-change:transform;}.ribbon.svelte-13ao2q1 {pointer-events:none;fill-opacity:0.88;stroke-opacity:0.88;}.ribbon-group.unknown.svelte-13ao2q1 .ribbon:where(.svelte-13ao2q1) {fill-opacity:0.92;}.ribbon-emphasis.svelte-13ao2q1 {fill-opacity:1;}.ribbon-emphasis.hovered.svelte-13ao2q1 {stroke:var(--selection-soft);stroke-width:1.5;}.ribbon-emphasis.selected.svelte-13ao2q1 {stroke:var(--selection);stroke-width:2.5;}.ribbon.subpixel.svelte-13ao2q1 {paint-order:stroke;}.ribbon-hit.svelte-13ao2q1 {fill:transparent;stroke:transparent;stroke-width:0;cursor:pointer;pointer-events:fill;}.ribbon-hit.svelte-13ao2q1:focus-visible {stroke:var(--selection-focus);stroke-width:3;outline:none;}.compaction-merge.svelte-13ao2q1 {opacity:0.4;pointer-events:none;}\n  /* Drawn over the 0.4 base merge: about 0.5 combined when the summary is\n     focused, about 0.8 when the focused item is one of its sources. */.compaction-merge-emphasis.svelte-13ao2q1 {opacity:0.15;}.compaction-merge-emphasis.emphasized.svelte-13ao2q1 {opacity:0.65;}.version-mark.svelte-13ao2q1 {stroke:var(--selection);stroke-width:1.5;opacity:0.8;}.lineage-connector.svelte-13ao2q1 {fill:none;stroke:var(--selection);stroke-width:1.5;stroke-dasharray:4 4;opacity:0.88;}.crosshair.svelte-13ao2q1 {stroke:var(--secondary);stroke-width:1;stroke-dasharray:4 4;pointer-events:none;}.pin-line.svelte-13ao2q1 {stroke:var(--selection);stroke-width:2;pointer-events:none;}.zoom-selection.svelte-13ao2q1 {fill:color-mix(in srgb, var(--accent) 20%, transparent);stroke:var(--accent);stroke-width:1.5;stroke-dasharray:4 3;pointer-events:none;}"
};
function Fv(e, t) {
	Be(t, !0), ui(e, Pv);
	let n = () => ot(Na, "$activePalette", r), [r, i] = st(), a = `compaction-merge-${ev++}`, o = 0, s = X(t, "pinnedCallIndex", 3, null), c = X(t, "hoveredCallIndex", 3, null), l = X(t, "selectedItemId", 3, null), u = X(t, "hoveredItemId", 3, null), d = X(t, "navigationCommand", 3, null), f = X(t, "isVisible", 3, !0), p = X(t, "onViewportChange", 3, () => {}), m = X(t, "onNavigationSettled", 3, () => {}), h = X(t, "onSelectionVisibility", 3, () => {}), g = X(t, "consumeUnhandledEscape", 3, !0), _ = X(t, "preferences", 23, Ki), v = X(t, "onPreferencesChange", 3, () => {}), y = null, b = /* @__PURE__ */ F(void 0), x = /* @__PURE__ */ F(void 0);
	function S(e) {
		_(e), v()(e);
	}
	function ee(e) {
		rn(e.river.verticalScale), H(ae) !== e.river.display && Vn(!1), I(ae, e.river.display, !0);
		let t = e.economics.expanded ? e.economics.lastMode : "off";
		if (t === "off" && H(se) !== "off") {
			let e = Hi(E).activeElement, t = e instanceof Node && (H(x)?.contains(e) || E?.querySelector(".economics-track-svg")?.contains(e) || H(j)?.contains(e));
			Kn(!1), pe.cancel(), I(ce, ""), I(le, null), I(ge, ""), t && H(b)?.focus();
		}
		I(oe, e.economics.cacheView, !0), I(se, t, !0);
	}
	function C(e) {
		S({
			..._(),
			river: {
				..._().river,
				display: e
			}
		});
	}
	function w(e) {
		S({
			..._(),
			river: {
				..._().river,
				verticalScale: e
			}
		});
	}
	function T(e) {
		S({
			..._(),
			economics: {
				..._().economics,
				cacheView: e
			}
		});
	}
	let E, D, O, k = /* @__PURE__ */ F(960), te = /* @__PURE__ */ F(!1), A = /* @__PURE__ */ F(0), ne = /* @__PURE__ */ F(0), re = /* @__PURE__ */ F(0), ie = /* @__PURE__ */ F("session"), ae = /* @__PURE__ */ F("items"), oe = /* @__PURE__ */ F("tokens"), se = /* @__PURE__ */ F("off"), ce = /* @__PURE__ */ F(""), le = /* @__PURE__ */ F(null), ue = /* @__PURE__ */ F(null), de = null, fe = tm(), pe = tm(), me = /* @__PURE__ */ F(null), he, ge = /* @__PURE__ */ F(""), j = /* @__PURE__ */ F(null), _e = /* @__PURE__ */ F(null), M = /* @__PURE__ */ F(null), ve = /* @__PURE__ */ F(null), ye = /* @__PURE__ */ F(null), xe = "", Se = 960, Ce = null, we = "", Te = "", Ee = [], De = /* @__PURE__ */ F(null), Oe = /* @__PURE__ */ F(null), ke = V_(), Ae = null, je = !1, Me = !0, Ne = {
		top: 36,
		right: 24,
		bottom: 54,
		left: 42
	}, Pe = 1.5, Fe = {
		maxWeight: 0,
		visibleCallCount: 0,
		usesInterpolatedEdge: !1
	};
	function Ie() {
		f() ? E && E.clientWidth > 0 && (I(k, E.clientWidth, !0), I(te, !0), nn()) : (fe.cancel(), pe.cancel(), Nn(), t.onHoverCall(null), t.onHoverItem(null), H(le) && Kn(!1));
	}
	let Le = /* @__PURE__ */ F(null), Re = /* @__PURE__ */ P(() => Ul(t.indexed.analysis.economics.costBasis, t.indexed.analysis.session.source)), ze = /* @__PURE__ */ P(() => H(ue) ? H(ue).memberIds.slice(0, 12).map((e) => Fo(t.indexed.itemById.get(e), e)) : []), He = /* @__PURE__ */ P(() => JSON.stringify(t.indexed.analysis.modelCalls.map((e) => [e.index, e.sourceRecordId]))), Ue = /* @__PURE__ */ P(() => t.indexed.analysis.modelCalls.length), We = /* @__PURE__ */ P(() => Math.max(1, H(k) - Ne.left - Ne.right)), Ge = /* @__PURE__ */ P(() => H(Ue) > 1 ? H(We) / (H(Ue) - 1) : 0), Ke = /* @__PURE__ */ P(() => Math.max(H(M) ?? H(Ge), H(Ge))), qe = /* @__PURE__ */ P(() => H(Ue) > 1 && H(M) !== null ? Math.max(H(k), Ne.left + Ne.right + (H(Ue) - 1) * H(M)) : Math.max(1, H(k))), Je = /* @__PURE__ */ P(() => N_(t.indexed, 960, Ne)), Ye = /* @__PURE__ */ P(() => vl(t.indexed, H(Je))), Xe = /* @__PURE__ */ P(() => bl(H(Je), H(Ye))), Ze = /* @__PURE__ */ P(() => Math.max(0, ...H(Xe).map((e) => e.totalDisplayWeight))), Qe = /* @__PURE__ */ P(() => I_(H(Xe), 960, H(qe), Ne)), $e = /* @__PURE__ */ P(() => Math.max(Ne.left, H(A) - H(re))), et = /* @__PURE__ */ P(() => Math.min(H(qe) - Ne.right, H(A) - H(re) + H(k))), tt = /* @__PURE__ */ P(() => Math.max(Ne.left, H(ne) - H(re))), nt = /* @__PURE__ */ P(() => Math.min(H(qe) - Ne.right, H(ne) - H(re) + H(k))), rt = /* @__PURE__ */ P(() => F_(t.indexed, {
		width: 960,
		height: 500,
		margin: Ne,
		minimumVisibleThickness: 1,
		verticalDomainMax: H(Ye).size > 0 ? H(Ze) : void 0,
		groupByKind: H(ae) === "itemTypes"
	}, H(Je))), it = /* @__PURE__ */ P(() => L_(H(rt), 960, H(qe), Ne)), at = /* @__PURE__ */ P(() => H(it).layout), ct = /* @__PURE__ */ P(() => l() === null || !H(te) || !f() ? null : {
		itemId: l(),
		visible: cr(l(), H(ae), H(at).ribbons, {
			left: (H(tt) - H(it).offset) / (H(it).scale || 1),
			right: (H(nt) - H(it).offset) / (H(it).scale || 1)
		})
	}), lt = /* @__PURE__ */ P(() => JSON.stringify(H(ct))), ut = /* @__PURE__ */ P(() => H(ie) === "visible" ? gm(H(Qe), H($e), H(et)) : Fe), dt = /* @__PURE__ */ P(() => Math.max(1, H(Ye).size > 0 ? H(Ze) : H(rt).maxTotalDisplayWeight)), ft = /* @__PURE__ */ P(() => H(ie) === "visible" ? H(dt) / Math.max(1, H(ut).maxWeight) : 1), pt = /* @__PURE__ */ P(() => (500 - Ne.bottom) * (1 - H(ft))), mt = /* @__PURE__ */ P(() => H(ft) === 1 ? H(it).transform : `${H(it).transform} matrix(1 0 0 ${H(ft)} 0 ${H(pt)})`), ht = /* @__PURE__ */ P(() => Au(t.indexed.analysis)), gt = /* @__PURE__ */ P(() => H(ie) === "visible" ? H(ut).maxWeight : H(Ze)), _t = /* @__PURE__ */ P(() => Math.max(1, H(gt))), vt = /* @__PURE__ */ P(() => xl(H(at).columns, H(Ye), {
		width: H(qe),
		height: 500,
		margin: Ne,
		minimumVisibleThickness: 1
	}, H(_t))), yt = /* @__PURE__ */ P(() => [...H(Ye).values()].some((e) => e.gap > 0)), bt = /* @__PURE__ */ P(() => H(Ye).get(s() ?? c() ?? -1)), xt = /* @__PURE__ */ P(() => _m(H(gt))), St = /* @__PURE__ */ P(() => H(xt).map((e, t) => ({
		value: e,
		position: t,
		y: Ne.top + H(at).innerHeight * (1 - e / H(_t)),
		percent: Math.max(0, Math.min(100, 100 * (1 - e / H(_t))))
	}))), Ct = /* @__PURE__ */ P(() => t.indexed.analysis.displayWeightUnit === "unavailable" ? "structural placeholder stack weight (token geometry unavailable)" : Ga(t.indexed.analysis.displayWeightUnit)), wt = /* @__PURE__ */ P(() => H(ie) === "session" ? `Session-wide scale in ${H(Ct)}. Ribbon heights remain comparable across the session.` : `${H(ut).visibleCallCount} visible call markers in ${H(Ct)}. Viewport edges are interpolated where needed; ribbon heights change as you pan or zoom.`), Tt = /* @__PURE__ */ P(() => `Vertical axis. ${H(wt)} Tick values: ${H(xt).map(xm).join(", ")}.`), Et = /* @__PURE__ */ P(() => new Map(H(at).columns.map((e) => [e.callIndex, e]))), Dt = /* @__PURE__ */ P(() => new Map(H(at).ribbons.filter((e) => e.groupKind === void 0).map((e) => [e.itemId, e]))), Ot = /* @__PURE__ */ P(() => u() === null ? null : H(Dt).get(u()) ?? null), kt = /* @__PURE__ */ P(() => l() === null ? null : H(Dt).get(l()) ?? null), At = /* @__PURE__ */ P(() => l() ?? u()), jt = /* @__PURE__ */ P(() => new Map(H(at).ribbons.map((e) => [e.key, e]))), Mt = /* @__PURE__ */ P(() => H(at).ribbons.reduce((e, t) => {
		let n = e.get(t.itemId);
		return n ? n.push(t) : e.set(t.itemId, [t]), e;
	}, /* @__PURE__ */ new Map())), Nt = /* @__PURE__ */ P(() => H(Le) !== null && H(jt).has(H(Le)) ? H(Le) : H(kt)?.key ?? H(at).ribbons[0]?.key ?? null), Pt = /* @__PURE__ */ P(() => Ih(H(at).columns, 52, s())), Ft = /* @__PURE__ */ P(() => [...H(Pt)].map((e) => H(at).columns[e]?.callIndex)), It = /* @__PURE__ */ P(() => s() !== null && H(Ft).includes(s()) ? s() : H(Ft)[0] ?? null), Lt = /* @__PURE__ */ P(() => H(At) === null ? [] : H(at).lineageConnectors.map((e, t) => ({
		connector: e,
		index: t
	})).filter(({ connector: e }) => e.fromItemId === H(At) || e.toItemId === H(At))), Rt = /* @__PURE__ */ P(() => H(at).columns.map((e) => ({
		callIndex: e.callIndex,
		x: e.x,
		sourceRecordId: t.indexed.callByIndex.get(e.callIndex)?.sourceRecordId ?? null
	}))), zt = /* @__PURE__ */ P(() => H(Rt).length < 2 ? Infinity : H(Rt).reduce((e, t, n) => n === 0 ? e : Math.min(e, t.x - H(Rt)[n - 1].x), Infinity)), Bt = /* @__PURE__ */ P(() => H(zt) < 52 ? Math.ceil(52 / Math.max(1, H(zt))) : 1), Vt = /* @__PURE__ */ P(() => Ih(H(at).columns, 52, null)), Ht = /* @__PURE__ */ P(() => H(Ge) > 0 ? Math.max(1, H(Ke) / H(Ge)) : 1), Ut = /* @__PURE__ */ P(() => H(M) === null || H(qe) <= H(k) + 1), Wt = /* @__PURE__ */ P(() => H(Ge) * Math.min(256, Math.max(1, H(Ue) - 1))), Gt = /* @__PURE__ */ P(() => H(Ue) > 1 && H(Ke) < H(Wt) - .5), Kt = /* @__PURE__ */ P(() => H(Ue) > 1 && !H(Ut) && H(Ht) > 1.01), qt = /* @__PURE__ */ P(() => H(Oe) ? {
		x: Math.min(bn(H(Oe).startClientX), bn(H(Oe).currentClientX)),
		width: Math.abs(bn(H(Oe).currentClientX) - bn(H(Oe).startClientX))
	} : null);
	Tn(() => {
		let e = _();
		e !== y && (y = e, yr(() => ee(e)));
	}), Tn(() => fe.observeIdentity(t.indexed)), Tn(() => pe.observeIdentity(t.indexed)), Tn(() => {
		if (H(lt) === Te) return;
		Te = H(lt);
		let e = H(ct);
		yr(() => h()(e));
	}), Tn(() => {
		Me !== f() && (Me = f(), yr(Ie));
	}), Tn(() => {
		H(He), H(k), H(M), H(ve), yr(Jt);
	}), Cn(() => {
		d(), f(), H(qe), H(at), H(He), H(k), H(te), H(M), H(De), H(ye), H(le), H(j), yr(Yt);
	});
	function Jt() {
		if (E) {
			if (H(ve) && H(M) !== null && H(k) !== Se) {
				I(ye, H(ve), !0);
				return;
			}
			if (!H(De) && H(M) !== null && (H(He) !== xe || H(k) !== Se)) {
				let e = H(k) === Se ? ca(Ee, E.scrollLeft, Qt(), tn()) : Jp(Ee, E.scrollLeft + Se / 2 - H(re), H(k) / 2);
				e && I(De, {
					kind: "anchor",
					anchor: e
				}, !0);
			}
		}
	}
	function Yt() {
		if (E) {
			if (de && !de.isConnected && (de = null), cn(), d() && d().id !== Ce && en() && (Ce = d().id, yn(d())), H(ye)) {
				let e = H(ye);
				if (I(ye, null), H(ve) === e && H(M) !== null) {
					let t = un(e.startCallIndex, e.endCallIndex, Qt() / 2);
					if (t) {
						let e = Yp(t.intervalCount, H(We), H(Ue));
						fn(Math.min(H(Wt), e), t.anchor);
					} else I(ve, null);
				}
			}
			if (nn(), xe = H(He), Se = H(k), Ee = H(Rt), on(), H(le) && H(j)) {
				let e = Gn();
				e !== H(ge) && I(ge, e, !0);
			}
		}
	}
	let Xt = null;
	function Zt() {
		Xt === null && (Xt = requestAnimationFrame(() => {
			Xt = null, nn(), on(), Wn();
		}));
	}
	Bi(() => {
		let e = Zp(E, {
			onScroll: Zt,
			onDocumentScroll: Wn,
			onWheel: (e) => {
				if (!(e.metaKey || e.ctrlKey) || H(Ue) < 2) return;
				e.preventDefault();
				let t = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 16 : e.deltaMode === WheelEvent.DOM_DELTA_PAGE ? e.deltaY * Math.max(1, E.clientHeight) : e.deltaY;
				pn(e.clientX, Math.exp(-t * .0035));
			},
			onPointerMove: An,
			onPointerUp: jn,
			onPointerCancel: Mn,
			onKeyUp: (e) => {
				e.code === "Space" && (je = !1);
			},
			onBlur: () => {
				je = !1, Nn();
			},
			onResize: (e, t) => {
				if (H(k) !== e) {
					let t = ke.pointers.length > 0;
					Nn(), t && (ke = {
						...ke,
						suppressClick: !0
					}), I(k, e, !0);
				}
				I(te, !0), nn(), t === "element" && (on(), Wn());
			}
		});
		return () => {
			fe.dispose(), pe.dispose(), Nn(), Ae !== null && window.clearTimeout(Ae), Xt !== null && cancelAnimationFrame(Xt), e();
		};
	});
	function Qt() {
		return E?.clientWidth > 0 ? E.clientWidth : H(te) ? H(k) : 0;
	}
	function $t() {
		return Math.max(E?.scrollWidth ?? 0, H(qe));
	}
	function en() {
		return !f() || !E || E.clientWidth <= 0 ? !1 : Math.abs(E.clientWidth - H(k)) > .5 ? (I(k, E.clientWidth, !0), I(te, !0), !1) : !0;
	}
	function tn() {
		if (!E || !D) return 0;
		let e = E.getBoundingClientRect(), t = D.getBoundingClientRect();
		return !Number.isFinite(e.left) || !Number.isFinite(t.left) ? 0 : t.left - e.left + E.scrollLeft - E.clientLeft;
	}
	function nn() {
		if (!E) return;
		H(ne) !== E.scrollLeft && I(ne, E.scrollLeft, !0);
		let e = tn();
		Math.abs(H(re) - e) > .01 && I(re, e, !0), H(ie) === "visible" && H(A) !== E.scrollLeft && I(A, E.scrollLeft, !0);
	}
	function rn(e) {
		I(ie, e, !0), e === "visible" && E && (I(A, E.scrollLeft, !0), I(re, tn(), !0));
	}
	function an() {
		let e = Qt(), t = $t(), n = H(te) || e > 0, r = H(re), i = n ? oa(H(Rt), E.scrollLeft, e, r) : {
			firstVisibleCallIndex: null,
			lastVisibleCallIndex: null
		};
		return {
			ready: n,
			isFitAll: H(Ut),
			zoomFactor: H(Ht),
			canZoomIn: H(Gt),
			canZoomOut: H(Kt),
			totalCallCount: H(Ue),
			hasOverflow: n && t > e + 1,
			centerCallIndex: n ? jh(E.scrollLeft + e / 2 - r, H(at).columns) : null,
			...i
		};
	}
	function on() {
		if (!E) return;
		let e = an(), t = JSON.stringify(e);
		t !== we && (we = t, p()(e)), e.ready && Ce !== null && !H(De) && !H(ye) && Ce !== o && (o = Ce, m()(Ce));
	}
	function sn(e) {
		E.scrollLeft = aa(e, $t(), Qt()), nn(), on();
	}
	function cn() {
		if (!H(De)) return;
		let e = H(De);
		if (I(De, null), e === "fit") {
			E.scrollLeft = 0, nn();
			return;
		}
		let t = la(e.anchor, H(Rt), Qt(), $t(), tn());
		E.scrollLeft = t ?? aa(E.scrollLeft, $t(), Qt()), nn();
	}
	function ln(e, t) {
		return Kp(H(Rt), e, t);
	}
	function un(e, t, n) {
		return qp(H(Rt), e, t, n);
	}
	function dn(e) {
		let t = Math.min(H(qe) - Ne.right, Math.max(Ne.left, bn(e))), n = E.getBoundingClientRect();
		return Jp(H(Rt), t, e - n.left - E.clientLeft);
	}
	function fn(e, t = null) {
		let n = H(M), r = Xp(H(M), e, H(Ge), H(Wt), t);
		if (I(M, r.spacing, !0), r.adjustment && (I(De, r.adjustment, !0), H(M) === n && cn()), r.immediateAnchor) {
			let e = la(r.immediateAnchor, H(Rt), Qt(), $t(), tn());
			e !== null && sn(e);
		}
	}
	function pn(e, t) {
		if (H(Ue) < 2 || !Number.isFinite(t) || t <= 0) return;
		I(ve, null);
		let n = dn(e);
		fn(Math.min(H(Wt), Math.max(H(Ge), H(Ke) * t)), n);
	}
	function mn(e) {
		pn(E.getBoundingClientRect().left + Qt() / 2, e === "in" ? Pe : 1 / Pe);
	}
	function hn(e, t = !1) {
		if (t || I(ve, null), H(Ue) < 2) return;
		let n = H(Ke);
		if (H(M) === null) {
			let e = Math.min(15, H(Ue));
			e > 1 && (n = H(We) / (e - 1));
		}
		let r = ln(e, Qt() / 2);
		fn(n, r);
	}
	function gn(e, t) {
		let n = xn(e, !0), r = xn(t, !0);
		n !== null && r !== null && _n(n, r);
	}
	function _n(e, t) {
		let n = un(e, t, Qt() / 2);
		if (n) {
			if (I(ve, {
				startCallIndex: e,
				endCallIndex: t
			}, !0), n.intervalCount === 0) {
				hn(e, !0);
				return;
			}
			fn(Math.min(H(Wt), H(We) / n.intervalCount), n.anchor);
		}
	}
	function vn(e, n) {
		let r = t.indexed.itemById.get(e);
		if (!r || r.presence.length === 0) return;
		C("items"), I(ae, "items");
		let i = H(nt) > H(tt) ? (H(tt) + H(nt)) / 2 : NaN, a = n === null ? NaN : H(Et).get(n)?.x ?? NaN, o = B_(r.presence, H(at).columns, Number.isFinite(i) ? i : a, s());
		if (o === null) return;
		let c = ln(o, Qt() / 2);
		if (!c) return;
		let l = la(c, H(Rt), Qt(), $t(), tn());
		l !== null && sn(l);
	}
	function yn(e) {
		if (e.kind === "reveal-item") {
			vn(e.itemId, e.referenceCallIndex);
			return;
		}
		if (e.kind === "fit") {
			I(ve, null), fn(null);
			return;
		}
		if (e.kind === "zoom-in" || e.kind === "zoom-out") {
			mn(e.kind === "zoom-in" ? "in" : "out");
			return;
		}
		if (e.kind === "latest") {
			I(ve, null), sn(sa($t(), Qt()));
			return;
		}
		if (e.kind === "ensure-call") {
			let t = H(Rt).find((t) => t.callIndex === e.callIndex);
			if (!t) return;
			let n = ia(t.x + tn(), E.scrollLeft, Qt(), $t());
			Math.abs(n - E.scrollLeft) > .5 && I(ve, null), sn(n);
			return;
		}
		if (e.kind === "range") {
			_n(e.startCallIndex, e.endCallIndex);
			return;
		}
		if (e.kind === "recent") {
			let n = t.indexed.analysis.modelCalls, r = Math.max(2, Math.floor(H(We) / e.minCallSpacing) + 1);
			if (n.length <= r) {
				I(ve, null), fn(null);
				return;
			}
			_n(n[n.length - r].index, n[n.length - 1].index);
			return;
		}
	}
	function bn(e) {
		let t = D.getBoundingClientRect();
		return Mh(e, t.left, t.width, H(qe));
	}
	function xn(e, t = !1) {
		let n = bn(e);
		if (t) n = Math.min(H(qe) - Ne.right, Math.max(Ne.left, n));
		else if (n < Ne.left || n > H(qe) - Ne.right) return null;
		return jh(n, H(at).columns);
	}
	function Sn(e) {
		return xn(e.clientX);
	}
	function wn(e) {
		let t = X_(ke);
		return ke = t.state, t.suppressed ? (Ae !== null && window.clearTimeout(Ae), Ae = null, e.preventDefault(), e.stopPropagation(), !0) : !1;
	}
	function En() {
		Ae !== null && window.clearTimeout(Ae), Ae = window.setTimeout(() => {
			ke = Z_(ke), Ae = null;
		}, 0);
	}
	function Dn(e) {
		for (let t of e) switch (t.kind) {
			case "capture":
				t.pointerIds.forEach((e) => $p(E, e));
				break;
			case "release":
				t.pointerIds.forEach((e) => em(E, e));
				break;
			case "clear-selection":
				I(Oe, null);
				break;
			case "clear-requested-range":
				I(ve, null);
				break;
			case "selection":
				I(Oe, {
					startClientX: t.startX,
					currentClientX: t.currentX
				});
				break;
			case "scroll":
				sn(t.scrollLeft);
				break;
			case "zoom-range":
				gn(t.startX, t.endX);
				break;
			case "pinch-zoom": {
				let e = E.getBoundingClientRect(), n = {
					...t.anchor,
					offsetFromViewportLeft: t.centerX - e.left - E.clientLeft
				}, r = t.distance / t.startDistance;
				fn(t.startSpacing * r ** 1.7, n);
				break;
			}
			case "suppress-click": En();
		}
	}
	function On(e) {
		return e.target instanceof Node && O !== void 0 && O.contains(e.target);
	}
	function kn(e) {
		if (!On(e)) return;
		let t = Qp(e), n = W_(H_(ke.pointers, t)), r = n ? dn(n.x) : null, i = G_(ke, t, {
			spaceHeld: je,
			scrollLeft: E.scrollLeft,
			callSpacing: H(Ke),
			pinchAnchor: r
		});
		ke = i.state, i.effects.some((e) => e.kind === "prevent-default") && e.preventDefault(), Dn(i.effects);
	}
	function An(e) {
		if (!ke.pointers.some((t) => t.pointerId === e.pointerId)) return;
		let t = K_(ke, Qp(e), { dragThreshold: 7 });
		ke = t.state, Dn(t.effects);
	}
	function jn(e) {
		let t = W_(U_(ke.pointers, e.pointerId)), n = t ? dn(t.x) : null, r = q_(ke, e.pointerId, {
			clientX: e.clientX,
			callSpacing: H(Ke),
			pinchAnchor: n
		});
		ke = r.state, Dn(r.effects);
	}
	function Mn(e) {
		let t = J_(ke, e.pointerId);
		ke = t.state, Dn(t.effects);
	}
	function Nn() {
		let e = Y_(ke);
		ke = e.state, Dn(e.effects), Ae !== null && window.clearTimeout(Ae), Ae = null;
	}
	function Pn(e) {
		On(e) && t.onHoverCall(Sn(e));
	}
	function Fn(e) {
		S({
			..._(),
			economics: {
				..._().economics,
				expanded: e !== "off",
				lastMode: e === "off" ? _().economics.lastMode : e
			}
		});
	}
	function In() {
		return !f() || H(se) === "off" ? !1 : H(le) ? (Kn(), !0) : (Fn("off"), H(b)?.focus({ preventScroll: !0 }), !0);
	}
	function Ln(e) {
		I(ce, e, !0);
	}
	function Rn(e) {
		I(le, e, !0), e === null && I(ge, "");
	}
	function zn() {
		let e = H(le)?.callIndices ?? [];
		if (e.length === 0) return;
		let t = Math.min(...e), n = Math.max(...e);
		t === n ? hn(t) : _n(t, n);
	}
	function Bn(e, t, n, r = null, i) {
		H(ue) === null && (de = r ?? (Hi(E).activeElement instanceof HTMLElement ? Hi(E).activeElement : null));
		let a = r?.getBoundingClientRect(), o = {
			kind: e,
			memberIds: t,
			callIndex: n,
			anchor: i ?? {
				x: a ? (Math.max(8, a.left) + Math.min(window.innerWidth - 8, a.right)) / 2 : 8,
				y: a ? (Math.max(8, a.top) + Math.min(window.innerHeight - 8, a.bottom)) / 2 : 8
			}
		};
		I(ue, o), fe.focusAfterUpdate(() => Hi(E).getElementById("group-breakdown-close"), () => H(ue) !== null && f(), { preventScroll: !0 });
	}
	function Vn(e = !0) {
		let t = de;
		I(ue, null), de = null, fe.cancel(), e && t?.isConnected && fe.focusAfterUpdate(() => t, () => H(ue) === null && f(), { preventScroll: !0 });
	}
	function Hn(e, t, n, r) {
		let i = xn(r.clientX, !0), a = he.getBoundingClientRect(), o = r.clientX - a.left;
		I(me, {
			kind: e,
			total: i === null ? 0 : t?.get(i) ?? 0,
			callIndex: i,
			itemCount: n,
			x: o,
			y: r.clientY - a.top,
			flip: o > a.width - 260
		});
	}
	function Un() {
		C("items"), Vn(!1);
	}
	function Wn() {
		H(le) && (I(ge, Gn(), !0), E && !hh(E, H(le)) && Kn(!1));
	}
	function Gn() {
		return E ? gh(E, H(j), H(le)) : "";
	}
	function Kn(e = !0) {
		H(_e)?.closeEventBreakdown(e);
	}
	function qn(e) {
		let n = t.indexed.analysis.compactions.find((t) => t.beforeModelCall === e);
		n && (Kn(!1), t.onSelectItem(n.summaryItemId), t.indexed.callByIndex.has(e) && t.onPinCall(e));
	}
	function Jn(e) {
		Kn(!1), t.onPinCall(e), pe.focusAfterUpdate(() => Hi(E).getElementById(`economics-call-${e}`), () => f() && t.indexed.callByIndex.has(e));
	}
	function Yn(e, n) {
		wn(e) || (e.stopPropagation(), t.onPinCall(n));
	}
	function Xn(e) {
		if (wn(e) || !On(e)) return;
		let n = Sn(e);
		n !== null && t.onEmptyClick(n);
	}
	function Zn(e, t) {
		wn(e) || (e.stopPropagation(), Qn(t));
	}
	function Qn(e) {
		t.onSelectItem(e);
		let n = t.indexed.itemById.get(e)?.presence[0]?.startCall;
		n !== void 0 && t.indexed.callByIndex.has(n) && t.onPinCall(n);
	}
	function $n(e, n, r) {
		if (wn(e)) return;
		e.stopPropagation();
		let i = xn(e.clientX, !0);
		Bn(n, i === null ? r : r.filter((e) => t.indexed.contextSetByCall.get(i)?.has(e)), i, e.currentTarget instanceof SVGElement ? e.currentTarget : null, {
			x: e.clientX,
			y: e.clientY
		});
	}
	function er(e, n, r) {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			let i = s();
			Bn(n, i === null ? r : r.filter((e) => t.indexed.contextSetByCall.get(i)?.has(e)), i, e.currentTarget instanceof SVGElement ? e.currentTarget : null);
		} else e.key === "Escape" && tr(e);
	}
	function tr(e) {
		(t.onEscape() !== !1 || g()) && (e.preventDefault(), e.stopPropagation());
	}
	function nr(e) {
		e.key === "Escape" ? tr(e) : e.code === "Space" && (e.target === E || e.target === D) && (je = !0, e.preventDefault());
	}
	function rr(e, n) {
		if (![
			"ArrowUp",
			"ArrowDown",
			"Home",
			"End"
		].includes(e.key)) return !1;
		e.preventDefault();
		let r;
		if (n.groupKind !== void 0) r = H(at).ribbons;
		else {
			let e = s() !== null && s() >= n.startCall && s() <= n.endCall ? s() : n.startCall;
			r = (t.indexed.orderedItemIdsByCall.get(e) ?? []).flatMap((t) => H(Mt).get(t)?.filter((t) => t.startCall <= e && e <= t.endCall) ?? []);
		}
		let i = r.findIndex((e) => e.key === n.key), a = e.key === "Home" ? r[0] : e.key === "End" ? r[r.length - 1] : r[i + (e.key === "ArrowUp" ? 1 : -1)];
		return !a || (I(Le, a.key, !0), E?.querySelector(`[data-ribbon-key="${CSS.escape(a.key)}"]`)?.focus({ preventScroll: !0 }), !0);
	}
	function ir(e, t) {
		e.key === "Enter" || e.key === " " ? (e.preventDefault(), Qn(t)) : e.key === "Escape" && tr(e);
	}
	function ar(e, n) {
		e.key === "Enter" || e.key === " " ? (e.preventDefault(), t.onPinCall(n)) : e.key === "Escape" && tr(e);
	}
	function or(e) {
		return e.thinnest * H(ft) < 1;
	}
	function sr(e) {
		return Fo(t.indexed.itemById.get(e), e);
	}
	function cr(e, n, r, i) {
		if (n === "items") return R_(e, r, i);
		let a = t.indexed.itemById.get(e);
		return a ? r.some((t) => t.memberItemIds?.includes(e) && t.points.some((e) => z_(a.presence, e.callIndex) && e.x >= i.left && e.x <= i.right)) : !1;
	}
	var lr = { dismissEconomics: In }, ur = Nv(), dr = R(ur), fr = L(dr), pr = B(L(fr), 2), mr = B(pr, 2);
	N(fr);
	var hr = B(fr, 2), gr = B(L(hr), 2), _r = B(gr, 2);
	N(hr), N(dr);
	var vr = B(dr, 2);
	let br;
	var xr = L(vr), Sr = L(xr);
	J(Sr, 21, () => H(St), (e) => e.value, (e, t) => {
		var n = tv();
		let r, i;
		var a = z(n, !0);
		V((e) => {
			r = _i(n, 1, "vertical-axis-tick svelte-13ao2q1", null, r, {
				top: H(t).position === H(St).length - 1,
				bottom: H(t).position === 0
			}), i = yi(n, "", i, { top: `${H(t).percent}%` }), K(a, e);
		}, [() => xm(H(t).value)]), G(e, n);
	}), N(Sr);
	var Cr = B(Sr, 2), wr = L(Cr), Tr = z(wr), Er = B(wr, 2);
	let Dr;
	var kr = L(Er);
	Y(kr, "height", 500);
	var Ar = L(kr), jr = L(Ar), Mr = (e) => {
		var t = iv(), n = R(t), r = B(n), i = L(r), o = B(i), s = L(o);
		J(s, 17, () => H(at).ribbons, (e) => e.key, (e, t) => {
			var n = nv();
			V((e, r) => {
				Y(n, "d", H(t).path), Y(n, "stroke", e), Y(n, "stroke-width", r);
			}, [() => or(H(t)) ? "black" : "none", () => or(H(t)) ? 1.25 : 0]), G(e, n);
		}), J(B(s), 17, () => H(at).lineageConnectors, (e) => e.key, (e, t) => {
			var n = rv();
			V(() => Y(n, "d", H(t).mergePath)), G(e, n);
		}), N(o), N(r), V(() => {
			Y(n, "id", `${a}-input-hatch`), Y(r, "id", `${a}-input-mask`), Y(r, "x", Ne.left), Y(r, "y", Ne.top), Y(r, "width", H(at).innerWidth), Y(r, "height", H(at).innerHeight), Y(i, "x", Ne.left), Y(i, "y", Ne.top), Y(i, "width", H(at).innerWidth), Y(i, "height", H(at).innerHeight), Y(o, "transform", H(mt));
		}), G(e, t);
	};
	q(jr, (e) => {
		H(yt) && e(Mr);
	});
	var Nr = B(jr);
	J(Nr, 19, () => H(at).lineageConnectors, (e) => e.key, (e, r, i) => {
		var o = av(), s = L(o), c = B(s);
		N(o), V((e, t) => {
			Y(o, "id", `${a}-${H(i)}`), Y(o, "x1", H(r).sourceX), Y(o, "y1", H(r).sourceY), Y(o, "x2", H(r).targetX), Y(o, "y2", H(r).sourceY), Y(s, "stop-color", e), Y(c, "stop-color", t);
		}, [() => Ta(t.indexed, H(r).fromItemId, n()), () => Ta(t.indexed, H(r).toItemId, n())]), G(e, o);
	});
	var Pr = B(Nr);
	N(Ar);
	var Fr = B(Ar), Ir = B(Fr);
	J(Ir, 17, () => H(St), (e) => e.value, (e, t) => {
		var n = ov();
		V(() => {
			Y(n, "x1", Ne.left), Y(n, "x2", H(qe) - Ne.right), Y(n, "y1", H(t).y), Y(n, "y2", H(t).y);
		}), G(e, n);
	});
	var W = B(Ir);
	J(W, 19, () => H(at).columns, (e) => e.callIndex, (e, t, n) => {
		var r = Br(), i = R(r), a = (e) => {
			var n = sv();
			V(() => {
				Y(n, "x1", H(t).x), Y(n, "x2", H(t).x), Y(n, "y1", Ne.top), Y(n, "y2", 500 - Ne.bottom);
			}), G(e, n);
		}, o = /* @__PURE__ */ P(() => H(Vt).has(H(n)));
		q(i, (e) => {
			H(o) && e(a);
		}), G(e, r);
	});
	var Lr = B(W);
	J(Lr, 17, () => H(at).compactions, (e) => e.compactionId, (e, t) => {
		var n = cv(), r = L(n), i = z(r), a = B(r), o = B(a), s = z(o, !0);
		N(n), V(() => {
			Y(n, "aria-label", `Compaction before call ${H(t).beforeModelCall}`), K(i, `Compaction before call ${H(t).beforeModelCall ?? ""}`), Y(a, "x1", H(t).x), Y(a, "x2", H(t).x), Y(a, "y1", Ne.top - 8), Y(a, "y2", 500 - Ne.bottom), Y(o, "x", H(t).x + 5), Y(o, "y", Ne.top - 13), K(s, H(zt) < 64 ? "C" : "COMPACT");
		}), G(e, n);
	});
	var Rr = B(Lr), Vr = L(Rr);
	J(Vr, 19, () => H(at).lineageConnectors, (e) => e.key, (e, t, n) => {
		var r = lv();
		V(() => {
			Y(r, "d", H(t).mergePath), Y(r, "fill", `url(#${a}-${H(n)})`);
		}), G(e, r);
	}), J(B(Vr), 17, () => H(at).ribbons, (e) => e.key, (e, r) => {
		let i = /* @__PURE__ */ P(() => H(r).groupKind !== void 0), a = /* @__PURE__ */ P(() => H(r).groupKind ? wa(H(r).groupKind, n()) : Ta(t.indexed, H(r).itemId, n())), o = /* @__PURE__ */ P(() => H(i) ? `Item type ${No(H(r).groupKind)} · ${H(r).memberItemIds?.length ?? 0} items` : sr(H(r).itemId));
		var s = dv();
		let c;
		var u = L(s);
		let d;
		var f = B(u), p = L(f), m = (e) => {
			var t = uv(), n = z(t, !0);
			V(() => K(n, H(o))), G(e, t);
		};
		q(p, (e) => {
			H(i) || e(m);
		}), N(f), N(s), V((e, n, p) => {
			c = _i(s, 0, "ribbon-group svelte-13ao2q1", null, c, {
				"group-ribbon": H(i),
				selected: !H(i) && l() === H(r).itemId,
				unknown: t.indexed.analysis.displayWeightUnit === "unavailable"
			}), d = _i(u, 0, "ribbon svelte-13ao2q1", null, d, { subpixel: e }), Y(u, "d", H(r).path), Y(u, "fill", t.indexed.analysis.displayWeightUnit === "unavailable" ? "url(#unknown-geometry)" : H(a)), Y(u, "stroke", n), Y(u, "stroke-width", p), Y(f, "d", H(r).hitPath), Y(f, "tabindex", H(r).key === H(Nt) ? 0 : -1), Y(f, "data-ribbon-key", H(r).key), Y(f, "aria-label", H(o)), Y(f, "aria-pressed", !H(i) && l() === H(r).itemId);
		}, [
			() => or(H(r)),
			() => or(H(r)) ? H(a) : "none",
			() => or(H(r)) ? 1.25 : 0
		]), Or("pointerenter", f, (e) => H(i) ? Hn(H(r).groupKind, H(r).valueByCall, H(r).memberItemIds?.length ?? 0, e) : t.onHoverItem(H(r).itemId, e)), U("pointermove", f, (e) => H(i) ? Hn(H(r).groupKind, H(r).valueByCall, H(r).memberItemIds?.length ?? 0, e) : t.onHoverItem(H(r).itemId, e)), Or("pointerleave", f, () => {
			H(i) ? I(me, null) : t.onHoverItem(null);
		}), U("mousedown", f, (e) => {
			H(i) && e.preventDefault();
		}), U("click", f, (e) => H(i) ? $n(e, H(r).groupKind, H(r).memberItemIds ?? []) : Zn(e, H(r).itemId)), Or("focus", f, () => I(Le, H(r).key, !0)), U("keydown", f, (e) => {
			rr(e, H(r)) || (H(i) ? er(e, H(r).groupKind, H(r).memberItemIds ?? []) : ir(e, H(r).itemId));
		}), G(e, s);
	}), N(Rr);
	var Hr = B(Rr), Ur = (e) => {
		var t = mv();
		J(t, 21, () => H(vt), ei, (e, t) => {
			var n = pv(), r = R(n), i = (e) => {
				var n = fv();
				V(() => {
					Y(n, "d", H(t).fill), Y(n, "fill", `url(#${a}-input-hatch)`), Y(n, "mask", `url(#${a}-input-mask)`);
				}), G(e, n);
			};
			q(r, (e) => {
				H(yt) && H(t).fill && e(i);
			});
			var o = B(r);
			V(() => Y(o, "d", H(t).line)), G(e, n);
		}), N(t), G(e, t);
	};
	q(Hr, (e) => {
		H(Ye).size > 0 && e(Ur);
	}), N(kr), Ri(kr, (e) => D = e, () => D);
	var Wr = B(kr, 2);
	Y(Wr, "height", 500);
	var Gr = L(Wr);
	J(Gr, 19, () => H(at).columns, (e) => e.callIndex, (e, n, r) => {
		var i = Br(), a = R(i), o = (e) => {
			var r = hv();
			let i;
			var a = L(r), o = B(a);
			Y(o, "y", 483);
			var c = z(o, !0);
			N(r), V(() => {
				i = _i(r, 0, "call-target svelte-13ao2q1", null, i, {
					condensed: H(Bt) > 1,
					pinned: s() === H(n).callIndex
				}), Y(r, "data-call-index", H(n).callIndex), Y(r, "tabindex", H(n).callIndex === H(It) ? 0 : -1), Y(r, "aria-label", `Pin model call ${H(n).callIndex}`), Y(a, "x", H(n).x - 22), Y(a, "y", 500 - Ne.bottom + 5), Y(o, "x", H(n).x), K(c, H(n).callIndex);
			}), U("keydown", r, (e) => ar(e, H(n).callIndex)), U("click", r, (e) => {
				wn(e) || (e.stopPropagation(), t.onPinCall(H(n).callIndex));
			}), G(e, r);
		}, c = /* @__PURE__ */ P(() => H(Pt).has(H(r)));
		q(a, (e) => {
			H(c) && e(o);
		}), G(e, i);
	});
	var Kr = B(Gr), qr = L(Kr);
	J(qr, 17, () => H(Lt), ({ connector: e, index: t }) => e.key, (e, t) => {
		let n = () => H(t).connector, r = () => H(t).index;
		var i = _v(), o = R(i);
		let s;
		var c = B(o), l = (e) => {
			var t = gv();
			V(() => Y(t, "d", n().path)), G(e, t);
		};
		q(c, (e) => {
			n().fromItemId === H(At) && e(l);
		}), V(() => {
			s = _i(o, 0, "compaction-merge-emphasis svelte-13ao2q1", null, s, { emphasized: n().fromItemId === H(At) }), Y(o, "d", n().mergePath), Y(o, "fill", `url(#${a}-${r()})`);
		}), G(e, i);
	});
	var Jr = B(qr), Yr = (e) => {
		var r = vv();
		V((e) => {
			Y(r, "d", H(Ot).path), Y(r, "fill", e);
		}, [() => Ta(t.indexed, H(Ot).itemId, n())]), G(e, r);
	};
	q(Jr, (e) => {
		H(Ot) && H(Ot) !== H(kt) && e(Yr);
	});
	var Xr = B(Jr), Zr = (e) => {
		var r = yv();
		V((e) => {
			Y(r, "d", H(kt).path), Y(r, "fill", e);
		}, [() => Ta(t.indexed, H(kt).itemId, n())]), G(e, r);
	};
	q(Xr, (e) => {
		H(kt) && e(Zr);
	}), J(B(Xr), 17, () => H(at).versionMarks, (e) => e.key, (e, t) => {
		var n = bv();
		V(() => {
			Y(n, "x1", H(t).x), Y(n, "x2", H(t).x), Y(n, "y1", H(t).y0), Y(n, "y2", H(t).y1);
		}), G(e, n);
	}), N(Kr);
	var Qr = B(Kr), $r = (e) => {
		var t = xv();
		V(() => {
			Y(t, "x", H(qt).x), Y(t, "y", Ne.top), Y(t, "width", H(qt).width), Y(t, "height", H(at).innerHeight);
		}), G(e, t);
	};
	q(Qr, (e) => {
		H(qt) && H(qt).width > 0 && e($r);
	});
	var ti = B(Qr), ni = (e) => {
		let t = /* @__PURE__ */ P(() => H(Et).get(c()));
		var n = Br(), r = R(n), i = (e) => {
			var n = Sv();
			V(() => {
				Y(n, "x1", H(t).x), Y(n, "x2", H(t).x), Y(n, "y1", Ne.top), Y(n, "y2", 500 - Ne.bottom);
			}), G(e, n);
		};
		q(r, (e) => {
			H(t) && e(i);
		}), G(e, n);
	};
	q(ti, (e) => {
		c() !== null && e(ni);
	});
	var ri = B(ti), ii = (e) => {
		let t = /* @__PURE__ */ P(() => H(Et).get(s()));
		var n = Br(), r = R(n), i = (e) => {
			var n = Cv();
			V(() => {
				Y(n, "x1", H(t).x), Y(n, "x2", H(t).x), Y(n, "y1", Ne.top), Y(n, "y2", 500 - Ne.bottom);
			}), G(e, n);
		};
		q(r, (e) => {
			H(t) && e(i);
		}), G(e, n);
	};
	q(ri, (e) => {
		s() !== null && e(ii);
	}), N(Wr), N(Er), Ri(Er, (e) => O = e, () => O);
	var ai = B(Er, 2), oi = (e) => {
		var t = wv();
		let r, i;
		var a = L(t), o = z(a, !0), s = B(a, 2), c = z(s), l = z(B(s, 2));
		N(t), V((e, n, a, s) => {
			r = _i(t, 1, "group-hover-card svelte-13ao2q1", null, r, { flip: H(me).flip }), i = yi(t, "", i, {
				left: `${H(me).x}px`,
				top: `${H(me).y}px`,
				"--group-color": e
			}), K(o, n), K(c, `${a ?? ""}
            ${H(Ct) ?? ""} at call ${H(me).callIndex ?? "—" ?? ""}`), K(l, `${s ?? ""} items`);
		}, [
			() => wa(H(me).kind, n()),
			() => No(H(me).kind),
			() => xm(H(me).total),
			() => H(me).itemCount.toLocaleString()
		]), G(e, t);
	};
	q(ai, (e) => {
		H(me) && e(oi);
	});
	var si = B(ai, 2), ci = (e) => {
		var t = Ev();
		J(B(L(t), 2), 17, () => [...new Set(H(at).ribbons.map((e) => e.groupKind).filter(Boolean))], ei, (e, t) => {
			var r = Tv(), i = L(r), a = B(i, 1, !0);
			N(r), V((e, t) => {
				yi(i, e), K(a, t);
			}, [() => `background:${wa(H(t), n())}`, () => No(H(t))]), G(e, r);
		}), N(t), G(e, t);
	};
	q(si, (e) => {
		H(ae) === "itemTypes" && e(ci);
	});
	var li = B(si, 2), di = (e) => {
		var t = jv(), n = B(L(t), 2), r = (e) => {
			var t = Dv();
			va(B(L(t), 2), {
				id: "unreconciled-input-note",
				label: "About unreconciled input",
				children: (e, t) => {
					be(), G(e, zr("The reported input minus the content estimated in the River. It can include request\n                framing and estimation differences. It is not lost content, and it is not attributed\n                to cost."));
				},
				$$slots: { default: !0 }
			}), N(t), G(e, t);
		};
		q(n, (e) => {
			H(yt) && e(r);
		});
		var i = B(n, 2), a = (e) => {
			var t = Ov(), n = L(t), r = B(n), i = (e) => {
				var t = zr();
				V((e) => K(t, `estimate
                exceeds reported by ~${e ?? ""}`), [() => xm(H(bt).reconstructed - H(bt).reported)]), G(e, t);
			}, a = (e) => {
				var t = zr();
				V((e) => K(t, `unreconciled ~${e ?? ""}`), [() => xm(H(bt).gap)]), G(e, t);
			};
			q(r, (e) => {
				H(bt).reconstructed > H(bt).reported ? e(i) : e(a, -1);
			}), be(), N(t), V((e, t) => K(n, `Call ${H(bt).callIndex ?? ""}: reconstructed ${e ?? ""} · reported ${t ?? ""} · `), [() => xm(H(bt).reconstructed), () => xm(H(bt).reported)]), G(e, t);
		}, o = (e) => {
			var t = kv(), n = z(t);
			V(() => K(n, `Call ${s() ?? c() ?? ""}: input comparison unavailable`)), G(e, t);
		}, l = (e) => {
			G(e, Av());
		};
		q(i, (e) => {
			H(bt) ? e(a) : s() !== null || c() !== null ? e(o, 1) : e(l, -1);
		}), N(t), G(e, t);
	};
	q(li, (e) => {
		H(Ye).size > 0 && e(di);
	});
	var fi = B(li, 2);
	{
		let e = /* @__PURE__ */ P(() => t.indexed.analysis.session.costSummary.apiEquivalent.calls > 0);
		Ah(fi, {
			get mode() {
				return H(se);
			},
			get lastMode() {
				return _().economics.lastMode;
			},
			get cacheView() {
				return H(oe);
			},
			get cachePresentation() {
				return H(ht);
			},
			get costCopy() {
				return H(Re);
			},
			get hasApiEquivalentCost() {
				return H(e);
			},
			onModeChange: Fn,
			onCacheViewChange: T,
			get headerElement() {
				return H(x);
			},
			set headerElement(e) {
				I(x, e, !0);
			},
			get triggerElement() {
				return H(b);
			},
			set triggerElement(e) {
				I(b, e, !0);
			}
		});
	}
	var pi = B(fi, 2), mi = (e) => {
		Ri(nh(e, {
			get indexed() {
				return t.indexed;
			},
			get columns() {
				return H(at).columns;
			},
			get width() {
				return H(qe);
			},
			get mode() {
				return H(se);
			},
			get cacheView() {
				return H(oe);
			},
			get pinnedCallIndex() {
				return s();
			},
			get hoveredCallIndex() {
				return c();
			},
			get onPinCall() {
				return t.onPinCall;
			},
			get onHoverCall() {
				return t.onHoverCall;
			},
			onMarkClick: Yn,
			onReadoutChange: Ln,
			onEventBreakdownChange: Rn
		}), (e) => I(_e, e, !0), () => H(_e));
	};
	q(pi, (e) => {
		H(se) !== "off" && e(mi);
	}), N(Cr), Ri(Cr, (e) => E = e, () => E), N(xr), Ri(xr, (e) => he = e, () => he);
	var hi = B(xr, 2), gi = (e) => {
		{
			let t = /* @__PURE__ */ P(() => No(H(ue).kind));
			fh(e, {
				get label() {
					return H(t);
				},
				get anchor() {
					return H(ue).anchor;
				},
				get memberLabels() {
					return H(ze);
				},
				get memberCount() {
					return H(ue).memberIds.length;
				},
				get callIndex() {
					return H(ue).callIndex;
				},
				onClose: () => Vn(),
				onShowItems: Un
			});
		}
	};
	q(hi, (e) => {
		H(ue) && e(gi);
	});
	var vi = B(hi, 2), bi = (e) => {
		sh(e, {
			get breakdown() {
				return H(le);
			},
			get positionStyle() {
				return H(ge);
			},
			get canZoomIn() {
				return H(Gt);
			},
			onClose: () => Kn(),
			onZoom: zn,
			onInspect: Jn,
			onInspectCompaction: qn,
			get element() {
				return H(j);
			},
			set element(e) {
				I(j, e, !0);
			}
		});
	};
	q(vi, (e) => {
		H(le) && e(bi);
	});
	var xi = B(vi, 2), Si = (e) => {
		var t = Mv(), n = z(t, !0);
		V(() => K(n, H(ce) || "Hover or focus a call for an exact readout.")), G(e, t);
	};
	q(xi, (e) => {
		H(se) !== "off" && e(Si);
	}), N(vr), V(() => {
		Y(pr, "aria-pressed", H(ie) === "session"), Y(mr, "aria-pressed", H(ie) === "visible"), Y(gr, "aria-pressed", H(ae) === "items"), Y(_r, "aria-pressed", H(ae) === "itemTypes"), br = yi(vr, "", br, { "--plot-left": `${Ne.left}px` }), Y(Sr, "aria-label", H(Tt)), yi(Sr, `top:${Ne.top}px;height:${H(at).innerHeight}px`), K(Tr, `Context items flow horizontally through model calls. Tab reaches one context item and one
        call label; Up and Down arrows move between items in the stack, Home and End move to its
        bottom and top, Left and Right arrows move between calls, and Enter selects. Dashed vertical
        markers indicate compaction. In individual-item view, colour-blended connections show lossy
        summarization, not conserved tokens or source contributions to the summary. ${H(wt) ?? ""}.
        ${H(Ye).size > 0 ? "The dashed reported-input reference is recorded after each call. Hatched unreconciled input is its approximate excess over reconstructed content, not recovered items or cost attribution. Where a session does not record its system prompt or tools, an Unrecorded request context item is measured from the reported input at the first call and after each compaction or model change, so the hatching shows change since then. Scaling includes the reference. Missing comparisons break the line." : ""}
        ${t.indexed.analysis.displayWeightUnit === "unavailable" ? "Token geometry is unavailable; ribbon regions are structural placeholders, not measured token widths." : ""}`), Dr = yi(Er, "", Dr, { width: `${H(qe)}px` }), Y(kr, "viewBox", `0 0 ${H(qe)} 500`), Y(kr, "width", H(qe)), Y(Pr, "patternTransform", `matrix(${1 / (H(it).scale || 1)} 0 0 ${1 / H(ft)} ${-H(it).offset / (H(it).scale || 1)} ${-H(pt) / H(ft)}) rotate(35)`), Y(Fr, "x", Ne.left), Y(Fr, "y", Ne.top), Y(Fr, "width", H(at).innerWidth), Y(Fr, "height", H(at).innerHeight), Y(Rr, "transform", H(mt)), Y(Wr, "viewBox", `0 0 ${H(qe)} 500`), Y(Wr, "width", H(qe)), Y(Kr, "transform", H(mt));
	}), U("click", pr, () => w("session")), U("click", mr, () => w("visible")), U("click", gr, () => C("items")), U("click", _r, () => C("itemTypes")), U("pointerdown", Cr, kn), U("pointermove", Cr, Pn), Or("selectstart", Cr, (e) => e.preventDefault()), Or("pointerleave", Cr, () => {
		t.onHoverCall(null), t.onHoverItem(null);
	}), U("keydown", Cr, nr), U("click", Cr, Xn), Or("pointerleave", Er, () => t.onHoverCall(null)), G(e, ur);
	var Ci = Ve(lr);
	return i(), Ci;
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
var Iv = /* @__PURE__ */ W("<span class=\"model svelte-182syzp\"> </span> <button type=\"button\" class=\"svelte-182syzp\">View details</button>", 1), Lv = /* @__PURE__ */ W("<p class=\"empty svelte-182syzp\"> </p>"), Rv = /* @__PURE__ */ W("<small class=\"svelte-182syzp\"> </small>"), zv = /* @__PURE__ */ W("<p class=\"empty svelte-182syzp\">No items added or dropped.</p>"), Bv = /* @__PURE__ */ W("<li class=\"svelte-182syzp\"><span class=\"change added svelte-182syzp\" aria-hidden=\"true\">+</span> <button type=\"button\" class=\"svelte-182syzp\"><span class=\"visually-hidden svelte-182syzp\">Added</span> </button> <span class=\"size svelte-182syzp\"> </span></li>"), Vv = /* @__PURE__ */ W("<li class=\"more svelte-182syzp\"> </li>"), Hv = /* @__PURE__ */ W("<li class=\"svelte-182syzp\"><span class=\"change dropped svelte-182syzp\" aria-hidden=\"true\">−</span> <button type=\"button\" class=\"svelte-182syzp\"><span class=\"visually-hidden svelte-182syzp\">Dropped</span> </button> <span class=\"size svelte-182syzp\"> </span></li>"), Uv = /* @__PURE__ */ W("<ul role=\"list\" class=\"svelte-182syzp\"><!> <!> <!> <!></ul>"), Wv = /* @__PURE__ */ W("<p class=\"empty svelte-182syzp\">No item estimates at this call.</p>"), Gv = /* @__PURE__ */ W("<li class=\"svelte-182syzp\"><button type=\"button\" class=\"svelte-182syzp\"> </button> <span class=\"size svelte-182syzp\"> </span></li>"), Kv = /* @__PURE__ */ W("<ol role=\"list\" class=\"svelte-182syzp\"></ol> <button type=\"button\" class=\"link svelte-182syzp\">Show all in Composition</button>", 1), qv = /* @__PURE__ */ W("<span> </span>"), Jv = /* @__PURE__ */ W("<div class=\"tools svelte-182syzp\"><h3 class=\"svelte-182syzp\">Tools invoked after this response</h3> <div class=\"tool-list svelte-182syzp\"></div></div>"), Yv = /* @__PURE__ */ W("<dl class=\"figures svelte-182syzp\"><div><dt class=\"svelte-182syzp\">Call</dt> <dd class=\"svelte-182syzp\"> </dd></div> <div><dt class=\"svelte-182syzp\">Input</dt> <dd class=\"svelte-182syzp\"> <!></dd></div> <div><dt class=\"svelte-182syzp\">Cost</dt> <dd class=\"svelte-182syzp\"> </dd></div></dl> <div><div><h3 title=\"Highwater's token estimates; they need not match the reported change in input.\" class=\"svelte-182syzp\"> </h3> <!></div> <div><h3 class=\"svelte-182syzp\">Largest items in context</h3> <!></div></div> <!>", 1), Xv = /* @__PURE__ */ W("<section class=\"panel call-overview svelte-182syzp\" aria-labelledby=\"call-overview-heading\"><div class=\"heading svelte-182syzp\"><h2 id=\"call-overview-heading\" class=\"svelte-182syzp\"> </h2> <!></div> <!></section>"), Zv = {
	hash: "svelte-182syzp",
	code: ".panel.svelte-182syzp {background:var(--surface);border-radius:var(--radius);padding:var(--panel-padding);min-width:0;}.heading.svelte-182syzp {display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px;}h2.svelte-182syzp {margin:0;font-size:var(--text-lg);}.model.svelte-182syzp {color:var(--secondary);font-size:var(--text-sm);overflow-wrap:anywhere;}.heading.svelte-182syzp button:where(.svelte-182syzp) {margin-left:auto;}.figures.svelte-182syzp {display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:8px 16px;margin:12px 0 0;}.figures.svelte-182syzp dt:where(.svelte-182syzp) {color:var(--secondary);font-size:var(--text-sm);}.figures.svelte-182syzp dd:where(.svelte-182syzp) {margin:0;color:var(--text-strong);font-weight:600;font-variant-numeric:tabular-nums;}.figures.svelte-182syzp small:where(.svelte-182syzp) {margin-left:4px;color:var(--secondary);font-weight:400;}.lists.svelte-182syzp {display:grid;grid-template-columns:minmax(0, 1fr);gap:12px 24px;margin-top:14px;}.lists.two-columns.svelte-182syzp {grid-template-columns:repeat(2, minmax(0, 1fr));}h3.svelte-182syzp {margin:0 0 6px;color:var(--text-strong);font-size:var(--text-sm);}ul.svelte-182syzp,\n  ol.svelte-182syzp {margin:0;padding:0;list-style:none;}li.svelte-182syzp {display:flex;align-items:baseline;gap:6px;min-width:0;padding:2px 0;}li.svelte-182syzp button:where(.svelte-182syzp) {min-width:0;padding:0;overflow:hidden;border:0;background:transparent;color:var(--text);text-align:left;text-overflow:ellipsis;white-space:nowrap;}li.svelte-182syzp button:where(.svelte-182syzp):hover {color:var(--accent);text-decoration:underline;}.change.svelte-182syzp {flex:none;width:1ch;font-weight:700;}.added.svelte-182syzp {color:var(--accent);}.dropped.svelte-182syzp {color:var(--secondary);}.size.svelte-182syzp {flex:none;margin-left:auto;color:var(--secondary);font-size:var(--text-sm);font-variant-numeric:tabular-nums;}.more.svelte-182syzp,\n  .empty.svelte-182syzp {color:var(--secondary);font-size:var(--text-sm);}.empty.svelte-182syzp {margin:8px 0 0;}.link.svelte-182syzp {margin-top:6px;padding:0;border:0;background:transparent;color:var(--accent);font-size:var(--text-sm);}.tools.svelte-182syzp {margin-top:14px;}.tool-list.svelte-182syzp {display:flex;flex-wrap:wrap;gap:6px;}.tool-chip.svelte-182syzp {padding:2px 8px;border:1px solid var(--separator);border-radius:999px;font-size:var(--text-sm);}.tool-chip.failed.svelte-182syzp {border-color:var(--error);color:var(--error);}.visually-hidden.svelte-182syzp {position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;}"
};
function Qv(e, t) {
	Be(t, !0), ui(e, Zv);
	let n = X(t, "following", 3, !1), r = X(t, "twoColumns", 3, !1), i = X(t, "onSelectItem", 3, () => {}), a = X(t, "onViewDetails", 3, () => {}), o = X(t, "onShowComposition", 3, () => {}), s = /* @__PURE__ */ P(() => {
		if (!t.call) return null;
		let e = t.indexed.analysis.modelCalls.findIndex((e) => e.index === t.call.index);
		return e > 0 ? t.indexed.analysis.modelCalls[e - 1] : null;
	}), c = /* @__PURE__ */ P(() => t.call?.reportedPromptTokens != null && H(s)?.reportedPromptTokens != null ? t.call.reportedPromptTokens - H(s).reportedPromptTokens : null), l = /* @__PURE__ */ P(() => Fu(t.indexed, t.call?.addedItemIds ?? [], t.call)), u = /* @__PURE__ */ P(() => Fu(t.indexed, t.call?.droppedItemIds ?? [], H(s))), d = /* @__PURE__ */ P(() => Iu(t.call?.addedItemIds ?? [], H(l).items)), f = /* @__PURE__ */ P(() => Iu(t.call?.droppedItemIds ?? [], H(u).items)), p = /* @__PURE__ */ P(() => t.call ? Ko(Qo(t.indexed, t.call.index)?.items ?? []).slice(0, 5) : []), m = /* @__PURE__ */ P(() => {
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
		return Fo(t.indexed.itemById.get(e), e);
	}
	function g(e, t, n) {
		return e === 0 ? `0 ${t}` : `${Q(e)} ${t} (≈ ${Z(n.total)}${n.complete ? "" : ", partial"})`;
	}
	function _(e) {
		return `${e > 0 ? "+" : e < 0 ? "−" : "±"}${Z(Math.abs(e))}`;
	}
	var v = Xv(), y = L(v), b = L(y), x = z(b, !0), S = B(b, 2), ee = (e) => {
		var n = Iv(), r = R(n), i = z(r), o = B(r, 2);
		V(() => K(i, `${t.call.provider ?? "Unknown provider" ?? ""} / ${t.call.model ?? "Unknown model" ?? ""}`)), U("click", o, function(...e) {
			a()?.apply(this, e);
		}), G(e, n);
	};
	q(S, (e) => {
		t.call && e(ee);
	}), N(y);
	var C = B(y, 2), w = (e) => {
		var n = Lv(), r = z(n, !0);
		V(() => K(r, t.indexed.analysis.modelCalls.length === 0 ? "No model calls yet." : "Select a call in the chart to see it here.")), G(e, n);
	}, T = (e) => {
		var n = Yv(), a = R(n), v = L(a), y = z(B(L(v), 2));
		N(v);
		var b = B(v, 2), x = B(L(b), 2), S = L(x), ee = B(S), C = (e) => {
			var t = Rv(), n = z(t, !0);
			V((e) => {
				Y(t, "title", `Change since call ${H(s)?.index}`), K(n, e);
			}, [() => _(H(c))]), G(e, t);
		};
		q(ee, (e) => {
			H(c) !== null && !t.call.usage.placeholder && e(C);
		}), N(x), N(b);
		var w = B(b, 2), T = z(B(L(w), 2), !0);
		N(w), N(a);
		var E = B(a, 2);
		let D;
		var O = L(E), k = L(O), te = z(k), A = B(k, 2), ne = (e) => {
			G(e, zv());
		}, re = (e) => {
			var n = Uv(), r = L(n);
			J(r, 16, () => H(d).slice(0, 5), (e) => e, (e, t) => {
				let n = /* @__PURE__ */ P(() => H(l).items.get(t));
				var r = Bv(), a = B(L(r), 2), o = B(L(a), 1, !0);
				N(a);
				var s = B(a, 2), c = z(s, !0);
				N(r), V((e, t) => {
					K(o, e), Y(s, "title", H(n)?.partial ? "Partial or missing estimate" : void 0), K(c, t);
				}, [() => h(t), () => H(n)?.tokens == null ? "Unknown" : Z(H(n).tokens)]), U("click", a, () => i()(t)), G(e, r);
			});
			var a = B(r, 2), o = (e) => {
				var n = Vv(), r = z(n);
				V((e) => K(r, `${e ?? ""} more added`), [() => Q(t.call.addedItemIds.length - 5)]), G(e, n);
			};
			q(a, (e) => {
				t.call.addedItemIds.length > 5 && e(o);
			});
			var s = B(a, 2);
			J(s, 16, () => H(f).slice(0, 5), (e) => e, (e, t) => {
				let n = /* @__PURE__ */ P(() => H(u).items.get(t));
				var r = Hv(), a = B(L(r), 2), o = B(L(a), 1, !0);
				N(a);
				var s = B(a, 2), c = z(s, !0);
				N(r), V((e, t) => {
					K(o, e), Y(s, "title", H(n)?.partial ? "Partial or missing estimate" : void 0), K(c, t);
				}, [() => h(t), () => H(n)?.tokens == null ? "Unknown" : Z(H(n).tokens)]), U("click", a, () => i()(t)), G(e, r);
			});
			var c = B(s, 2), p = (e) => {
				var n = Vv(), r = z(n);
				V((e) => K(r, `${e ?? ""} more dropped`), [() => Q(t.call.droppedItemIds.length - 5)]), G(e, n);
			};
			q(c, (e) => {
				t.call.droppedItemIds.length > 5 && e(p);
			}), N(n), G(e, n);
		};
		q(A, (e) => {
			t.call.addedItemIds.length === 0 && t.call.droppedItemIds.length === 0 ? e(ne) : e(re, -1);
		}), N(O);
		var ie = B(O, 2), ae = B(L(ie), 2), oe = (e) => {
			G(e, Wv());
		}, se = (e) => {
			var t = Kv(), n = R(t);
			J(n, 21, () => H(p), (e) => e.id, (e, t) => {
				var n = Gv(), r = L(n), a = z(r, !0), o = z(B(r, 2));
				N(n), V((e, n) => {
					K(a, H(t).label), K(o, `${e ?? ""}${n ?? ""}`);
				}, [() => Z(H(t).tokens), () => H(t).share === null ? "" : ` · ${Ha(H(t).share)}`]), U("click", r, () => i()(H(t).id)), G(e, n);
			}), N(n), U("click", B(n, 2), function(...e) {
				o()?.apply(this, e);
			}), G(e, t);
		};
		q(ae, (e) => {
			H(p).length === 0 ? e(oe) : e(se, -1);
		}), N(ie), N(E);
		var ce = B(E, 2), le = (e) => {
			var t = Jv(), n = B(L(t), 2);
			J(n, 21, () => H(m), (e) => e.name, (e, t) => {
				var n = qv();
				let r;
				var i = z(n);
				V(() => {
					r = _i(n, 1, "tool-chip svelte-182syzp", null, r, { failed: H(t).failed }), K(i, `${H(t).name ?? ""}${H(t).count > 1 ? ` × ${H(t).count}` : ""}${H(t).failed ? " · failed" : ""}`);
				}), G(e, n);
			}), N(n), N(t), G(e, t);
		};
		q(ce, (e) => {
			H(m).length > 0 && e(le);
		}), V((e, n, i, a, o) => {
			K(y, `${t.call.index ?? ""} of ${e ?? ""}`), K(S, `${n ?? ""} `), K(T, i), D = _i(E, 1, "lists svelte-182syzp", null, D, { "two-columns": r() }), K(te, `Context changes · ${a ?? ""} · ${o ?? ""}`);
		}, [
			() => Q(t.indexed.analysis.modelCalls.length),
			() => t.call.usage.placeholder ? "Unavailable" : Z(t.call.reportedPromptTokens),
			() => t.call.usage.placeholder ? "Unavailable" : tu(t.call.costAssessment),
			() => g(t.call.addedItemIds.length, "added", H(l)),
			() => g(t.call.droppedItemIds.length, "dropped", H(u))
		]), G(e, n);
	};
	q(C, (e) => {
		t.call ? e(T, -1) : e(w);
	}), N(v), V(() => K(x, t.call ? n() ? "Latest call" : `Call ${t.call.index}` : "Latest call")), G(e, v), Ve();
}
kr(["click"]);
//#endregion
//#region src/lib/state/session-sections.ts
var $v = [
	"summary",
	"call",
	"chart",
	"details",
	"lifespans"
], ey = [
	"summary",
	"chart",
	"details",
	"lifespans"
], ty = [
	"summary",
	"call",
	"chart",
	"details",
	"lifespans"
];
function ny(e, t = ey) {
	let n = [];
	for (let r of e ?? t) $v.includes(r) && !n.includes(r) && n.push(r);
	return t.forEach((e, r) => {
		if (n.includes(e)) return;
		let i = t.slice(0, r).reverse().find((e) => n.includes(e));
		n.splice(i === void 0 ? 0 : n.indexOf(i) + 1, 0, e);
	}), n;
}
var ry = /* @__PURE__ */ new Set(["summary", "call"]);
function iy(e) {
	let t = /* @__PURE__ */ new Map(), n = e.indexOf("details"), r = (e) => e !== void 0 && !ry.has(e), i = n >= 0 && (r(e[n - 1]) || r(e[n + 1])), a = i ? e.filter((e) => e !== "details") : e;
	if (a.forEach((e, n) => t.set(e, {
		column: ry.has(e) || e === "details" ? "1 / -1" : "1",
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
var ay = /* @__PURE__ */ W("<div class=\"summary-section svelte-okw1rh\"><!></div>"), oy = /* @__PURE__ */ W("<div class=\"call-section svelte-okw1rh\"><!></div>"), sy = /* @__PURE__ */ W("<button type=\"button\" aria-label=\"Copy view link\"> </button>"), cy = /* @__PURE__ */ W("<p class=\"river-pending svelte-okw1rh\" role=\"status\">Drawing the River…</p>"), ly = /* @__PURE__ */ W("<div class=\"selection-location-note svelte-okw1rh\" role=\"status\"><span>The selected item has no presence in the current River view.</span> <button type=\"button\">Reveal in River</button> <button type=\"button\">Clear item</button></div>"), uy = /* @__PURE__ */ W("<div class=\"item-hover-position svelte-okw1rh\"><!></div>"), dy = /* @__PURE__ */ W("<!> <div class=\"chart-area svelte-okw1rh\"><!> <!> <!></div>", 1), fy = /* @__PURE__ */ W("<div class=\"no-model-calls svelte-okw1rh\"><h3 class=\"svelte-okw1rh\">No model calls</h3> <p class=\"svelte-okw1rh\">This session has no completed assistant model responses on its current branch.</p> <p class=\"svelte-okw1rh\">Terminal compaction summaries, if present, remain available in Context lifespans.</p></div>"), py = /* @__PURE__ */ W("<section class=\"panel river-panel svelte-okw1rh\"><div class=\"panel-head svelte-okw1rh\"><div class=\"svelte-okw1rh\"><h2 class=\"svelte-okw1rh\"> </h2> <!></div> <div class=\"panel-actions svelte-okw1rh\"><!> <a class=\"mobile-view-details svelte-okw1rh\" href=\"#selected-item-summary\" aria-label=\"View details\"> </a> <button type=\"button\"> </button></div></div> <div class=\"visualization-tabs svelte-okw1rh\" role=\"tablist\" aria-label=\"Context visualization\"><button id=\"river-tab\" type=\"button\" role=\"tab\" aria-controls=\"river-panel\" class=\"svelte-okw1rh\">River</button> <button id=\"composition-tab\" type=\"button\" role=\"tab\" aria-controls=\"composition-panel\" class=\"svelte-okw1rh\">Composition</button></div> <div id=\"river-panel\" class=\"visualization-panel svelte-okw1rh\" role=\"tabpanel\" aria-labelledby=\"river-tab\" tabindex=\"0\"><!></div> <div id=\"composition-panel\" class=\"visualization-panel svelte-okw1rh\" role=\"tabpanel\" aria-labelledby=\"composition-tab\" tabindex=\"0\"><!></div></section>"), my = /* @__PURE__ */ W("<aside id=\"inspector\" aria-label=\"Inspector\" tabindex=\"-1\"><!></aside>"), hy = /* @__PURE__ */ W("<section class=\"panel lifespan-panel svelte-okw1rh\"><!></section>"), gy = /* @__PURE__ */ W("<div class=\"session-view\" role=\"presentation\"><div></div></div>"), _y = {
	hash: "svelte-okw1rh",
	code: ".panel.svelte-okw1rh {background:var(--surface);border:0;border-radius:var(--radius);padding:var(--panel-padding);margin-top:14px;min-width:0;}.panel-head.svelte-okw1rh {display:flex;justify-content:space-between;gap:16px;align-items:start;margin-bottom:10px;min-width:0;}.panel-head.svelte-okw1rh > :where(.svelte-okw1rh) {min-width:0;}.river-panel.svelte-okw1rh > .panel-head:where(.svelte-okw1rh) > div:where(.svelte-okw1rh):first-child {display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;}h2.svelte-okw1rh {font-size:var(--text-lg);margin:0;}.panel-actions.svelte-okw1rh {display:flex;align-items:center;gap:8px;flex-wrap:wrap;}.mobile-view-details.svelte-okw1rh {display:none;padding:var(--control-padding);border:1px solid var(--separator);border-radius:var(--control-radius);background:var(--surface);color:var(--text);text-decoration:none;white-space:nowrap;}.mobile-view-details.svelte-okw1rh:hover {background:var(--surface-raised);}#inspector.svelte-okw1rh {scroll-margin-top:16px;}.selected-item-summary {scroll-margin:16px;}\n  /* Sections follow their order in one column. A wide view with a selection places them with the\n     positions from wideSectionPlacement, which put the details in a second column. */.exploration-grid.svelte-okw1rh {display:grid;min-width:0;grid-template-columns:minmax(0, 1fr);align-items:start;gap:var(--panel-gap);}.exploration-grid.svelte-okw1rh > :where(.svelte-okw1rh) {grid-column:1;min-width:0;margin-top:0;}\n  @container highwater (min-width: 1051px) {.exploration-grid.occupied.svelte-okw1rh {grid-template-columns:minmax(0, 1fr) 320px;}.exploration-grid.occupied.svelte-okw1rh > :where(.svelte-okw1rh) {grid-column:var(--wide-column);grid-row:var(--wide-row);}.exploration-grid.occupied.svelte-okw1rh > .inspector-column.beside:where(.svelte-okw1rh) {position:sticky;top:16px;max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);overflow-y:auto;overscroll-behavior:contain;scrollbar-color:var(--control-border) var(--plot);scrollbar-width:thin;}\n  }.visualization-tabs.svelte-okw1rh {display:flex;gap:6px;margin:0 0 10px;border-bottom:1px solid var(--separator);}.visualization-tabs.svelte-okw1rh button:where(.svelte-okw1rh) {background:transparent;border:0;border-bottom:2px solid transparent;border-radius:0;}.visualization-tabs.svelte-okw1rh button[aria-selected='true']:where(.svelte-okw1rh) {border-color:var(--accent);background:transparent;color:var(--accent);}.visualization-panel.svelte-okw1rh {min-width:0;}.visualization-panel[hidden].svelte-okw1rh {display:none;}.no-model-calls.svelte-okw1rh {padding:12px;border:1px solid var(--separator);border-radius:var(--radius);background:var(--plot);}.no-model-calls.svelte-okw1rh h3:where(.svelte-okw1rh) {margin:0;color:var(--text-strong);font-size:14px;}.no-model-calls.svelte-okw1rh p:where(.svelte-okw1rh) {margin:4px 0 0;color:var(--secondary);font-size:var(--text-sm);}.inspector-column.svelte-okw1rh {display:grid;align-self:start;gap:var(--panel-gap);min-width:0;}.chart-area.svelte-okw1rh {position:relative;min-width:0;}.river-pending.svelte-okw1rh {min-height:360px;margin:0;padding:24px;color:var(--text);}.selection-location-note.svelte-okw1rh {display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px;color:var(--text);font-size:var(--text-sm);}.item-hover-position.svelte-okw1rh {position:fixed;z-index:5;pointer-events:none;}\n  @container highwater (max-width: 1050px) {.mobile-view-details.svelte-okw1rh {display:inline-flex;align-items:center;}\n  }\n  @container highwater (max-width: 850px) {.item-hover-position.svelte-okw1rh {display:none;}\n  }"
};
function vy(e, t) {
	Be(t, !0), ui(e, _y);
	let n = X(t, "sessions", 19, () => []), r = X(t, "sessionReference", 3, null), i = X(t, "presentation", 31, () => en(Ki())), a = X(t, "viewState", 15, null), o = X(t, "riverSessionId", 15, null), s = X(t, "onPreferencesChange", 3, () => {}), c = X(t, "copyDisabled", 3, !1), l = X(t, "keyboardScope", 3, "window"), u = X(t, "onPin", 3, () => {}), d = X(t, "sections", 3, ey), f = X(t, "following", 3, !1), p = X(t, "density", 3, "standard"), m = ny(yr(() => d())), h = iy(m), g = /* @__PURE__ */ P(() => f() && m.includes("call"));
	function _(e) {
		let t = h.get(e);
		return `--wide-column:${t.column};--wide-row:${t.row}`;
	}
	let v = /* @__PURE__ */ P(() => r() ?? t.indexed.analysis.session.id), y = /* @__PURE__ */ F(Ui()), b = /* @__PURE__ */ F(Ui()), x = null, S = null, ee = /* @__PURE__ */ F(0), C = /* @__PURE__ */ F(0), w = /* @__PURE__ */ F(null);
	function T(e) {
		i(e), s()(e);
	}
	let E = /* @__PURE__ */ F($i()), D, O = /* @__PURE__ */ F("river"), k = /* @__PURE__ */ F("cumulative"), te = /* @__PURE__ */ F(""), A = /* @__PURE__ */ F(null), ne = /* @__PURE__ */ F(null), re = 0, ie = 0, ae = /* @__PURE__ */ F(null), oe = 0, se = () => ({
		ready: !1,
		isFitAll: !0,
		zoomFactor: 1,
		canZoomIn: !1,
		canZoomOut: !1,
		totalCallCount: 0,
		firstVisibleCallIndex: null,
		lastVisibleCallIndex: null,
		hasOverflow: !1
	}), ce = /* @__PURE__ */ F(se()), le = /* @__PURE__ */ F(null), ue = /* @__PURE__ */ F(null), de = /* @__PURE__ */ F(null), fe = /* @__PURE__ */ F(null), pe = /* @__PURE__ */ F(!1), me = /* @__PURE__ */ F(!1), he = /* @__PURE__ */ F(!1);
	function ge(e) {
		let t = e > 0 && (H(pe) ? e <= 540 : e <= 520);
		t !== H(pe) && I(pe, t, !0);
		let n = p() === "compact" ? 510 : 540;
		I(me, e > 0 && (H(me) ? e <= n + 20 : e <= n), !0);
		let r = e > 0 && (H(he) ? e <= 780 : e <= 760);
		r !== H(he) && I(he, r, !0);
	}
	function j(e) {
		e !== o() && requestAnimationFrame(() => setTimeout(() => {
			(r() ?? t.indexed.analysis.session.id) !== e || Ce || o(e);
		}));
	}
	let _e = /* @__PURE__ */ P(() => H(E).pinnedCallIndex === null ? null : t.indexed?.callByIndex.get(H(E).pinnedCallIndex) ?? null), M = /* @__PURE__ */ P(() => H(E).selectedItemId ? t.indexed?.itemById.get(H(E).selectedItemId) ?? null : null), ve = /* @__PURE__ */ P(() => H(M) !== null && H(M).presence.length > 0 && H(ue)?.itemId === H(M).id && !H(ue).visible), ye = /* @__PURE__ */ P(() => H(E).hoveredItemId ? t.indexed?.itemById.get(H(E).hoveredItemId) ?? null : null), be = /* @__PURE__ */ P(() => t.indexed?.analysis.modelCalls.map((e) => e.index) ?? []), xe = /* @__PURE__ */ P(() => H(O) === "river" ? "Context River" : "Composition");
	Tn(() => {
		let e = t.indexed, n = H(v);
		yr(() => {
			let t = S;
			if (t === e) {
				j(n);
				return;
			}
			if (t && t.analysis.session.id === e.analysis.session.id) {
				let n = H(E).pinnedCallIndex;
				I(E, na(H(E), t, e)), n !== null && H(E).pinnedCallIndex === null && H(k) === "cumulative" && I(te, "The pinned call is no longer available; cumulative scope now covers the whole session."), H(ae) && !e.itemById.has(H(ae).itemId) && I(ae, null), H(A)?.kind === "reveal-item" && (!e.itemById.has(H(A).itemId) || H(E).selectedItemId !== H(A).itemId ? I(A, null) : I(A, {
					...H(A),
					referenceCallIndex: H(E).pinnedCallIndex
				}));
			} else t && (I(E, $i()), I(y, Ui()), I(b, Ui()), I(O, "river"), I(k, "cumulative"), I(te, ""), I(A, null), I(ae, null), I(ue, null), Ae(), I(w, null), I(ee, 0), I(C, 0));
			S = e, j(n);
		});
	}), Tn(() => {
		a({
			linkedView: {
				session: H(v),
				view: H(O),
				display: i().river.display,
				scope: H(k),
				pin: H(E).pinnedCallIndex,
				item: H(E).selectedItemId,
				range: H(w) ? H(w).range : da(H(ce), H(be))
			},
			navigationRevision: H(C),
			riverReady: o() === H(v),
			settled: H(O) === "composition" || H(be).length === 0 || H(ce).ready && (!H(A) || H(ee) === H(A).id)
		});
	}), Tn(() => {
		t.indexed?.analysis.modelCalls.length === 0 && (H(A) !== null || H(ce).ready || !H(ce).isFitAll || H(ce).totalCallCount !== 0) && (I(A, null), Ae());
	}), Tn(() => {
		H(E), H(O), t.indexed, H(_e), H(M), o(), x = Hi(D).activeElement;
	}), Cn(() => {
		H(E), H(O), t.indexed, H(_e), H(M), o(), yr(Se);
	});
	function Se() {
		x && !x.isConnected && (Hi(D).activeElement === document.body || Hi(D).activeElement === null || !Hi(D).activeElement?.isConnected) && (Hi(D).getElementById("selected-item-summary") ?? Hi(D).getElementById("pinned-call-summary") ?? Hi(D).getElementById(H(O) === "river" ? "river-tab" : "composition-tab"))?.focus({ preventScroll: !0 });
	}
	Cn(() => {
		H(le), H(ye), H(de), yr(qe);
	});
	let Ce = !1;
	Bi(() => {
		l() === "window" && window.addEventListener("keydown", Qe);
		let e = typeof ResizeObserver > "u" ? null : new ResizeObserver(([e]) => {
			let t = e.contentRect.width;
			requestAnimationFrame(() => {
				Ce || ge(t);
			});
		});
		return e?.observe(D), () => {
			Ce = !0, e?.disconnect(), l() === "window" && window.removeEventListener("keydown", Qe);
		};
	});
	function we(e) {
		return e.session !== H(v) || o() !== H(v) ? !1 : (I(E, {
			...$i(),
			selectedItemId: e.item,
			pinnedCallIndex: e.pin
		}), I(O, e.view, !0), i({
			...i(),
			river: {
				...i().river,
				display: e.display
			}
		}), I(k, e.scope, !0), I(te, ""), I(w, { range: e.range }), I(A, t.indexed.analysis.modelCalls.length ? e.range ? {
			id: ++re,
			kind: "range",
			startCallIndex: e.range[0],
			endCallIndex: e.range[1]
		} : {
			id: ++re,
			kind: "fit"
		} : null), H(A) || I(w, null), !0);
	}
	function Te() {
		let e = H(be)[H(be).length - 1];
		if (e !== void 0 && m.includes("call")) {
			I(E, {
				...H(E),
				pinnedCallIndex: e
			}), I(te, ""), I(C, H(C) + 1), I(A, {
				id: ++re,
				kind: "recent",
				minCallSpacing: 4
			});
			return;
		}
		Ue("latest");
	}
	function Ee() {
		u()(), I(E, {
			...H(E),
			pinnedCallIndex: null
		});
	}
	function De() {
		gr().then(() => {
			let e = Hi(D).getElementById("pinned-call-summary");
			e?.scrollIntoView({ block: "start" }), e?.focus({ preventScroll: !0 });
		});
	}
	function Oe() {
		I(O, "composition"), I(k, "atCall"), gr().then(() => {
			let e = Hi(D).getElementById("composition-tab");
			e?.scrollIntoView({ block: "start" }), e?.focus({ preventScroll: !0 });
		});
	}
	function ke(e) {
		I(ee, e, !0), e === H(A)?.id && I(w, null);
	}
	function Ae() {
		I(ce, se());
	}
	function je(e) {
		H(E).hoveredCallIndex !== e && I(E, {
			...H(E),
			hoveredCallIndex: e
		});
	}
	function Me(e) {
		u()(), I(E, {
			...H(E),
			pinnedCallIndex: e
		}), I(te, "");
	}
	function Ne(e) {
		I(k, e, !0);
	}
	function Pe(e) {
		H(O) === "river" && I(ce, e);
	}
	function Fe(e) {
		(e?.itemId !== H(ue)?.itemId || e?.visible !== H(ue)?.visible) && I(ue, e);
	}
	function Ie(e) {
		t.indexed?.itemById.has(e) && H(be).length !== 0 && (I(C, H(C) + 1), I(O, "river"), I(A, {
			id: ++re,
			kind: "reveal-item",
			itemId: e,
			referenceCallIndex: H(E).pinnedCallIndex
		}));
	}
	function Le(e) {
		t.indexed?.itemById.has(e) && I(ae, {
			requestId: ++oe,
			itemId: e
		});
	}
	function Re() {
		let e = H(v), n = H(M)?.id ?? null, r = ++ie;
		if (n === null) {
			let e = Hi(D).getElementById("inspector");
			if (!e) return;
			e.scrollIntoView({ block: "start" }), e.focus({ preventScroll: !0 });
			return;
		}
		gr().then(() => {
			if (r !== ie || e !== H(v) || H(E).selectedItemId !== n || !t.indexed?.itemById.has(n)) return;
			let i = Hi(D).getElementById("inspector"), a = Hi(D).getElementById("selected-item-summary");
			if (i && a) {
				if (getComputedStyle(i).overflowY !== "visible" && i.scrollHeight > i.clientHeight) {
					let e = i.getBoundingClientRect(), t = a.getBoundingClientRect();
					t.top < e.top + 12 ? i.scrollTop -= e.top + 12 - t.top : t.bottom > e.bottom - 12 && (i.scrollTop += t.bottom - (e.bottom - 12)), a.focus({ preventScroll: !0 });
				} else a.scrollIntoView({ block: "start" }), a.focus({ preventScroll: !0 });
			}
		});
	}
	function ze(e) {
		if (!t.indexed?.callByIndex.has(e)) return;
		let n = H(v), r = t.indexed.callByIndex.get(e)?.sourceRecordId, i = H(E).selectedItemId, a = ++ie;
		Me(e), gr().then(() => {
			if (a !== ie || n !== H(v) || H(E).selectedItemId !== i || H(_e)?.sourceRecordId !== r) return;
			let e = Hi(D).getElementById("pinned-call-summary");
			e?.scrollIntoView({ block: "nearest" }), e?.focus({ preventScroll: !0 });
		});
	}
	function He() {
		if (H(g)) {
			Je(null);
			return;
		}
		u()(), I(E, $i()), I(te, ""), I(A, null);
	}
	function Ue(e) {
		(e === "fit" || e === "latest") && I(C, H(C) + 1), I(A, {
			id: ++re,
			kind: e
		});
	}
	function We(e) {
		Me(e), I(A, {
			id: ++re,
			kind: "ensure-call",
			callIndex: e
		});
	}
	function Ge(e) {
		let t;
		if (e.key === "Home") t = "river";
		else if (e.key === "End") t = "composition";
		else if (e.key === "ArrowLeft" || e.key === "ArrowRight") t = H(O) === "river" ? "composition" : "river";
		else return;
		e.preventDefault(), I(O, t, !0);
		let n = t === "river" ? "river-tab" : "composition-tab";
		Hi(D).getElementById(n)?.focus();
	}
	function Ke(e, t) {
		e === null ? (I(le, null), I(fe, null)) : t && I(le, {
			x: t.clientX,
			y: t.clientY
		}), H(E).hoveredItemId !== e && I(E, {
			...H(E),
			hoveredItemId: e
		});
	}
	function qe() {
		if (!H(de) || !H(le)) return;
		let e = H(de).getBoundingClientRect();
		if (e.width === 0 || e.height === 0) return;
		let { x: t, y: n } = H(le), r = t + 14, i = n + 14, a = r + e.width <= window.innerWidth - 12 ? r : t - 14 - e.width, o = i + e.height <= window.innerHeight - 12 ? i : n - 14 - e.height, s = {
			left: Math.round(Math.min(Math.max(12, a), Math.max(12, window.innerWidth - e.width - 12))),
			top: Math.round(Math.min(Math.max(12, o), Math.max(12, window.innerHeight - e.height - 12)))
		};
		(s.left !== H(fe)?.left || s.top !== H(fe)?.top) && I(fe, s);
	}
	function Je(e) {
		H(A)?.kind === "reveal-item" && H(A).itemId !== e && I(A, null), H(ae) && H(ae).itemId !== e && I(ae, null), I(E, {
			...H(E),
			selectedItemId: e
		});
	}
	function Ye(e, t) {
		Je(e), t !== void 0 && Me(t);
	}
	function Xe(e) {
		H(A)?.kind === "reveal-item" && I(A, null), u()(), I(E, {
			...H(E),
			pinnedCallIndex: e
		});
	}
	function Ze() {
		let e = Hi(D).activeElement?.closest("details[open]") ?? Hi(D).querySelector(".view-options[open]");
		if (e instanceof HTMLDetailsElement) return e.open = !1, e.querySelector("summary")?.focus(), !0;
		if (H(ne)?.dismissEconomics()) return !0;
		if (H(E).selectedItemId !== null || H(E).pinnedCallIndex !== null && !H(g)) {
			let e = H(E).pinnedCallIndex;
			return I(E, ea(H(E))), H(E).pinnedCallIndex !== e && u()(), H(A)?.kind === "reveal-item" && H(E).selectedItemId !== H(A).itemId && I(A, null), !0;
		}
		return !H(ce).isFitAll && (Ue("fit"), !0);
	}
	function Qe(e) {
		if (e.key === "Escape" && !e.defaultPrevented) {
			(Ze() || l() === "window") && e.preventDefault();
			return;
		}
		if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || H(O) !== "river") return;
		let n = e.key === "ArrowLeft" || e.key === "h" ? -1 : e.key === "ArrowRight" || e.key === "l" ? 1 : null;
		if (n === null) return;
		let r = e.target;
		if (!(r instanceof Element)) return;
		let i = l() === "window" && r === document.body && document.querySelectorAll("main").length === 1, a = t.keyboardOwner ?? D;
		if (!i && !a?.contains(r) || (e.key === "h" || e.key === "l") && i || r.closest("input, textarea, select, [contenteditable]:not([contenteditable=\"false\"]), [role=\"tab\"], [role=\"slider\"], [role=\"spinbutton\"], [role=\"combobox\"], [role=\"listbox\"], [role=\"menu\"], [role=\"radio\"]")) return;
		let o = l() === "root" ? r.closest("[data-call-index]")?.getAttribute("data-call-index") : null, s = ra(H(be), o ? Number(o) : H(E).pinnedCallIndex, H(ce), n);
		e.preventDefault(), s !== null && (i && D.querySelector(".river-scroll")?.focus({ preventScroll: !0 }), We(s), l() === "root" && r.closest(".call-target") && gr().then(() => D.querySelector(`.call-target[aria-label="Pin model call ${s}"]`)?.focus({ preventScroll: !0 })));
	}
	var $e = {
		restoreView: we,
		followLatest: Te
	}, et = gy();
	Or("resize", rn, qe);
	var tt = L(et);
	let nt;
	return J(tt, 20, () => m, (e) => e, (e, r) => {
		var a = Br(), s = R(a), u = (e) => {
			var i = ay();
			$r(L(i), () => H(v), (e) => {
				Vp(e, {
					get indexed() {
						return t.indexed;
					},
					get sessionId() {
						return H(v);
					},
					get sessions() {
						return n();
					},
					get compact() {
						return H(he);
					}
				});
			}), N(i), V((e) => yi(i, e), [() => _(r)]), G(e, i);
		}, d = (e) => {
			var n = oy(), i = L(n);
			{
				let e = /* @__PURE__ */ P(() => !H(he));
				Qv(i, {
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
						Je(e), Re();
					},
					onViewDetails: De,
					onShowComposition: Oe
				});
			}
			N(n), V((e) => yi(n, e), [() => _(r)]), G(e, n);
		}, p = (e) => {
			var n = py(), a = L(n), s = L(a), u = L(s), d = z(u, !0), f = B(u, 2), p = (e) => {
				{
					let n = /* @__PURE__ */ P(() => H(O) === "river");
					Gp(e, {
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
				H(O) === "river" && e(p);
			}), N(s);
			var m = B(s, 2), h = L(m), y = (e) => {
				var n = sy(), r = z(n, !0);
				V(() => {
					n.disabled = c(), K(r, H(pe) ? "Copy link" : "Copy view link");
				}), U("click", n, function(...e) {
					t.onCopyViewLink?.apply(this, e);
				}), G(e, n);
			};
			q(h, (e) => {
				t.onCopyViewLink && e(y);
			});
			var b = B(h, 2), x = z(b, !0), S = B(b, 2), ee = z(S, !0);
			N(m), N(a);
			var C = B(a, 2), w = L(C), D = B(w, 2);
			N(C);
			var re = B(C, 2), ie = L(re), ae = (e) => {
				var n = dy(), r = R(n);
				$r(r, () => H(v), (e) => {
					{
						let t = /* @__PURE__ */ P(() => H(O) === "river");
						ec(e, {
							get compact() {
								return H(me);
							},
							get isVisible() {
								return H(t);
							},
							get viewport() {
								return H(ce);
							},
							get callIndices() {
								return H(be);
							},
							get pinnedCallIndex() {
								return H(E).pinnedCallIndex;
							},
							onSelectCall: We,
							onLatest: () => Ue("latest"),
							onFitAll: () => Ue("fit"),
							onZoomIn: () => Ue("zoom-in"),
							onZoomOut: () => Ue("zoom-out")
						});
					}
				});
				var a = B(r, 2), s = L(a), c = (e) => {
					G(e, cy());
				}, u = (e) => {
					var n = Br();
					$r(R(n), () => H(v), (e) => {
						{
							let n = /* @__PURE__ */ P(() => H(O) === "river"), r = /* @__PURE__ */ P(() => l() === "window");
							Ri(Fv(e, {
								get indexed() {
									return t.indexed;
								},
								get preferences() {
									return i();
								},
								onPreferencesChange: T,
								get pinnedCallIndex() {
									return H(E).pinnedCallIndex;
								},
								get hoveredCallIndex() {
									return H(E).hoveredCallIndex;
								},
								get selectedItemId() {
									return H(E).selectedItemId;
								},
								get hoveredItemId() {
									return H(E).hoveredItemId;
								},
								get navigationCommand() {
									return H(A);
								},
								get isVisible() {
									return H(n);
								},
								onViewportChange: Pe,
								onNavigationSettled: ke,
								onSelectionVisibility: Fe,
								onHoverCall: je,
								onPinCall: Me,
								onHoverItem: Ke,
								onSelectItem: Je,
								onEmptyClick: Xe,
								onEscape: Ze,
								get consumeUnhandledEscape() {
									return H(r);
								}
							}), (e) => I(ne, e, !0), () => H(ne));
						}
					}), G(e, n);
				};
				q(s, (e) => {
					o() === H(v) ? e(u, -1) : e(c);
				});
				var d = B(s, 2), f = (e) => {
					var t = ly(), n = B(L(t), 2), r = B(n, 2);
					N(t), U("click", n, () => Ie(H(M).id)), U("click", r, () => Je(null)), G(e, t);
				};
				q(d, (e) => {
					H(ve) && H(M) && e(f);
				});
				var p = B(d, 2), m = (e) => {
					var n = uy();
					fp(L(n), {
						get item() {
							return H(ye);
						},
						get indexed() {
							return t.indexed;
						}
					}), N(n), Ri(n, (e) => I(de, e), () => H(de)), V(() => yi(n, `left:${H(fe)?.left ?? 12}px;top:${H(fe)?.top ?? 12}px`)), G(e, n);
				};
				q(p, (e) => {
					H(ye) && H(E).selectedItemId !== H(E).hoveredItemId && e(m);
				}), N(a), G(e, n);
			}, oe = (e) => {
				G(e, fy());
			};
			q(ie, (e) => {
				t.indexed.analysis.modelCalls.length > 0 ? e(ae) : e(oe, -1);
			}), N(re);
			var se = B(re, 2);
			$r(L(se), () => H(v), (e) => {
				{
					let n = /* @__PURE__ */ P(() => H(O) === "composition");
					Rs(e, {
						get indexed() {
							return t.indexed;
						},
						get pinnedCallIndex() {
							return H(E).pinnedCallIndex;
						},
						get selectedItemId() {
							return H(E).selectedItemId;
						},
						get isVisible() {
							return H(n);
						},
						get scope() {
							return H(k);
						},
						get endpointNotice() {
							return H(te);
						},
						onScopeChange: Ne,
						onPinCall: Me,
						onUnpinCall: Ee,
						onSelectItem: Je,
						onRevealInRiver: Ie,
						onViewDetails: Re,
						onFindInLifespans: Le,
						get compact() {
							return H(pe);
						}
					});
				}
			}), N(se), N(n), V((e) => {
				yi(n, e), K(d, H(xe)), K(x, H(pe) ? "Details" : "View details"), Y(S, "aria-label", H(g) ? "Clear selected item" : "Clear selected item and pinned call"), Y(S, "title", H(g) ? "Clears the selected item. The latest call stays pinned while following." : "Clears the selected item and pinned call"), S.disabled = H(E).selectedItemId === null && (H(g) || H(E).pinnedCallIndex === null), K(ee, H(pe) ? "Clear" : "Clear selection"), Y(w, "aria-selected", H(O) === "river"), Y(w, "tabindex", H(O) === "river" ? 0 : -1), Y(D, "aria-selected", H(O) === "composition"), Y(D, "tabindex", H(O) === "composition" ? 0 : -1), Y(re, "hidden", H(O) !== "river"), Y(se, "hidden", H(O) !== "composition");
			}, [() => _(r)]), U("click", b, (e) => {
				e.preventDefault(), Re();
			}), U("click", S, He), U("click", w, () => I(O, "river")), U("keydown", w, Ge), U("click", D, () => I(O, "composition")), U("keydown", D, Ge), G(e, n);
		}, m = (e) => {
			var i = my();
			let a;
			var o = L(i);
			{
				let e = /* @__PURE__ */ P(() => H(be).length > 0);
				op(o, {
					get indexed() {
						return t.indexed;
					},
					get sessionId() {
						return H(v);
					},
					get loadItemContent() {
						return t.loadItemContent;
					},
					get sessions() {
						return n();
					},
					get pinnedCall() {
						return H(_e);
					},
					get selectedItem() {
						return H(M);
					},
					get callSections() {
						return H(b);
					},
					get itemSections() {
						return H(y);
					},
					get pinnedCallIndex() {
						return H(E).pinnedCallIndex;
					},
					get hoveredCallIndex() {
						return H(E).hoveredCallIndex;
					},
					get hasCalls() {
						return H(e);
					},
					onClosePinnedCall: Ee,
					onCloseItem: () => Je(null),
					onSelectItem: Je,
					onPinCall: Me,
					onInspectCall: ze,
					onRevealInRiver: Ie
				});
			}
			N(i), V((e, t) => {
				a = _i(i, 1, "inspector-column svelte-okw1rh", null, a, {
					beside: e,
					empty: !H(_e) && !H(M)
				}), yi(i, t);
			}, [() => h.get("details")?.column === "2", () => _(r)]), G(e, i);
		}, x = (e) => {
			var n = hy();
			$r(L(n), () => H(v), (e) => {
				Jc(e, {
					get indexed() {
						return t.indexed;
					},
					get selectedItemId() {
						return H(E).selectedItemId;
					},
					get pinnedCallIndex() {
						return H(E).pinnedCallIndex;
					},
					onSelectItem: Ye,
					onHoverItem: Ke,
					get findRequest() {
						return H(ae);
					},
					get compact() {
						return H(pe);
					}
				});
			}), N(n), V((e) => yi(n, e), [() => _(r)]), G(e, n);
		};
		q(s, (e) => {
			r === "summary" ? e(u) : r === "call" ? e(d, 1) : r === "chart" ? e(p, 2) : r === "details" ? e(m, 3) : r === "lifespans" && e(x, 4);
		}), G(e, a);
	}), N(tt), N(et), Ri(et, (e) => D = e, () => D), V(() => nt = _i(tt, 1, "exploration-grid svelte-okw1rh", null, nt, { occupied: H(M) !== null || H(_e) !== null })), U("keydown", et, function(...e) {
		(l() === "root" ? Qe : void 0)?.apply(this, e);
	}), G(e, et), Ve($e);
}
kr(["keydown", "click"]);
//#endregion
//#region src/lib/economics-validation.ts
var yy = /* @__PURE__ */ new Set([
	"piModelRates",
	"sourceModelRates",
	"providerReported",
	"unknown"
]), by = /* @__PURE__ */ new Set([
	"complete",
	"partial",
	"missing",
	"unsupported"
]), xy = /* @__PURE__ */ new Set([
	"reported",
	"notReported",
	"notRetainedByPi",
	"unsupported"
]), Sy = .25, Cy = .5, wy = "adjacent-cache-read-share-v1", Ty = 1e3;
function Ey(e, t) {
	if (e !== null && (!Number.isFinite(e) || e < 0 || e > 1)) throw new $(`${t} is outside 0..1`);
}
function Dy(e, t, n, r) {
	if (n === 0) {
		if (e !== null || t !== 0) throw new $(`${r} has an invalid zero denominator`);
		return;
	}
	let i = t / n;
	if (e === null || Math.abs(e - i) > Math.max(1e-12, i * 1e-9)) throw new $(`${r} disagrees with its reported token buckets`);
}
function Oy(e) {
	let t = e.economics;
	if (!t || typeof t != "object") throw new $(`Call ${e.index} has no economics record`);
	if (!by.has(t.usageCompleteness) || !by.has(t.costCompleteness) || !xy.has(t.cacheWriteStatus)) throw new $(`Call ${e.index} has an unsupported economics status`);
	if (!Array.isArray(t.explanationCodes) || t.explanationCodes.some((e) => typeof e != "string")) throw new $(`Call ${e.index} has invalid economics explanations`);
	Cl(t.promptTokens, `Call ${e.index} economics promptTokens`);
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
	]) Cl(n, `Call ${e.index} ${t}`);
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
	]) Ey(r, `Call ${e.index} economics ${n}`);
	if (ky(e), t.piPromptCost !== null && (!Number.isFinite(t.piPromptCost) || t.piPromptCost < 0)) throw new $(`Call ${e.index} has an invalid calculated prompt cost`);
	let i = t.policyId === null ? null : xu[t.policyId];
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
	if (Cl(a, `Call ${e.index} input`), Cl(o, `Call ${e.index} cacheRead`), Cl(s, `Call ${e.index} cacheWrite`), a === null || o === null || i.hasWriteRatio && s === null) throw new $(`Call ${e.index} has incomplete normalized prompt buckets`);
	if (BigInt(a) + BigInt(o) + BigInt(i.hasWriteRatio ? s : 0) !== BigInt(t.promptTokens)) throw new $(`Call ${e.index} prompt tokens disagree with normalized buckets`);
	if (Dy(t.cacheReadRatio, o, t.promptTokens, `Call ${e.index} cacheReadRatio`), i.hasWriteRatio) Dy(t.cacheWriteRatio, s, t.promptTokens, `Call ${e.index} cacheWriteRatio`);
	else if (t.cacheWriteRatio !== null) throw new $(`Call ${e.index} has an unsupported cache-write ratio`);
	if (i.hasFreshRatio) Dy(t.freshRatio, a, t.promptTokens, `Call ${e.index} freshRatio`);
	else if (t.freshRatio !== null) throw new $(`Call ${e.index} has an unsupported fresh-input ratio`);
	if (t.costCompleteness === "complete" && t.usageCompleteness === "complete" && i.hasFreshRatio && t.piPromptCost === null) throw new $(`Call ${e.index} is missing a complete prompt cost`);
}
function ky(e) {
	let t = e.economics.cacheRatioDiscontinuity;
	if (t === null) return;
	if (!t || typeof t != "object" || !Number.isSafeInteger(t.previousCallIndex) || t.previousCallIndex < 0 || !["drop", "rise"].includes(t.direction) || !["notable", "large"].includes(t.magnitude) || t.method !== wy || !Number.isFinite(t.previousRatio) || !Number.isFinite(t.currentRatio) || !Number.isFinite(t.delta) || t.delta < Sy || t.delta > 1 || t.compactionBefore !== null && typeof t.compactionBefore != "string") throw new $(`Call ${e.index} has invalid cache-ratio change data`);
	Cl(t.previousPromptTokens, `Call ${e.index} previous prompt tokens`), Cl(t.currentPromptTokens, `Call ${e.index} current prompt tokens`), Ey(t.previousRatio, `Call ${e.index} previous cache-read ratio`), Ey(t.currentRatio, `Call ${e.index} current cache-read ratio`);
	let n = Math.abs(t.currentRatio - t.previousRatio);
	if (Math.abs(n - t.delta) > Math.max(1e-12, n * 1e-9) || t.direction !== (t.currentRatio < t.previousRatio ? "drop" : "rise") || t.magnitude !== (t.delta >= Cy ? "large" : "notable") || t.compactionBefore !== e.compactionBefore) throw new $(`Call ${e.index} has inconsistent cache-ratio change data`);
}
function Ay(e) {
	let t = [...e].sort((e, t) => e.index - t.index);
	for (let e = 0; e < t.length; e += 1) {
		let n = t[e], r = n.economics.cacheRatioDiscontinuity;
		if (r === null) continue;
		let i = t[e - 1];
		if (!i || i.index + 1 !== n.index || r.previousCallIndex !== i.index || r.previousPromptTokens !== i.economics.promptTokens || r.currentPromptTokens !== n.economics.promptTokens || i.economics.usageCompleteness !== "complete" || n.economics.usageCompleteness !== "complete" || i.economics.policyId === null || i.economics.policyId !== n.economics.policyId || i.provider !== n.provider || i.model !== n.model || i.api !== n.api || i.economics.cacheReadRatio !== r.previousRatio || n.economics.cacheReadRatio !== r.currentRatio || (i.economics.promptTokens ?? 0) < Ty || (n.economics.promptTokens ?? 0) < Ty) throw new $(`Call ${n.index} has an ineligible cache-ratio change`);
	}
}
function jy(e, t) {
	if (!e || !yy.has(e.costBasis)) throw new $("Analysis has an unsupported economics cost basis");
	if (!Array.isArray(e.supportedPolicyIds)) throw new $("Analysis has invalid supported economics policies");
	Sl(e.supportedPolicyIds, "economics policy ID");
	for (let t of e.supportedPolicyIds) if (typeof t != "string" || !Object.prototype.hasOwnProperty.call(xu, t)) throw new $(`Analysis has an unsupported economics policy ${String(t)}`);
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
	if (Cl(e.cacheReadPromptTokens, "Analysis cache-read prompt token total"), Cl(e.cacheReadTokens, "Analysis cache-read token total"), Ey(e.cacheReadRatio, "Analysis cache-read ratio"), !Array.isArray(e.explanationCodes) || e.explanationCodes.some((e) => typeof e != "string")) throw new $("Analysis has invalid economics explanations");
	for (let n of t) if (Oy(n), n.economics.policyId !== null && !e.supportedPolicyIds.includes(n.economics.policyId)) throw new $(`Call ${n.index} economics policy is missing from the summary`);
	if (Ay(t), e.cacheReadPromptTokens === null != (e.cacheReadTokens === null)) throw new $("Analysis has incomplete cache-read token totals");
	if (e.cacheReadPromptTokens !== null && e.cacheReadTokens !== null) {
		if (e.cacheReadRatio === null && e.cacheReadPromptTokens > 0) throw new $("Analysis is missing a cache-read ratio for covered tokens");
		Dy(e.cacheReadRatio, e.cacheReadTokens, e.cacheReadPromptTokens, "Analysis cache-read ratio");
	} else if (e.cacheReadRatio !== null) throw new $("Analysis has a cache-read ratio without covered tokens");
}
//#endregion
//#region src/lib/timing-validation.ts
var My = /* @__PURE__ */ new Set([
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
function Ny(e, t) {
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
	if (s === "vscode-copilot-trace-spans" || s === "copilot-usage-duration") {
		(t !== (s === "vscode-copilot-trace-spans" ? "vscode-copilot" : "copilot") || !Number.isSafeInteger(a) || a <= 0 || r.startedAtMs === null || r.recordedAtMs === null || r.recordedAtMs - r.startedAtMs !== a) && i(), l(c === null ? null : c * 1e3 / a);
		return;
	}
	(!Number.isSafeInteger(a) || a <= 0 || s !== "pi-message-timestamps" || !n || !My.has(e.api ?? "") || ![
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
var Py = /* @__PURE__ */ new Set([
	"recorded",
	"estimated",
	"apiEquivalent",
	"free",
	"unknown"
]), Fy = /* @__PURE__ */ new Set([
	"recordedCost",
	"billingModeTable",
	"opencodeZeroWithListedPrice",
	"perTokenDefault",
	"failedAttempt",
	"missingTime",
	"noPrice",
	"missingUsage"
]), Iy = /* @__PURE__ */ new Set([
	"documented",
	"firstObserved",
	"modelsDevCommit"
]), Ly = (e) => typeof e == "number" && Number.isFinite(e) && e >= 0, Ry = (e) => typeof e == "number" && Number.isSafeInteger(e) && e >= 0;
function zy(e) {
	let t = e.costAssessment, n = (t) => {
		throw new $(`Model call ${e.index} cost ${t}`);
	};
	(!t || !Py.has(t.kind)) && n("has an unknown kind"), Fy.has(t.classificationRule) || n("has an unknown classification rule"), t.amount !== null && !Ly(t.amount) && n("has an invalid amount"), t.kind === "unknown" != (t.amount === null) && n("amount disagrees with its kind"), t.amountHigh !== null && (!Ly(t.amountHigh) || t.amount === null || t.amountHigh < t.amount) && n("has an invalid range"), t.recordedByHarness !== null && !Ly(t.recordedByHarness) && n("has an invalid recorded value"), t.billingMode !== null && !["perToken", "subscription"].includes(t.billingMode) && n("has an unknown billing mode"), t.kind === "apiEquivalent" != (t.billingMode === "subscription" && t.amount !== null) && n("is API-equivalent without a subscription, or the reverse");
	let r = t.rate;
	r !== null && ((typeof r.provider != "string" || typeof r.model != "string" || typeof r.labEquivalent != "boolean" || typeof r.source != "string" || !Iy.has(r.startBasis) || r.validFrom !== null && Number.isNaN(Date.parse(r.validFrom))) && n("has an invalid rate"), r.labEquivalent && t.kind !== "apiEquivalent" && n("uses a lab rate outside a subscription")), (t.kind === "estimated" || t.kind === "apiEquivalent") && r === null && n("is calculated without a rate");
}
function By(e, t) {
	let n = () => {
		throw new $(`Session ${t} cost subtotal is inconsistent`);
	};
	(!e || !Ry(e.calls)) && n();
	let { low: r, high: i, calls: a } = e;
	if (a === 0) {
		(r !== null || i !== null) && n();
		return;
	}
	(r !== null || i !== null) && (!Ly(r) || !Ly(i) || i < r) && n();
}
function Vy(e) {
	if (!e) throw new $("Session has no cost summary");
	if (By(e.billed, "billed"), By(e.apiEquivalent, "API-equivalent"), !Ry(e.unknownCalls) || !Ry(e.failedAttemptCalls)) throw new $("Session cost summary has invalid call counts");
	let t = e.priceData;
	if (!t || typeof t.modelsDevCommit != "string" || typeof t.modelsDevCommittedAt != "string" || t.amendmentsImportedFrom !== null && typeof t.amendmentsImportedFrom != "string") throw new $("Session cost summary has no price data source");
}
function Hy(e) {
	if (e !== null && (!e || !Ly(e.totalUsd) || e.sinceMs !== null && !(Number.isSafeInteger(e.sinceMs) && e.sinceMs >= 0))) throw new $("Session has an invalid harness session cost");
}
//#endregion
//#region src/lib/analysis-ordering.ts
function Uy(e) {
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
	}, o = [...hc(e.contextItems)].sort(([, e], [, t]) => e.number - t.number);
	for (let [e, t] of o) a(e, t.previousId ?? void 0);
	let s = e.contextItems.filter((e) => e.kind === "unrecordedContext" && e.presence.length > 0).sort((e, t) => e.firstModelCall - t.firstModelCall);
	for (let [e, t] of s.entries()) a(t.id, s[e - 1]?.id);
	let c = new Map(e.contextItems.map((e) => [e.id, e])), l = (e, t) => (r.get(e.id) ?? 0) - (r.get(t.id) ?? 0) || e.id.localeCompare(t.id);
	for (let t of e.compactions) {
		let n = Wy(t.sourceItemIds.flatMap((e) => c.get(e) ?? []), l), r = Wy(e.contextItems.filter((e) => e.firstModelCall === t.beforeModelCall), l);
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
function Wy(e, t) {
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
function Gy(e, t, n) {
	let r = e.get(t);
	r ? r.push(n) : e.set(t, [n]);
}
function Ky(e) {
	Sl(e.contextItems.map((e) => e.id), "context item ID");
	let t = e.modelCalls.map((e) => e.index);
	if (new Set(t).size !== t.length) throw new $("Duplicate model-call index");
	let n = new Map(e.contextItems.map((e) => [e.id, e])), r = new Map(e.modelCalls.map((e) => [e.index, e])), i = new Map(e.modelCalls.map((e) => [e.index, new Set(e.contextItemIds)])), a = /* @__PURE__ */ new Map();
	for (let t of e.contextItems) a.set(t.id, new Map(t.tokenEstimates.map((e) => [e.profileId, e])));
	let { orderedItemIds: o, takesPlaceOf: s } = Uy(e), c = new Map(o.map((e, t) => [e, t])), l = new Map(e.modelCalls.map((e) => [e.index, [...e.contextItemIds].sort((e, t) => (c.get(e) ?? 0) - (c.get(t) ?? 0))])), u = e.modelCalls[0]?.index ?? 0, d = e.modelCalls[e.modelCalls.length - 1]?.index ?? 0, f = d + 1, p = new Set(e.compactions.map((e) => e.summaryItemId)), m = new Set(e.compactions.filter((e) => e.beforeModelCall === f).map((e) => e.summaryItemId)), h = /* @__PURE__ */ new Map();
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
			if (typeof t.preview.text != "string" || typeof t.preview.truncated != "boolean" || [...t.preview.text].length > 160 || t.preview.expandedTruncated !== void 0 && typeof t.preview.expandedTruncated != "boolean" || t.preview.expandedText !== void 0 && (typeof t.preview.expandedText != "string" || typeof t.preview.expandedTruncated != "boolean" || [...t.preview.expandedText].length > 640)) throw new $(`Item ${t.id} has an invalid preview`);
		}
		Sl(t.tokenEstimates.map((e) => e.profileId), `token estimate profile for item ${t.id}`);
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
			Sl(t, `${e} item reference in call ${r.index}`);
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
	let g = new Set(e.modelCalls.map((e) => e.index)), _ = /* @__PURE__ */ new Map(), v = /* @__PURE__ */ new Map(), y = /* @__PURE__ */ new Map(), b = /* @__PURE__ */ new Map(), x = /* @__PURE__ */ new Map();
	for (let t of e.compactions) {
		if (_.has(t.id)) throw new $(`Duplicate compaction ID ${t.id}`);
		if (!Number.isInteger(t.beforeModelCall) || t.beforeModelCall < (u || 1) || t.beforeModelCall > f) throw new $(`Compaction ${t.id} has an invalid call boundary`);
		if (!n.has(t.summaryItemId)) throw new $(`Compaction ${t.id} references a missing summary`);
		cf(t, g);
		for (let e of [...t.sourceItemIds, ...t.retainedItemIds]) if (!n.has(e)) throw new $(`Compaction ${t.id} references unknown item ${e}`);
		_.set(t.id, t), v.set(t.summaryItemId, t), Gy(y, t.summaryItemId, t);
		for (let e of t.sourceItemIds) Gy(b, e, t);
		for (let e of t.retainedItemIds) Gy(x, e, t);
	}
	let S = /* @__PURE__ */ new Map(), ee = /* @__PURE__ */ new Map();
	for (let t of e.lineage) {
		if (!n.has(t.from) || !n.has(t.to)) throw new $(`Lineage references missing item ${t.from} → ${t.to}`);
		if (t.kind !== "frameworkCompaction") throw new $(`Unsupported lineage kind ${String(t.kind)}`);
		Gy(S, t.from, t), Gy(ee, t.to, t);
	}
	return {
		analysis: e,
		itemById: n,
		callByIndex: r,
		outgoingLineage: S,
		incomingLineage: ee,
		compactionById: _,
		compactionBySummaryId: v,
		compactionsBySummaryId: y,
		compactionBySourceId: b,
		compactionsByRetainedId: x,
		itemEstimateByProfile: a,
		contextSetByCall: i,
		orderedItemIdsByCall: l,
		itemColorSlotById: Oa(e.contextItems, o, l, s),
		versionByItemId: hc(e.contextItems)
	};
}
//#endregion
//#region src/lib/analysis.ts
var qy = /* @__PURE__ */ new Set([
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
function Jy(e) {
	return qy.has(e) ? e : "other";
}
function Yy(e) {
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
function Xy(e) {
	if (e.displayWeightUnit !== e.tokenAnalysis.chartUnit) throw new $("Chart unit disagrees with token-analysis metadata");
	if (![
		"calculatedTokens",
		"estimatedTokens",
		"unavailable"
	].includes(e.displayWeightUnit)) throw new $(`Unsupported chart unit ${String(e.displayWeightUnit)}`);
	if (kl(e), e.turns !== void 0) {
		if (!Array.isArray(e.turns)) throw new $("Invalid turns");
		let t = new Set(e.modelCalls.map((e) => e.index)), n = 0;
		for (let r of e.turns) {
			if (!r || !Number.isSafeInteger(r.firstCall) || !Number.isSafeInteger(r.lastCall) || r.firstCall <= n || r.lastCall < r.firstCall || r.lastCall - r.firstCall >= t.size || r.prompt !== null && typeof r.prompt != "string" || r.durationMs !== null && (!Number.isSafeInteger(r.durationMs) || r.durationMs < 0) || ![
				null,
				"completed",
				"failed",
				"interrupted"
			].includes(r.status) || r.durationEstimated !== void 0 && typeof r.durationEstimated != "boolean" || typeof r.combinedCalls != "boolean") throw new $("Invalid turn details");
			for (let e = r.firstCall; e <= r.lastCall; e++) if (!t.has(e)) throw new $("Turn references a missing call");
			n = r.lastCall;
		}
	}
	for (let t of e.modelCalls) if (typeof t.tokenAnalysis.metricsIncludePartialEstimates != "boolean") throw new $(`Model call ${t.index} does not say whether its metrics include partial estimates`);
	if (jy(e.economics, e.modelCalls), e.modelCalls.forEach((t) => Ny(t, e.session.source)), e.modelCalls.forEach(zy), Vy(e.session.costSummary), Hy(e.session.harnessSessionCost), e.session.reportedCostTotal !== null && (!Number.isFinite(e.session.reportedCostTotal) || e.session.reportedCostTotal < 0)) throw new $("Analysis has an invalid calculated session cost total");
	if (Zy(e.session.reportedCostCoverage, "Session cost"), Zy(e.session.reportedUsageCoverage, "Session usage"), e.session.reportedCostCoverage.recordedCalls === 0 && e.session.reportedCostTotal !== null) throw new $("Session cost subtotal has no recorded calls");
	if (e.session.reportedUsageCoverage.recordedCalls === 0 && e.session.reportedPromptTokens !== null) throw new $("Session prompt subtotal has no recorded calls");
}
function Zy(e, t) {
	let n = e ? [
		e.recordedCalls,
		e.failedAttemptCalls,
		e.missingCalls
	] : [];
	if (n.length !== 3 || !n.every((e) => Number.isSafeInteger(e) && e >= 0)) throw new $(`${t} coverage is not a set of call counts`);
}
function Qy(e) {
	return {
		...e,
		modelCalls: [...e.modelCalls].sort((e, t) => e.index - t.index),
		contextItems: e.contextItems.map((e) => ({
			...e,
			kind: Jy(e.kind),
			presence: [...e.presence],
			metadata: { ...e.metadata }
		})),
		compactions: [...e.compactions].sort((e, t) => e.beforeModelCall - t.beforeModelCall || e.id.localeCompare(t.id)),
		lineage: [...e.lineage].sort((e, t) => e.to.localeCompare(t.to) || e.from.localeCompare(t.from) || e.kind.localeCompare(t.kind))
	};
}
function $y(e) {
	if (e.schemaVersion !== 1) throw new $(`Unsupported analysis schema ${String(e.schemaVersion)}`);
	let t = Yy(e);
	return Xy(t), Ky(Qy(t));
}
//#endregion
//#region src/lib/embed/analysis-controller.ts
function eb(e) {
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
				let e = $y(i.analysis);
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
var tb = /* @__PURE__ */ W("<span aria-hidden=\"true\"></span> <span class=\"sr-only\"> </span>", 1), nb = /* @__PURE__ */ W("<button type=\"button\">Retry</button>"), rb = /* @__PURE__ */ W("<p role=\"alert\" class=\"svelte-11525tj\"> <!></p>"), ib = /* @__PURE__ */ W("<p>Analysing session…</p>"), ab = /* @__PURE__ */ W("<div class=\"embedded-session svelte-11525tj\"><header class=\"svelte-11525tj\"><button type=\"button\" class=\"follow svelte-11525tj\">Follow latest</button> <span role=\"status\" class=\"svelte-11525tj\"><!></span> <!></header> <!> <!></div>"), ob = {
	hash: "svelte-11525tj",
	code: ".embedded-session.svelte-11525tj {min-width:0;padding:12px;}header.svelte-11525tj {display:flex;align-items:center;flex-wrap:wrap;gap:8px;}.follow[aria-pressed='true'].svelte-11525tj {border-color:var(--accent);background-color:var(--action);color:var(--active-text);}[role='status'].svelte-11525tj {display:inline-flex;align-items:center;color:var(--secondary);font-size:var(--text-sm);}[role='status'].svelte-11525tj:empty {position:absolute;}.status-dot.svelte-11525tj {width:0.5rem;height:0.5rem;border-radius:50%;background:var(--event-success);}.status-dot.updating.svelte-11525tj {background:var(--event-warning);}p[role='alert'].svelte-11525tj {color:var(--error);}"
};
function sb(e, t) {
	Be(t, !0), ui(e, ob);
	let n = () => ot(s, "$controller", r), [r, i] = st(), a = X(t, "defaultVerticalScale", 3, "session"), o = X(t, "density", 3, "standard"), s = eb((e, n) => yr(() => t.loadAnalysis(e, n))), c = /* @__PURE__ */ F(yr(() => {
		let e = Ki();
		return e.river.verticalScale = a(), Xi(void 0, t.preferencesKey, e);
	})), l = /* @__PURE__ */ F(!0), u = /* @__PURE__ */ P(() => n().loading ? "Updating…" : "Live"), d = 0, f = 0, p = /* @__PURE__ */ F(void 0), m = !1;
	function h(e) {
		Zi(e, void 0, t.preferencesKey);
	}
	function g() {
		I(l, !1), f += 1;
	}
	function _() {
		I(l, !0), H(p)?.followLatest();
	}
	Cn(() => {
		let e = n().revision;
		if (e !== d && (d = e, n().kind === "selection" && I(l, !0), H(l))) {
			let e = ++f;
			gr().then(() => {
				!m && H(l) && e === f && H(p)?.followLatest();
			});
		}
	}), Bi(() => (s.refresh(), () => {
		m = !0, s.dispose();
	}));
	function v() {
		s.refresh();
	}
	var y = { refresh: v }, b = ab(), x = L(b), S = L(x), ee = B(S, 2), C = L(ee), w = (e) => {
		G(e, zr("Update failed"));
	}, T = (e) => {
		var t = tb(), r = R(t);
		let i;
		var a = z(B(r, 2), !0);
		V(() => {
			i = _i(r, 1, "status-dot svelte-11525tj", null, i, { updating: n().loading }), Y(r, "title", H(u)), K(a, H(u));
		}), G(e, t);
	};
	q(C, (e) => {
		n().error ? e(w) : (n().loading || H(l) && n().indexed) && e(T, 1);
	}), N(ee);
	var E = B(ee, 2), D = (e) => {
		var t = nb();
		U("click", t, () => s.refresh()), G(e, t);
	};
	q(E, (e) => {
		n().error && e(D);
	}), N(x);
	var O = B(x, 2), k = (e) => {
		var t = rb(), r = L(t, !0), i = B(r), a = (e) => {
			G(e, zr("Showing the previous analysis."));
		};
		q(i, (e) => {
			n().indexed && e(a);
		}), N(t), V(() => K(r, n().error)), G(e, t);
	};
	q(O, (e) => {
		n().error && e(k);
	});
	var te = B(O, 2), A = (e) => {
		Ri(vy(e, {
			get indexed() {
				return n().indexed;
			},
			get loadItemContent() {
				return t.loadItemContent;
			},
			keyboardScope: "root",
			onPreferencesChange: h,
			onPin: g,
			get sections() {
				return t.sections;
			},
			get following() {
				return H(l);
			},
			get density() {
				return o();
			},
			get presentation() {
				return H(c);
			},
			set presentation(e) {
				I(c, e);
			}
		}), (e) => I(p, e, !0), () => H(p));
	}, ne = (e) => {
		G(e, ib());
	};
	q(te, (e) => {
		n().indexed ? e(A) : n().loading && e(ne, 1);
	}), N(b), V(() => {
		Y(S, "aria-pressed", H(l)), Y(S, "title", H(l) ? "Following new calls. Select to stop following." : "Select to follow new calls.");
	}), U("click", S, () => H(l) ? g() : _()), G(e, b);
	var re = Ve(y);
	return i(), re;
}
kr(["click"]);
//#endregion
//#region scripts/theme-html.ts
function cb(e) {
	let t = Object.entries(e.tokens).map(([e, t]) => `--${e}:${t};`), n = Object.entries(e.itemTypes).map(([e, t]) => `--item-type-${e}:${t};`), r = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5l5 5 5-5' fill='none' stroke='${e.tokens.secondary.replace("#", "%23")}' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;
	return `color-scheme:${e.colorScheme};${t.join("")}${n.join("")}--chevron:${r};`;
}
function lb(e = Object.values(ya), t = "html") {
	let n = t === "html" ? ":root" : ":host", r = t === "html" ? "html{background:var(--page)}" : "", i = (e) => t === "html" ? `html[data-theme="${e}"]` : `:host([data-theme="${e}"])`;
	return `${n}{${cb(ya.dark)}}${r}${e.map((e) => `${i(e.id)}{${cb(e)}}`).join("")}`;
}
//#endregion
//#region src/lib/styles/workspace.css?inline
var ub = ":root,:host{--text-xs:11px;--text-sm:12px;--text-md:13px;--text-lg:15px;--radius:8px;--control-radius:6px;--radius-small:2px;--space-1:4px;--space-2:8px;--space-3:12px;--space-4:16px;--space-5:24px;--space-6:32px;--control-padding:7px 9px;--control-size:32px;--toggle-height:30px;--toggle-padding:4px 9px;--panel-padding:15px;--panel-gap:14px}*{box-sizing:border-box}button,select{background-color:var(--surface);border:1px solid var(--control-border);color:var(--text);border-radius:var(--control-radius);padding:var(--control-padding)}button{cursor:pointer}button:hover{background-color:var(--surface-raised)}:focus-visible{outline:2px solid var(--accent);outline-offset:3px}summary:focus-visible{border-radius:var(--radius-small)}.sr-only{clip:rect(0, 0, 0, 0);white-space:nowrap;border:0;width:1px;height:1px;margin:-1px;padding:0;position:absolute;overflow:hidden}.toggle-group{flex-wrap:wrap;align-items:center;gap:5px;display:flex}.toggle-label{color:var(--text);margin-right:3px;font-weight:650}.toggle-group>button{min-height:var(--toggle-height);padding:var(--toggle-padding);border:1px solid var(--separator);background-color:var(--surface);color:var(--text);font:inherit}.toggle-group>button[aria-pressed=true]{border-color:var(--accent);background-color:var(--action);color:var(--active-text)}input{color:var(--text);background:var(--plot);border:1px solid var(--control-border)}summary{cursor:pointer}.disclosure{width:fit-content;color:var(--secondary);cursor:pointer;align-items:center;gap:7px;font-size:13px;list-style:none;display:inline-flex}.disclosure::-webkit-details-marker{display:none}.disclosure:before{content:\"\";border-top:4px solid #0000;border-bottom:4px solid #0000;border-left:6px solid;transition:transform .12s}details[open]>.disclosure:before,.disclosure[aria-expanded=true]:before{transform:rotate(90deg)}select{appearance:none;background-image:var(--chevron);background-position:right 12px center;background-repeat:no-repeat;background-size:12px 8px}@media (prefers-reduced-motion:reduce){*,:before,:after{scroll-behavior:auto!important}}", db = {
	standard: ey,
	panel: ty
};
function fb(e, t) {
	return {
		label: No(e),
		colour: ya[t].itemTypes[e]
	};
}
var pb = /* @__PURE__ */ new WeakMap();
function mb(e) {
	let { target: t } = e, n = pb.get(t) ?? t.attachShadow({ mode: "open" });
	if (n.hasChildNodes()) throw Error("Highwater is already mounted in this target");
	pb.set(t, n);
	let r = t.getAttribute("data-theme"), i = document.createElement("style");
	i.textContent = lb(void 0, ":host") + ub + "\n    :host { display:block; background:var(--page); color:var(--text);\n      font:14px/1.45 Inter,ui-sans-serif,system-ui,sans-serif; }\n    .highwater-embed-root { container-type:inline-size; container-name:highwater; min-width:0; }\n    .highwater-embed-root.compact { font-size:13px; --control-padding:4px 8px; --control-size:24px;\n      --toggle-height:24px; --toggle-padding:3px 8px; --panel-padding:12px; --panel-gap:10px; }\n    .highwater-embed-root.compact :is(button:not(.step-call), select, input, summary) { font-size:12px; }\n  ";
	let a = document.createElement("div");
	a.className = e.density === "compact" ? "highwater-embed-root compact" : "highwater-embed-root", n.append(i, a);
	let o = !1;
	function s(e) {
		o || (t.dataset.theme = e, Ma.setPalette(e));
	}
	s(e.theme);
	let c;
	try {
		c = Kr(sb, {
			target: a,
			props: {
				loadAnalysis: e.loadAnalysis,
				loadItemContent: e.loadItemContent,
				preferencesKey: e.preferencesKey,
				sections: e.sections,
				defaultVerticalScale: e.defaultVerticalScale,
				density: e.density
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
			o || (o = !0, Xr(c), n.replaceChildren(), r === null ? t.removeAttribute("data-theme") : t.setAttribute("data-theme", r));
		}
	};
}
//#endregion
export { fb as contextItemPresentation, mb as mountHighwater, db as sectionPresets };
