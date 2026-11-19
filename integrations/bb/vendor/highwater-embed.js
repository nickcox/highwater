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
var h = 1024, g = 2048, _ = 4096, v = 8192, y = 16384, b = 32768, x = 1 << 25, S = 65536, ee = 1 << 19, C = 1 << 20, te = 1 << 25, w = 65536, T = 1 << 21, E = 1 << 22, D = 1 << 23, O = Symbol("$state"), ne = Symbol("component"), re = Symbol("legacy props"), ie = Symbol(""), ae = Symbol("attributes"), oe = Symbol("class"), se = Symbol("style"), ce = Symbol("text"), le = Symbol("form reset"), ue = new class extends Error {
	name = "StaleReactionError";
	message = "The reaction that called `getAbortSignal()` was re-run or destroyed";
}(), de = !!globalThis.document?.contentType && /* @__PURE__ */ globalThis.document.contentType.includes("xml"), fe = {}, pe = Symbol("uninitialized"), me = "http://www.w3.org/1999/xhtml";
function he() {
	console.warn("https://svelte.dev/e/derived_inert");
}
function ge(e) {
	console.warn("https://svelte.dev/e/hydration_mismatch");
}
function _e() {
	console.warn("https://svelte.dev/e/select_multiple_invalid_value");
}
function ve() {
	console.warn("https://svelte.dev/e/svelte_boundary_reset_noop");
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/hydration.js
var k = !1;
function ye(e) {
	k = e;
}
var A;
function be(e) {
	if (e === null) throw ge(), fe;
	return A = e;
}
function xe() {
	return be(/* @__PURE__ */ dn(A));
}
function j(e) {
	if (k) {
		if (/* @__PURE__ */ dn(A) !== null) throw ge(), fe;
		A = e;
	}
}
function Se(e = 1) {
	if (k) {
		for (var t = e, n = A; t--;) n = /* @__PURE__ */ dn(n);
		A = n;
	}
}
function Ce(e = !0) {
	for (var t = 0, n = A;;) {
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
function we(e) {
	if (!e || e.nodeType !== 8) throw ge(), fe;
	return e.data;
}
//#endregion
//#region node_modules/svelte/src/internal/client/reactivity/equality.js
function Te(e) {
	return e === this.v;
}
function Ee(e, t) {
	return e == e ? e !== t || typeof e == "object" && !!e || typeof e == "function" : t == t;
}
function De(e) {
	return !Ee(e, this.v);
}
function Oe(e) {
	throw Error("https://svelte.dev/e/lifecycle_outside_component");
}
//#endregion
//#region node_modules/svelte/src/internal/client/errors.js
function ke() {
	throw Error("https://svelte.dev/e/async_derived_orphan");
}
function Ae(e, t, n) {
	throw Error("https://svelte.dev/e/each_key_duplicate");
}
function je(e) {
	throw Error("https://svelte.dev/e/effect_in_teardown");
}
function Me() {
	throw Error("https://svelte.dev/e/effect_in_unowned_derived");
}
function Ne(e) {
	throw Error("https://svelte.dev/e/effect_orphan");
}
function Pe() {
	throw Error("https://svelte.dev/e/effect_update_depth_exceeded");
}
function Fe(e) {
	throw Error("https://svelte.dev/e/props_invalid_value");
}
function Ie() {
	throw Error("https://svelte.dev/e/state_descriptors_fixed");
}
function M() {
	throw Error("https://svelte.dev/e/state_prototype_fixed");
}
function Le() {
	throw Error("https://svelte.dev/e/state_unsafe_mutation");
}
function Re() {
	throw Error("https://svelte.dev/e/svelte_boundary_reset_onerror");
}
//#endregion
//#region node_modules/svelte/src/internal/client/context.js
var ze = null;
function Be(e) {
	ze = e;
}
function Ve(e, t = !1, n) {
	ze = {
		p: ze,
		i: !1,
		c: null,
		e: null,
		s: e,
		x: null,
		r: Xn,
		l: null
	};
}
function He(e) {
	var t = ze, n = t.e;
	if (n !== null) {
		t.e = null;
		for (var r of n) wn(r);
	}
	return e !== void 0 && (t.x = e), t.i = !0, ze = t.p, Ue(e);
}
function Ue(e = {}) {
	return i(e, ne, { value: !0 }), e;
}
function We() {
	return !0;
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/task.js
var Ge = [];
function Ke() {
	var e = Ge;
	Ge = [], f(e);
}
function qe(e) {
	if (Ge.length === 0 && !jt) {
		var t = Ge;
		queueMicrotask(() => {
			t === Ge && Ke();
		});
	}
	Ge.push(e);
}
function Je() {
	for (; Ge.length > 0;) Ke();
}
//#endregion
//#region node_modules/svelte/src/internal/client/reactivity/status.js
var Ye = ~(g | _ | h);
function Xe(e, t) {
	e.f = e.f & Ye | t;
}
function Ze(e) {
	e.f & 512 || e.deps === null ? Xe(e, h) : Xe(e, _);
}
//#endregion
//#region node_modules/svelte/src/internal/client/reactivity/utils.js
function Qe(e) {
	if (e !== null) for (let t of e) t.f & 2 && t.f & 65536 && (t.f ^= w, Qe(t.deps));
}
function $e(e, t, n) {
	e.f & 2048 ? t.add(e) : e.f & 4096 && n.add(e), Qe(e.deps), Xe(e, h);
}
//#endregion
//#region node_modules/svelte/src/store/utils.js
function et(e, t, n) {
	if (e == null) return t(void 0), n && n(void 0), d;
	let r = yr(() => e.subscribe(t, n));
	return r.unsubscribe ? () => r.unsubscribe() : r;
}
//#endregion
//#region node_modules/svelte/src/store/shared/index.js
var tt = [];
function nt(e, t = d) {
	let n = null, r = /* @__PURE__ */ new Set();
	function i(t) {
		if (Ee(e, t) && (e = t, n)) {
			let t = !tt.length;
			for (let t of r) t[1](), tt.push(t, e);
			if (t) {
				for (let e = 0; e < tt.length; e += 2) tt[e][0](tt[e + 1]);
				tt.length = 0;
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
function rt(e) {
	return { subscribe: e.subscribe.bind(e) };
}
function it(e) {
	let t;
	return et(e, (e) => t = e)(), t;
}
//#endregion
//#region node_modules/svelte/src/internal/client/reactivity/store.js
var at = !1, ot = Symbol("unmounted");
function st(e, t, n) {
	let r = n[t] ??= {
		store: null,
		source: /* @__PURE__ */ Yt(void 0),
		unsubscribe: d
	};
	if (r.store !== e && !(ot in n)) {
		if (r.unsubscribe(), r.store = e ?? null, e == null) r.source.v = void 0, r.unsubscribe = d;
		else {
			var i = !0;
			r.unsubscribe = et(e, (e) => {
				i ? r.source.v = e : I(r.source, e);
			}), i = !1;
		}
	}
	return e && ot in n ? it(e) : H(r.source);
}
function ct() {
	let e = {};
	function t() {
		Sn(() => {
			for (var t in e) e[t].unsubscribe();
			i(e, ot, {
				enumerable: !1,
				value: !0
			});
		});
	}
	return [e, t];
}
function lt(e) {
	var t = at;
	try {
		return at = !1, [e(), at];
	} finally {
		at = t;
	}
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/elements/misc.js
var ut = !1;
function dt() {
	ut || (ut = !0, document.addEventListener("reset", (e) => {
		Promise.resolve().then(() => {
			if (!e.defaultPrevented) for (let t of e.target.elements) t[le]?.();
		});
	}, { capture: !0 }));
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/elements/bindings/shared.js
function ft(e) {
	var t = qn, n = Xn;
	Yn(null), Zn(null);
	try {
		return e();
	} finally {
		Yn(t), Zn(n);
	}
}
function pt(e, t, n, r = n) {
	e.addEventListener(t, () => ft(n));
	let i = e[le];
	e[le] = i ? () => {
		i(), r(!0);
	} : () => r(!0), dt();
}
//#endregion
//#region node_modules/svelte/src/internal/client/reactivity/async.js
function mt(e, t, n, r) {
	let i = We() ? vt : xt;
	var a = e.filter((e) => !e.settled), o = t.map(i);
	if (n.length === 0 && a.length === 0) {
		r(o);
		return;
	}
	var s = Xn, c = ht(), l = a.length === 1 ? a[0].promise : a.length > 1 ? Promise.all(a.map((e) => e.promise)) : null;
	function u(e) {
		if (!(s.f & 16384)) {
			c();
			try {
				r([...o, ...e]);
			} catch (e) {
				_n(e, s);
			}
			gt();
		}
	}
	var d = _t();
	if (n.length === 0) {
		l.then(() => u([])).finally(d);
		return;
	}
	function f() {
		Promise.all(n.map((e) => /* @__PURE__ */ bt(e))).then(u).catch((e) => _n(e, s)).finally(d);
	}
	l ? l.then(() => {
		c(), f(), gt();
	}) : f();
}
function ht() {
	var e = Xn, t = qn, n = ze, r = P;
	return function(i = !0) {
		Zn(e), Yn(t), Be(n), i && !(e.f & 16384) && (r?.activate(), r?.apply());
	};
}
function gt(e = !0) {
	Zn(null), Yn(null), Be(null), e && P?.deactivate();
}
function _t() {
	var e = Xn, t = e.b, n = P, r = !!t?.is_rendered();
	return t?.update_pending_count(1, n), n.increment(r, e), () => {
		t?.update_pending_count(-1, n), n.decrement(r, e);
	};
}
/*#__NO_SIDE_EFFECTS__*/
function vt(e) {
	var t = 2 | g;
	return Xn !== null && (Xn.f |= ee), {
		ctx: ze,
		deps: null,
		effects: null,
		equals: Te,
		f: t,
		fn: e,
		reactions: null,
		rv: 0,
		v: pe,
		wv: 0,
		parent: Xn,
		ac: null
	};
}
var yt = Symbol("obsolete");
/*#__NO_SIDE_EFFECTS__*/
function bt(e, t, n) {
	let r = Xn;
	r === null && ke();
	var i = void 0, a = Jt(pe), o = !qn, s = /* @__PURE__ */ new Set();
	return On(() => {
		var t = Xn, n = p();
		i = n.promise;
		try {
			Promise.resolve(e()).then(n.resolve, (e) => {
				e !== ue && n.reject(e);
			}).finally(gt);
		} catch (e) {
			n.reject(e), gt();
		}
		var c = P;
		if (o) {
			if (t.f & 32768) var l = _t();
			if (r.b?.is_rendered()) c.async_deriveds.get(t)?.reject(yt);
			else for (let e of s.values()) e.reject(yt);
			s.add(n), c.async_deriveds.set(t, n);
		}
		let u = (e, t = void 0) => {
			l?.(), s.delete(n), t !== yt && (c.activate(), t ? (a.f |= D, Xt(a, t)) : (a.f & 8388608 && (a.f ^= D), Xt(a, e)), c.deactivate());
		};
		n.promise.then(u, (e) => u(null, e || "unknown"));
	}), Sn(() => {
		for (let e of s) e.reject(yt);
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
function N(e) {
	let t = /* @__PURE__ */ vt(e);
	return $n(t), t;
}
/*#__NO_SIDE_EFFECTS__*/
function xt(e) {
	let t = /* @__PURE__ */ vt(e);
	return t.equals = De, t;
}
function St(e) {
	var t = e.effects;
	if (t !== null) {
		e.effects = null;
		for (var n = 0; n < t.length; n += 1) Fn(t[n]);
	}
}
function Ct(e) {
	var t, n = Xn, r = e.parent;
	if (!Gn && r !== null && e.v !== pe && r.f & 24576) return he(), e.v;
	Zn(r);
	try {
		e.f &= ~w, St(e), t = dr(e);
	} finally {
		Zn(n);
	}
	return t;
}
function wt(e) {
	var t = Ct(e);
	if (!e.equals(t) && (e.wv = cr(), (!P?.is_fork || e.deps === null) && (P === null ? e.v = t : (P.capture(e, t, !0), Ot?.capture(e, t, !0)), e.deps === null))) {
		Xe(e, h);
		return;
	}
	Gn || (kt === null ? Ze(e) : (xn() || P?.is_fork) && kt.set(e, t));
}
function Tt(e) {
	if (e.effects !== null) for (let t of e.effects) (t.teardown || t.ac) && (t.teardown?.(), t.ac !== null && ft(() => {
		t.ac.abort(ue), t.ac = null;
	}), t.fn !== null && (t.teardown = d), mr(t, 0), Nn(t));
}
function Et(e) {
	if (e.effects !== null) for (let t of e.effects) t.teardown && t.fn !== null && hr(t);
}
//#endregion
//#region node_modules/svelte/src/internal/client/reactivity/batch.js
var Dt = null, P = null, Ot = null, kt = null, At = null, jt = !1, Mt = !1, Nt = null, Pt = null, Ft = 0, It = 1, Lt = class e {
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
		Dt === null ? Dt = this : (Dt.#n = this, this.#t = Dt), Dt = this;
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
			for (var r of n.d) Xe(r, g), t(r);
			for (r of n.m) Xe(r, _), t(r);
		}
		this.#p.add(e);
	}
	#g() {
		this.#e = !0, Ft++ > 1e3 && (this.#x(), zt());
		for (let e of this.#u) this.#d.delete(e), Xe(e, g), this.schedule(e);
		for (let e of this.#d) Xe(e, _), this.schedule(e);
		let t = this.#c;
		this.#c = [], this.apply();
		var n = Nt = [], r = [], i = Pt = [];
		for (let e of t) try {
			this.#_(e, n, r);
		} catch (t) {
			throw Wt(e), this.#h() || this.discard(), t;
		}
		if (P = null, i.length > 0) {
			var a = e.ensure();
			for (let e of i) a.schedule(e);
		}
		if (Nt = null, Pt = null, this.#h()) {
			this.#b(r), this.#b(n);
			for (let [e, t] of this.#f) Ut(e, t);
			i.length > 0 && P.#g();
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
		var s = P;
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
					r & 4194320 && !this.async_deriveds.has(i) && (this.#d.delete(i), Xe(i, g), this.schedule(i));
				}
			}
		};
		for (let e of this.current.keys()) t(e);
		this.oncommit(() => e.discard()), e.#x(), P = this, this.#g();
	}
	#b(e) {
		for (var t = 0; t < e.length; t += 1) $e(e[t], this.#u, this.#d);
	}
	capture(e, t, n = !1) {
		e.v !== pe && !this.previous.has(e) && this.previous.set(e, e.v), e.f & 8388608 || (this.current.set(e, [t, n]), kt?.set(e, t)), this.is_fork || (e.v = t);
	}
	activate() {
		P = this;
	}
	deactivate() {
		P = null, kt = null;
	}
	flush() {
		try {
			Mt = !0, P = this, this.#g();
		} finally {
			Ft = 0, At = null, Nt = null, Pt = null, Mt = !1, P = null, kt = null, Kt.clear();
		}
	}
	discard() {
		for (let e of this.#i) e(this);
		this.#i.clear();
		for (let e of this.async_deriveds.values()) e.reject(yt);
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
		this.#m || (this.#m = !0, qe(() => {
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
		if (P === null) {
			let t = P = new e();
			!Mt && !jt && qe(() => {
				t.#e || t.flush();
			});
		}
		return P;
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
			e === null || (e.#n = t), t === null ? Dt = e : t.#t = e, this.linked = !1;
		}
	}
};
function Rt(e) {
	var t = jt;
	jt = !0;
	try {
		var n;
		for (e && (P !== null && !P.is_fork && P.flush(), n = e());;) {
			if (Je(), P === null) return n;
			P.flush();
		}
	} finally {
		jt = t;
	}
}
function zt() {
	try {
		Pe();
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
	P.schedule(e);
}
function Ut(e, t) {
	if (!(e.f & 32 && e.f & 1024)) {
		e.f & 2048 ? t.d.push(e) : e.f & 4096 && t.m.push(e), Xe(e, h);
		for (var n = e.first; n !== null;) Ut(n, t), n = n.next;
	}
}
function Wt(e) {
	Xe(e, h);
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
		equals: Te,
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
	return t || (r.equals = De), r;
}
function I(e, t, n = !1) {
	return qn !== null && (!Jn || qn.f & 131072) && We() && qn.f & 4325394 && (Qn === null || !Qn.has(e)) && Le(), Xt(e, n ? en(t) : t, Pt);
}
function Xt(e, t, n = null) {
	if (!e.equals(t)) {
		Gn ? Kt.set(e, t) : Kt.has(e) || Kt.set(e, e.v);
		var r = Lt.ensure();
		if (r.capture(e, t), e.f & 2) {
			let t = e;
			e.f & 2048 && Ct(t), kt === null && Ze(t);
		}
		e.wv = cr(), $t(e, g, n), We() && Xn !== null && Xn.f & 1024 && !(Xn.f & 96) && (nr === null ? rr([e]) : nr.push(e)), !r.is_fork && Gt.size > 0 && !qt && Zt();
	}
	return t;
}
function Zt() {
	qt = !1;
	for (let e of Gt) {
		e.f & 1024 && Xe(e, _);
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
	if (r !== null) for (var i = We(), a = r.length, o = 0; o < a; o++) {
		var s = r[o], c = s.f;
		if (i || s !== Xn) {
			var l = (c & g) === 0;
			if (l && Xe(s, t), c & 131072) Gt.add(s);
			else if (c & 2) {
				var u = s;
				kt?.delete(u), c & 65536 || (c & 512 && (Xn === null || !(Xn.f & 2097152)) && (s.f |= w), $t(u, _, n));
			} else if (l) {
				var d = s;
				c & 16 && Bt !== null && Bt.add(d), n === null ? Ht(d) : n.push(d);
			}
		}
	}
}
function en(t) {
	if (typeof t != "object" || !t || O in t || ne in t) return t;
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
			(!("value" in n) || n.configurable === !1 || n.enumerable === !1 || n.writable === !1) && Ie();
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
					let e = f(() => /* @__PURE__ */ F(pe, u));
					r.set(t, e), Qt(o);
				}
			} else I(n, pe), Qt(o);
			return !0;
		},
		get(e, n, i) {
			if (n === O) return t;
			var o = r.get(n), s = n in e;
			if (o === void 0 && (!s || a(e, n)?.writable) && (o = f(() => /* @__PURE__ */ F(en(s ? e[n] : pe), u)), r.set(n, o)), o !== void 0) {
				var c = H(o);
				return c === pe ? void 0 : c;
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
				if (a !== void 0 && o !== pe) return {
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
			var n = r.get(t), i = n !== void 0 && n.v !== pe || Reflect.has(e, t);
			return (n !== void 0 || Xn !== null && (!i || a(e, t)?.writable)) && (n === void 0 && (n = f(() => /* @__PURE__ */ F(i ? en(e[t]) : pe, u)), r.set(t, n)), H(n) === pe) ? !1 : i;
		},
		set(e, t, n, s) {
			var c = r.get(t), l = t in e;
			if (i && t === "length") for (var d = n; d < c.v; d += 1) {
				var p = r.get(d + "");
				p === void 0 ? d in e && (p = f(() => /* @__PURE__ */ F(pe, u)), r.set(d + "", p)) : I(p, pe);
			}
			if (c === void 0) (!l || a(e, t)?.writable) && (c = f(() => /* @__PURE__ */ F(void 0, u)), I(c, en(n)), r.set(t, c));
			else {
				l = c.v !== pe;
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
				return t === void 0 || t.v !== pe;
			});
			for (var [n, i] of r) i.v !== pe && !(n in e) && t.push(n);
			return t;
		},
		setPrototypeOf() {
			M();
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
		on = a(t, "firstChild").get, sn = a(t, "nextSibling").get, u(e) && (e[oe] = void 0, e[ae] = null, e[se] = void 0, e.__e = void 0), u(n) && (n[ce] = void 0);
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
	if (!k) return /* @__PURE__ */ un(e);
	var n = /* @__PURE__ */ un(A);
	if (n === null) n = A.appendChild(ln());
	else if (t && n.nodeType !== 3) {
		var r = ln();
		return n?.before(r), be(r), r;
	}
	return t && hn(n), be(n), n;
}
function R(e, t = !1) {
	if (!k) {
		var n = /* @__PURE__ */ un(e);
		return n instanceof Comment && n.data === "" ? /* @__PURE__ */ dn(n) : n;
	}
	if (t) {
		if (A?.nodeType !== 3) {
			var r = ln();
			return A?.before(r), be(r), r;
		}
		hn(A);
	}
	return A;
}
function z(e, t = !1) {
	if (!k) return /* @__PURE__ */ un(e);
	var n = L(e, t);
	return j(e), n;
}
function B(e, t = 1, n = !1) {
	let r = k ? A : e;
	for (var i; t--;) i = r, r = /* @__PURE__ */ dn(r);
	if (!k) return r;
	if (n) {
		if (r?.nodeType !== 3) {
			var a = ln();
			return r === null ? i?.after(a) : r.before(a), be(a), a;
		}
		hn(r);
	}
	return be(r), r;
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
	Xn === null && (qn === null && Ne(e), Me()), Gn && je(e);
}
function yn(e, t) {
	var n = t.last;
	n === null ? t.last = t.first = e : (n.next = e, e.prev = n, t.last = e);
}
function bn(e, t) {
	var n = Xn;
	n !== null && n.f & 8192 && (e |= v);
	var r = {
		ctx: ze,
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
	P?.register_created_effect(r);
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
	return Xe(t, h), t.teardown = e, t;
}
function Cn(e) {
	vn("$effect");
	var t = Xn.f;
	if (!qn && t & 32 && ze !== null && !ze.i) {
		var n = ze;
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
	return bn(E | ee, e);
}
function kn(e, t = 0) {
	return bn(8 | t, e);
}
function V(e, t = [], n = [], r = []) {
	mt(r, t, n, (t) => {
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
		e !== null && ft(() => {
			e.abort(ue);
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
		e.f ^= v, e.f & 1024 || (Xe(e, g), Lt.ensure().schedule(e));
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
	if (t & 2 && (e.f &= ~w), t & 4096) {
		for (var n = e.deps, r = n.length, i = 0; i < r; i++) {
			var a = n[i];
			if (lr(a) && wt(a), a.wv > e.wv) return !0;
		}
		t & 512 && kt === null && Xe(e, h);
	}
	return !1;
}
function ur(e, t, n = !0) {
	var r = e.reactions;
	if (r !== null && !(Qn !== null && Qn.has(e))) for (var i = 0; i < r.length; i++) {
		var a = r[i];
		a.f & 2 ? ur(a, t, !1) : t === a && (n ? Xe(a, g) : a.f & 1024 && Xe(a, _), Ht(a));
	}
}
function dr(e) {
	var t = er, n = tr, r = nr, i = qn, a = Qn, o = ze, s = Jn, c = or, l = e.f;
	er = null, tr = 0, nr = null, qn = l & 96 ? null : e, Qn = null, Be(e.ctx), Jn = !1, or = ++ar, e.ac !== null && (ft(() => {
		e.ac.abort(ue);
	}), e.ac = null);
	try {
		e.f |= T;
		var u = e.fn, d = u();
		e.f |= b;
		var f = fr(e);
		if (We() && nr !== null && !Jn && f !== null && !(e.f & 6146)) for (var p = 0; p < nr.length; p++) ur(nr[p], e);
		if (i !== null && i !== e) {
			if (ar++, i.deps !== null) for (let e = 0; e < n; e += 1) i.deps[e].rv = ar;
			if (t !== null) for (let e of t) e.rv = ar;
			nr !== null && (r === null ? r = nr : r.push(...nr));
		}
		return e.f & 8388608 && (e.f ^= D), d;
	} catch (t) {
		return fr(e), gn(t);
	} finally {
		e.f ^= T, er = t, tr = n, nr = r, qn = i, Qn = a, Be(o), Jn = s, or = c;
	}
}
function fr(e) {
	var t = e.deps, n = P?.is_fork;
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
		s.f & 512 && (s.f ^= 512, s.f &= ~w), s.v !== pe && Ze(s), s.ac !== null && ft(() => {
			s.ac.abort(ue), s.ac = null, Xe(s, g);
		}), Tt(s), mr(s, 0);
	}
}
function mr(e, t) {
	var n = e.deps;
	if (n !== null) for (var r = t; r < n.length; r++) pr(e, n[r]);
}
function hr(e) {
	var t = e.f;
	if (!(t & 16384)) {
		Xe(e, h);
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
			return (!(a.f & 1024) && a.reactions !== null || vr(a)) && (o = Ct(a)), Kt.set(a, o), o;
		}
		var s = !(a.f & 512) && !Jn && qn !== null && (Wn || !!(qn.f & 512)), c = (a.f & b) === 0;
		lr(a) && (s && (a.f |= 512), wt(a)), s && !c && (Et(a), _r(a));
	}
	if (kt?.has(e)) return kt.get(e);
	if (e.f & 8388608) throw e.v;
	return e.v;
}
function _r(e) {
	if (e.f |= 512, e.deps !== null) for (let t of e.deps) (t.reactions ??= []).push(e), t.f & 2 && !(t.f & 512) && (Et(t), _r(t));
}
function vr(e) {
	if (e.v === pe) return !0;
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
		if (r.capture || Mr.call(t, e), !e.cancelBubble) return ft(() => n?.call(this, e));
	}
	return e.startsWith("pointer") || e.startsWith("touch") || e === "wheel" ? qe(() => {
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
		if (k) return Ir(A, null), A;
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
		if (k) return Ir(A, null), A;
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
	if (!k) {
		var t = ln(e + "");
		return Ir(t, t), t;
	}
	var n = A;
	return n.nodeType === 3 ? hn(n) : (n.before(n = ln()), be(n)), Ir(n, n), n;
}
function Br() {
	if (k) return Ir(A, null), A;
	var e = document.createDocumentFragment(), t = document.createComment(""), n = ln();
	return e.append(t, n), Ir(t, n), e;
}
function G(e, t) {
	if (k) {
		var n = Xn;
		(!(n.f & 32768) || n.nodes.end === null) && (n.nodes.end = A), xe();
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
			qe(() => {
				--t, t === 0 && (r?.(), r = void 0, Qt(n));
			});
		})));
	};
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/blocks/boundary.js
var Hr = S | ee;
function Ur(e, t, n, r) {
	new Wr(e, t, n, r);
}
var Wr = class {
	parent;
	is_pending = !1;
	transform_error;
	#e;
	#t = k ? A : null;
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
			if (k) {
				let e = this.#t;
				xe();
				let t = e.data === "[!";
				if (e.data.startsWith("[?")) {
					let t = JSON.parse(e.data.slice(2));
					this.#_(t);
				} else t ? this.#y() : this.#g();
			} else this.#b();
		}, Hr), k && (this.#e = A);
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
		qe(r), t && (this.#s = jn(() => {
			t(this.#e, () => e, () => n);
		}));
	}
	#v(e) {
		var t = !1, n = !1;
		let r = () => {
			if (t) {
				ve();
				return;
			}
			t = !0, n && Re(), this.#s !== null && Rn(this.#s, () => {
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
		e && (this.is_pending = !0, this.#o = jn(() => e(this.#e)), qe(() => {
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
				this.#c = null, n && this.#x(P);
				return;
			}
			this.#u === 0 && (this.#e.before(e), this.#c = null, Rn(this.#o, () => {
				this.#o = null;
			}), this.#x(P));
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
			} else this.#x(P);
		} catch (e) {
			this.error(e);
		}
	}
	#x(e) {
		this.is_pending = !1, e.transfer_effects(this.#f, this.#p);
	}
	defer_effect(e) {
		$e(e, this.#f, this.#p);
	}
	is_rendered() {
		return !this.is_pending && (!this.parent || this.parent.is_rendered());
	}
	has_pending_snippet() {
		return !!this.#n.pending;
	}
	#S(e) {
		var t = Xn, n = qn, r = ze;
		Zn(this.#i), Yn(this.#i), Be(this.#i.ctx);
		try {
			return Lt.ensure(), e();
		} finally {
			Zn(t), Yn(n), Be(r);
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
		this.#C(e, t), this.#l += e, !(!this.#m || this.#d) && (this.#d = !0, qe(() => {
			this.#d = !1, this.#m && Xt(this.#m, this.#l);
		}));
	}
	get_effect_pending() {
		return this.#h(), H(this.#m);
	}
	error(e) {
		if (!this.#n.onerror && !this.#n.failed) throw e;
		P?.is_fork ? (this.#a && P.skip_effect(this.#a), this.#o && P.skip_effect(this.#o), this.#s && P.skip_effect(this.#s), P.oncommit(() => {
			this.#w(e);
		})) : this.#w(e);
	}
	#w(e) {
		this.#a &&= (Fn(this.#a), null), this.#o &&= (Fn(this.#o), null), this.#s &&= (Fn(this.#s), null), k && (be(this.#t), Se(), be(Ce()));
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
		qe(() => {
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
	n !== (e[ce] ??= e.nodeValue) && (e[ce] = n, e.nodeValue = `${n}`);
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
			Ve({});
			var n = ze;
			if (o && (n.c = o), a && (i.$$events = a), k && Ir(t, null), l = e(t, i) || Ue(), k && (Xn.nodes.end = A, A === null || A.nodeType !== 8 || A.data !== "]")) throw ge(), fe;
			He();
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
		var n = P, r = pn();
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
		} else k && (this.anchor = A), this.#a(n);
	}
};
//#endregion
//#region node_modules/svelte/src/internal/client/dom/blocks/if.js
function q(e, t, n = !1) {
	var r;
	k && (r = A, xe());
	var i = new Xr(e), a = n ? S : 0;
	function o(e, t) {
		if (k) {
			var n = we(r);
			if (e !== parseInt(n.substring(1))) {
				var a = Ce();
				be(a), i.anchor = a, ye(!1), i.ensure(e, t), ye(!0);
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
	k && xe();
	var r = new Xr(e), i = !We();
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
		r?.has(a) ? (a.f |= te, Hn(a, document.createDocumentFragment())) : Fn(t[i], n);
	}
}
var ni;
function J(t, n, i, a, o, s = null) {
	var c = t, l = /* @__PURE__ */ new Map();
	if (n & 4) {
		var u = t;
		c = k ? be(/* @__PURE__ */ un(u)) : u.appendChild(ln());
	}
	k && xe();
	var d = null, f = /* @__PURE__ */ xt(() => {
		var t = i();
		return e(t) ? t : t == null ? [] : r(t);
	}), p, m = /* @__PURE__ */ new Map(), h = !0;
	function g(e) {
		v.effect.f & 16384 || (v.pending.delete(e), v.fallback = d, ii(v, p, c, n, a), d !== null && (p.length === 0 ? d.f & 33554432 ? (d.f ^= te, oi(d, null, c)) : Bn(d) : Rn(d, () => {
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
			k && we(c) === "[!" != (e === 0) && (c = Ce(), be(c), ye(!1), t = !0);
			for (var r = /* @__PURE__ */ new Set(), u = P, v = pn(), y = 0; y < e; y += 1) {
				k && A.nodeType === 8 && A.data === "]" && (c = A, t = !0, ye(!1));
				var b = p[y], x = a(b, y), S = h ? null : l.get(x);
				S ? (S.v && Xt(S.v, b), S.i && Xt(S.i, y), v && u.unskip_effect(S.e)) : (S = ai(l, h ? c : ni ??= ln(), b, x, y, o, n, i), h || (S.e.f |= te), l.set(x, S)), r.add(x);
			}
			if (e === 0 && s && !d && (h ? d = jn(() => s(c)) : (d = jn(() => s(ni ??= ln())), d.f |= te)), e > r.size && Ae("", "", ""), k && e > 0 && be(Ce()), !h) {
				if (m.set(u, r), v) {
					for (let [e, t] of l) r.has(e) || u.skip_effect(t.e);
					u.oncommit(g), u.ondiscard(_);
				} else g(u);
			}
			t && ye(!0), H(f);
		}),
		flags: n,
		items: l,
		pending: m,
		outrogroups: null,
		fallback: d
	};
	h = !1, k && (c = A);
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
			if (_.f ^= te, _ === l) oi(_, null, n);
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
					var S = p[0], ee = p[p.length - 1];
					for (x = 0; x < p.length; x += 1) oi(p[x], b, n);
					for (x = 0; x < m.length; x += 1) u.delete(m[x]);
					si(e, S.prev, ee.next), si(e, d, S), si(e, ee, b), l = b, d = ee, --v, p = [], m = [];
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
		var C = [];
		if (u !== void 0) for (_ of u) _.f & 8192 || C.push(_);
		for (; l !== null;) !(l.f & 8192) && l !== e.fallback && C.push(l), l = ri(l.next);
		var w = C.length;
		if (w > 0) {
			var T = i & 4 && s === 0 ? n : null;
			if (o) {
				for (v = 0; v < w; v += 1) C[v].nodes?.a?.measure();
				for (v = 0; v < w; v += 1) C[v].nodes?.a?.fix();
			}
			ei(e, C, T);
		}
	}
	o && qe(() => {
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
				br(e), i && Ee(a, e) && (a = e, r.update(e));
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
	var o = e[oe];
	if (k || o !== n || o === void 0) {
		var s = fi(n, r, a);
		(!k || s !== e.getAttribute("class")) && (s == null ? e.removeAttribute("class") : t ? e.className = s : e.setAttribute("class", s)), e[oe] = n;
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
	var i = e[se];
	if (k || i !== t) {
		var a = hi(t, r);
		(!k || a !== e.getAttribute("style")) && (a == null ? e.removeAttribute("style") : e.style.cssText = a), e[se] = t;
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
		if (!e(n)) return _e();
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
	pt(e, "change", (t) => {
		var i = t ? "[selected]" : ":checked", a;
		if (e.multiple) a = [].map.call(e.querySelectorAll(i), wi);
		else {
			var o = e.querySelector(i) ?? e.querySelector("option:not([disabled])");
			a = o && wi(o);
		}
		n(a), e.__value = a, P !== null && r.add(P);
	}), Dn(() => {
		var a = t();
		if (e === document.activeElement) {
			var o = P;
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
var Ei = Symbol("is custom element"), Di = Symbol("is html"), Oi = de ? "link" : "LINK";
function ki(e) {
	if (k) {
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
		e[le] = n, qe(n), dt();
	}
}
function Y(e, t, n, r) {
	var i = Ai(e);
	k && (i[t] = e.getAttribute(t), t === "src" || t === "srcset" || t === "href" && e.nodeName === Oi) || i[t] !== (i[t] = n) && (t === "loading" && (e[ie] = n), n == null ? e.removeAttribute(t) : typeof n != "string" && Mi(e).has(t) ? e[t] = n : e.setAttribute(t, n));
}
function Ai(e) {
	return e[ae] ??= {
		[Ei]: e.nodeName.includes("-"),
		[Di]: e.namespaceURI === me
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
	pt(e, "input", async (i) => {
		var a = i ? e.defaultValue : e.value;
		if (a = Pi(e) ? Fi(a) : a, n(a), P !== null && r.add(P), await gr(), a !== (a = t())) {
			var o = e.selectionStart, s = e.selectionEnd, c = e.value.length;
			if (e.value = a ?? "", s !== null) {
				var l = e.value.length;
				o === s && s === c && l > c ? (e.selectionStart = l, e.selectionEnd = l) : (e.selectionStart = o, e.selectionEnd = Math.min(s, l));
			}
		}
	}), (k && e.defaultValue !== e.value || yr(t) == null && e.value) && (n(Pi(e) ? Fi(e.value) : e.value), P !== null && r.add(P)), kn(() => {
		var n = t();
		if (e === document.activeElement) {
			var i = P;
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
function Li(e = Ue(), t, n, r) {
	var i = ze.r, a = Xn;
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
	var i = !0, o = !!(n & 8), s = !!(n & 16), c = r, l = !0, u = void 0, d = () => s && i ? (u ??= /* @__PURE__ */ vt(r), H(u)) : (l && (l = !1, c = s ? yr(r) : r), c);
	let f;
	if (o) {
		var p = O in e || re in e;
		f = a(e, t)?.set ?? (p && t in e ? (n) => e[t] = n : void 0);
	}
	var m, h = !1;
	o ? [m, h] = lt(() => e[t]) : m = e[t], m === void 0 && r !== void 0 && (m = d(), f && (i && Fe(t), f(m)));
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
	var v = !1, y = (n & 1 ? vt : xt)(() => (v = !1, g()));
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
	ze === null && Oe("onMount"), Cn(() => {
		let t = yr(e);
		if (typeof t == "function") return t;
	});
}
function Bi(e) {
	ze === null && Oe("onDestroy"), zi(() => () => yr(e));
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
	Ve(t, !0), li(e, ga);
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
	ci(L(h), () => t.children ?? d), j(h), Li(h, (e) => I(r, e), () => H(r)), j(p), V(() => {
		Y(m, "aria-label", t.label), Y(m, "aria-expanded", H(a)), Y(m, "aria-controls", t.id), Y(h, "id", t.id), g = gi(h, 1, "info-popover svelte-jsd3h9", null, g, { placing: !H(o) }), Y(h, "hidden", !H(a)), vi(h, H(i));
	}), U("keydown", p, u), U("click", m, () => H(a) ? l(!0) : c()), G(e, p), He();
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
	let e = nt("system"), t = nt(va.dark), n = "system", r = null, i = null;
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
		preference: rt(e),
		palette: rt(t),
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
	Ve(t, !0), li(e, Ja);
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
	j(i), V(() => {
		Y(a, "aria-label", `Copy ${t.label}`), K(o, H(n));
	}), U("click", a, r), G(e, i), He();
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
	Ve(t, !0), li(e, Is);
	let n = () => st(Ma, "$activePalette", r), [r, i] = ct(), a = X(t, "pinnedCallIndex", 3, null), o = X(t, "selectedItemId", 3, null), s = X(t, "isVisible", 3, !1), c = X(t, "scope", 7, "cumulative"), l = X(t, "endpointNotice", 3, ""), u = X(t, "onScopeChange", 3, null), d = X(t, "onUnpinCall", 3, () => {}), f = X(t, "onRevealInRiver", 3, () => {}), p = X(t, "onViewDetails", 3, () => {}), m = X(t, "onFindInLifespans", 3, () => {}), h = X(t, "compact", 3, !1), g = /* @__PURE__ */ F(void 0), _ = /* @__PURE__ */ F(null), v = /* @__PURE__ */ F(null), y = /* @__PURE__ */ F(800), b = /* @__PURE__ */ F(null), x = /* @__PURE__ */ N(() => H(b) ?? (h() ? "list" : "treemap")), S = /* @__PURE__ */ F(null), ee = $o(), C = /* @__PURE__ */ N(() => t.indexed.analysis.modelCalls), te = /* @__PURE__ */ N(() => a() === null ? -1 : H(C).findIndex((e) => e.index === a())), w = /* @__PURE__ */ N(() => H(te) < 0 ? null : H(C)[H(te)]), T = /* @__PURE__ */ N(() => H(te) > 0 ? H(C)[H(te) - 1] : null), E = /* @__PURE__ */ N(() => H(te) >= 0 && H(te) < H(C).length - 1 ? H(C)[H(te) + 1] : null), D = /* @__PURE__ */ N(() => s() ? ee.get(t.indexed, c(), a()) : null), O = /* @__PURE__ */ N(() => H(D) ? Go(H(D).items) : []), ne = /* @__PURE__ */ N(() => H(D) !== null && H(D).hasPositiveWeights && !H(D).totalOverflow), re = /* @__PURE__ */ N(() => H(D) && H(ne) ? ts(H(D), H(y), 360) : {
		width: H(y),
		height: 360,
		rectangles: [],
		groups: []
	}), ie = /* @__PURE__ */ N(() => new Set(H(re).rectangles.map(({ item: e }) => e.id))), ae = /* @__PURE__ */ N(() => H(ne) && H(re).rectangles.length > 0), oe = /* @__PURE__ */ N(() => H(ae) ? H(x) : "list"), se = /* @__PURE__ */ N(() => H(oe) === "treemap" ? H(O).filter((e) => H(ie).has(e.id)) : H(O));
	Tn(() => {
		H(se).length > 0 && !H(se).some((e) => e.id === H(S)) && I(S, H(se)[0].id, !0);
	});
	let ce = /* @__PURE__ */ N(() => H(se).findIndex((e) => e.id === H(S))), le = /* @__PURE__ */ N(() => H(O).findIndex((e) => e.id === H(S))), ue = /* @__PURE__ */ N(() => H(le) < 0 ? void 0 : Oe(H(le))), de = /* @__PURE__ */ N(() => o() ? t.indexed.itemById.get(o()) ?? null : null), fe = /* @__PURE__ */ N(() => H(D)?.items.find((e) => e.id === o()) ?? null), pe = /* @__PURE__ */ N(() => H(de) !== null && H(de).presence.length > 0), me = /* @__PURE__ */ N(() => (H(D)?.profileIds ?? []).map((e) => {
		let n = t.indexed.analysis.tokenAnalysis.profiles.find((t) => t.id === e);
		return {
			id: e,
			description: n ? `${n.provider} / ${n.model} · ${Ae(n.method)}` : "Tokenization profile unavailable"
		};
	})), he = /* @__PURE__ */ N(() => H(me).length === 0 ? "Token estimate method unavailable" : H(me).length === 1 ? H(me)[0].description : `Mixed profiles across ${Z(H(me).length)} call profiles`), ge = /* @__PURE__ */ N(() => c() === "atCall" ? H(w) ? `Context composition · Call ${H(w).index}` : "Context composition · No call selected" : H(D)?.scopeEndCallIndex === null || H(D)?.scopeEndCallIndex === void 0 || a() === null ? "Cumulative context usage · Whole session" : `Cumulative context usage · Calls ${H(D).scopeStartCallIndex}–${H(D).scopeEndCallIndex}`), _e = /* @__PURE__ */ N(() => c() === "atCall" ? `${Z(H(D)?.items.length ?? 0)} present items` : `${Z(H(D)?.scopeCallCount ?? 0)} model calls included`), ve = /* @__PURE__ */ N(() => c() === "atCall" ? "Estimated tokens" : "Estimated token-turns"), k = /* @__PURE__ */ N(() => c() === "atCall" ? "estimated item tokens" : "estimated token-turns"), ye = /* @__PURE__ */ N(() => (H(D)?.missingItemCallCount ?? 0) > 0 || (H(D)?.partialItemCallCount ?? 0) > 0 || (H(D)?.unavailableCoverageItemCallCount ?? 0) > 0), A = /* @__PURE__ */ N(() => H(D)?.numericItemCallCount ?? 0), be = /* @__PURE__ */ N(() => H(D)?.totalItemCallCount ?? 0), xe = /* @__PURE__ */ N(() => H(D)?.items.filter((e) => e.tokens === 0).length ?? 0), Ce = /* @__PURE__ */ N(() => H(D)?.items.filter((e) => e.tokens === null && !e.overflowed).length ?? 0), we = /* @__PURE__ */ N(() => H(D)?.items.filter((e) => e.overflowed).length ?? 0), Te = /* @__PURE__ */ N(() => H(D)?.items.filter((e) => (e.tokens ?? 0) > 0).length ?? 0), Ee = /* @__PURE__ */ N(() => H(re).rectangles.length), De = /* @__PURE__ */ N(() => Math.max(0, H(Te) - H(Ee)));
	function Oe(e) {
		return `composition-option-${c()}-${a() ?? "whole"}-${e}`;
	}
	function ke(e) {
		return `composition-tile-clip-${c()}-${a() ?? "whole"}-${e}`;
	}
	function Ae(e) {
		return ma(e, "Mixed or unavailable estimate method");
	}
	function je(e) {
		let t = e.tokens === null ? e.overflowed ? "safe subtotal unavailable because the sum overflowed" : "token estimate unavailable" : `${Z(e.tokens)} estimated ${c() === "atCall" ? "tokens" : "token-turns"}`, n = e.share === null ? "" : `${Va(e.share)} of ${H(ye) ? "available-estimate subset" : "numeric item estimates"}`, r = e.estimateMethods.length > 1 ? "mixed estimate methods" : Ae(e.estimateMethod), i = `estimate coverage ${e.estimateCoverage}`, a = c() === "cumulative" ? `${e.knownContributionCount} of ${e.scopePresenceCount} item-call contributions have numeric estimates; ${e.missingContributionCount} unavailable` : "", o = e.explanations.map((e) => `${e.title}: ${e.impact}`).join("; "), s = e.ageAtCall === null ? "age unavailable" : `age ${e.ageAtCall} calls at the ${c() === "atCall" ? "inspected call" : "scope endpoint"}`;
		return `${e.label}, ${e.kindLabel}, ${t}, ${r}, ${i}${n ? `, ${n}` : ""}${a ? `, ${a}` : ""}${o ? `, ${o}` : ""}, ${s}`;
	}
	function Me(e) {
		I(S, e.id, !0), t.onSelectItem(e.id);
	}
	async function Ne() {
		if (await gr(), H(oe) !== "list" || !H(_) || !H(ue)) return;
		let e = Vi(H(_)).getElementById(H(ue));
		if (!e || !H(_).contains(e)) return;
		let t = H(_).getBoundingClientRect(), n = e.getBoundingClientRect();
		n.top < t.top ? H(_).scrollTop += n.top - t.top : n.bottom > t.bottom && (H(_).scrollTop += n.bottom - t.bottom);
	}
	function Pe(e) {
		if (H(se).length === 0) return;
		let t = H(ce) < 0 ? 0 : H(ce);
		if (e.key === "ArrowDown" || e.key === "ArrowRight") t = Math.min(H(se).length - 1, t + 1);
		else if (e.key === "ArrowUp" || e.key === "ArrowLeft") t = Math.max(0, t - 1);
		else if (e.key === "Home") t = 0;
		else if (e.key === "End") t = H(se).length - 1;
		else if (e.key === "Enter" || e.key === " ") {
			let n = H(se)[t];
			n && Me(n), e.preventDefault();
			return;
		} else return;
		e.preventDefault(), I(S, H(se)[t]?.id ?? null, !0), Ne();
	}
	function Fe(e) {
		I(b, e, !0);
	}
	function Ie(e) {
		c() !== e && (c(e), u()?.(e));
	}
	function M(e) {
		e.key === "Escape" && H(v)?.open && (e.preventDefault(), e.stopPropagation(), H(v).open = !1, H(v).querySelector("summary")?.focus());
	}
	function Le(e) {
		return e.tokens === null ? e.overflowed ? "Subtotal exceeds safe range" : "Unavailable" : `${Z(e.tokens)} ${c() === "atCall" ? "estimated tokens" : "estimated token-turns"}`;
	}
	function Re(e) {
		return e.share === null ? "Share unavailable" : `${Va(e.share)} of ${H(ye) ? "available-estimate subset" : "numeric estimates"}`;
	}
	function ze() {
		return !H(D) || H(be) === 0 ? "No item appearances are in this scope" : H(A) === H(be) ? "Numeric estimates available for all item appearances in this scope" : `Numeric estimates available for ${Z(H(A))} of ${Z(H(be))} item appearances in this scope`;
	}
	function Be() {
		let e = [];
		return H(xe) > 0 && e.push(`${Z(H(xe))} zero-valued items`), H(Ce) > 0 && e.push(`${Z(H(Ce))} unavailable estimates`), H(we) > 0 && e.push(`${Z(H(we))} overflowed subtotals`), H(De) > 0 && e.push(`${Z(H(De))} positive items too small to render at this layout size`), e.join("; ");
	}
	function Ue() {
		if (!H(D)) return "";
		let e = [];
		return H(D).totalOverflow && e.push("The safe integer range was exceeded; shares and areas are withheld."), H(D).missingItemCallCount > 0 && e.push(`${Z(H(D).missingItemCallCount)} of ${Z(H(D).totalItemCallCount)} item-call contributions have no numeric estimate; subtotals and shares use the available-estimate subset.`), H(D).partialItemCallCount > 0 && e.push(`${Z(H(D).partialItemCallCount)} item-call estimates have partial payload coverage; subtotals remain qualified.`), H(D).unavailableCoverageItemCallCount > 0 && e.push(`${Z(H(D).unavailableCoverageItemCallCount)} item-call estimates have unavailable semantic coverage; any numeric contributions remain usable but qualified.`), e.join(" ");
	}
	function We() {
		if (!H(g) || !s()) return;
		let e = H(g).clientWidth;
		e > 0 && Math.abs(e - H(y)) > .5 && I(y, e, !0);
	}
	Cn(() => {
		s() && yr(We);
	}), zi(() => {
		We();
		let e = typeof ResizeObserver > "u" ? null : new ResizeObserver((e) => {
			let t = e[0]?.contentRect.width;
			s() && t && Math.abs(t - H(y)) > .5 && I(y, t, !0);
		});
		return H(g) && e?.observe(H(g)), window.addEventListener("resize", We), () => {
			e?.disconnect(), window.removeEventListener("resize", We);
		};
	});
	var Ge = Fs(), Ke = L(Ge), qe = (e) => {
		var t = rs(), n = L(t), r = L(n), i = B(r, 2);
		j(n);
		var a = B(n, 2), o = (e) => {
			var t = ns(), n = L(t), r = B(n, 2);
			j(t), V(() => {
				Y(n, "aria-pressed", H(x) === "treemap"), Y(r, "aria-pressed", H(x) === "list");
			}), U("click", n, () => Fe("treemap")), U("click", r, () => Fe("list")), G(e, t);
		};
		q(a, (e) => {
			H(D) && (c() !== "atCall" || H(w) !== null) && e(o);
		}), j(t), V(() => {
			Y(r, "aria-pressed", c() === "atCall"), Y(i, "aria-pressed", c() === "cumulative");
		}), U("click", r, () => Ie("atCall")), U("click", i, () => Ie("cumulative")), G(e, t);
	};
	q(Ke, (e) => {
		H(C).length > 0 && e(qe);
	});
	var Je = B(Ke, 2), Ye = (e) => {
		G(e, is());
	}, Xe = (e) => {
		var n = as(), r = B(L(n), 2);
		j(n), U("click", r, () => t.onPinCall(H(C)[H(C).length - 1].index)), G(e, n);
	}, Ze = (e) => {
		G(e, os());
	}, Qe = (e) => {
		let r = /* @__PURE__ */ N(Ue);
		var i = Ps(), s = R(i), u = (e) => {
			var t = ss(), n = z(t, !0);
			V(() => K(n, l())), G(e, t);
		};
		q(s, (e) => {
			l() && c() === "cumulative" && a() === null && e(u);
		});
		var h = B(s, 2), g = L(h), y = L(g), b = z(y, !0), x = z(B(y, 2));
		j(g);
		var ee = B(g, 2), C = (e) => {
			var n = ls(), r = L(n), i = L(r), a = B(i, 2);
			j(r);
			var o = B(r, 2), s = (e) => {
				var t = cs();
				U("click", t, function(...e) {
					d()?.apply(this, e);
				}), G(e, t);
			};
			q(o, (e) => {
				c() === "cumulative" && e(s);
			}), j(n), V(() => {
				i.disabled = H(T) === null, a.disabled = H(E) === null;
			}), U("click", i, () => H(T) && t.onPinCall(H(T).index)), U("click", a, () => H(E) && t.onPinCall(H(E).index)), G(e, n);
		};
		q(ee, (e) => {
			a() !== null && e(C);
		}), j(h);
		var te = B(h, 2), ne = (e) => {
			var t = us(), n = z(t, !0);
			V((e) => K(n, e), [() => ze()]), G(e, t);
		};
		q(te, (e) => {
			(H(be) === 0 || H(A) !== H(be)) && e(ne);
		});
		var ie = B(te, 2), ae = L(ie), se = L(ae), ce = B(se), le = (e) => {
			_a(e, {
				id: "composition-totals-note",
				label: "About these totals",
				children: (e, t) => {
					Se(), G(e, zr("Totals and shares use only the item appearances with numeric estimates. Some\n            appearances have no estimate or are only partly counted, so the totals can be lower than\n            the true figure."));
				},
				$$slots: { default: !0 }
			});
		};
		q(ce, (e) => {
			H(ye) && e(le);
		}), j(ae);
		var xe = B(ae, 2), Ce = L(xe), we = B(Ce), Te = (e) => {
			var t = zr();
			V((e) => K(t, `· ${e ?? ""} with numeric estimates`), [() => Z(H(D).measuredItemCount)]), G(e, t);
		};
		q(we, (e) => {
			H(D).unmeasuredItemCount > 0 && e(Te);
		}), j(xe);
		var Ee = B(xe, 2), De = (e) => {
			var t = ds(), n = z(t);
			V((e) => K(n, `${e ?? ""} items unavailable`), [() => Z(H(D).unmeasuredItemCount)]), G(e, t);
		};
		q(Ee, (e) => {
			H(D).unmeasuredItemCount > 0 && e(De);
		}), j(ie);
		var Ne = B(ie, 2), Ie = B(L(Ne), 2), Ve = z(Ie), He = B(Ie, 2), We = (e) => {
			var t = ps();
			J(t, 21, () => H(me), (e) => e.id, (e, t) => {
				var n = fs(), r = L(n), i = B(r), a = z(i, !0);
				Ya(B(i, 2), {
					get value() {
						return H(t).id;
					},
					label: "profile ID"
				}), j(n), V(() => {
					K(r, `${H(t).description ?? ""} · `), K(a, H(t).id);
				}), G(e, n);
			}), j(t), G(e, t);
		}, Ge = (e) => {
			var t = ms(), n = L(t), r = z(n, !0);
			Ya(B(n, 2), {
				get value() {
					return H(w).tokenizationProfileId;
				},
				label: "profile ID"
			}), j(t), V(() => K(r, H(w).tokenizationProfileId)), G(e, t);
		};
		q(He, (e) => {
			c() === "cumulative" && H(me).length > 0 ? e(We) : c() === "atCall" && H(w)?.tokenizationProfileId && e(Ge, 1);
		});
		var Ke = z(B(He, 2));
		j(Ne);
		var qe = B(Ne, 2), Je = (e) => {
			var t = hs(), n = z(t, !0);
			V(() => K(n, H(r))), G(e, t);
		};
		q(qe, (e) => {
			H(r) && e(Je);
		});
		var Ye = B(qe, 2), Xe = (e) => {
			G(e, gs());
		}, Ze = (e) => {
			G(e, _s());
		};
		q(Ye, (e) => {
			H(D).allMeasuredZero ? e(Xe) : H(D).measuredItemCount === 0 && e(Ze, 1);
		});
		var Qe = B(Ye, 2), $e = L(Qe), et = B($e, 2), tt = L(et), nt = L(tt), rt = (e) => {
			G(e, zr("Token-turns count an item's estimated tokens each time it appears in a model call. This\n            is input-context exposure, not unique content, provider usage, billed tokens, or cost."));
		}, it = (e) => {
			G(e, zr("Areas use only this call's applicable item estimates. Shares use the numeric-estimate\n            subset; unknown estimates are not inferred from provider totals."));
		};
		q(nt, (e) => {
			c() === "cumulative" ? e(rt) : e(it, -1);
		}), j(tt), Se(4), j(et), j(Qe), Li(Qe, (e) => I(v, e), () => H(v));
		var at = B(Qe, 2), ot = (e) => {
			var r = Ts(), i = R(r), a = (e) => {
				var t = vs(), n = L(t), r = B(n);
				j(t), V((e, t, r) => K(n, `Treemap shows ${e ?? ""} of ${t ?? ""} items. ${r ?? ""}. `), [
					() => Z(H(re).rectangles.length),
					() => Z(H(D).items.length),
					() => Be()
				]), U("click", r, () => Fe("list")), G(e, t);
			};
			q(i, (e) => {
				H(re).rectangles.length < H(D).items.length && e(a);
			});
			var s = B(i, 2), c = L(s);
			Y(c, "height", 360);
			var l = L(c), u = L(l);
			J(u, 17, () => H(re).groups, (e) => e.kind, (e, t) => {
				var n = ys(), r = L(n);
				Y(r, "height", 13), j(n), V((e) => {
					Y(n, "id", `composition-group-clip-${H(t).kind}`), Y(r, "x", H(t).x + 3), Y(r, "y", H(t).y + 1), Y(r, "width", e);
				}, [() => Math.max(0, H(t).width - 6)]), G(e, n);
			}), J(B(u), 17, () => H(re).rectangles, (e) => e.item.id, (e, t) => {
				var n = ys(), r = z(n);
				V((e, i, a) => {
					Y(n, "id", e), Y(r, "x", H(t).x + 4), Y(r, "y", H(t).y + 3), Y(r, "width", i), Y(r, "height", a);
				}, [
					() => ke(H(t).optionIndex),
					() => Math.max(0, H(t).width - 8),
					() => Math.max(0, H(t).height - 6)
				]), G(e, n);
			}), j(l);
			var d = B(l);
			J(d, 17, () => H(re).groups, (e) => e.kind, (e, t) => {
				var n = xs(), r = L(n), i = z(r, !0), a = B(r), o = B(a), s = (e) => {
					var n = bs(), r = z(n, !0);
					V(() => {
						Y(n, "x", H(t).x + 5), Y(n, "y", H(t).y + 11), Y(n, "clip-path", `url(#composition-group-clip-${H(t).kind})`), K(r, H(t).labelText);
					}), G(e, n);
				};
				q(o, (e) => {
					H(t).labelText && e(s);
				}), j(n), V(() => {
					Y(n, "aria-label", `${H(t).label} group`), K(i, H(t).label), Y(a, "x", H(t).x), Y(a, "y", H(t).y), Y(a, "width", H(t).width), Y(a, "height", H(t).height);
				}), G(e, n);
			}), J(B(d), 17, () => H(re).rectangles, (e) => e.item.id, (e, r) => {
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
					}), j(i), V((e, t) => {
						Y(i, "clip-path", e), Y(a, "x", H(r).x + 5), Y(a, "y", H(r).y + 16), o = vi(a, "", o, { fill: t }), K(s, H(r).labelText);
					}, [() => `url(#${ke(H(r).optionIndex)})`, () => Ta(wa(t.indexed, H(r).item.id, n()))]), G(e, i);
				};
				q(d, (e) => {
					H(r).labelFits && H(r).labelText && e(f);
				}), j(i), V((e, t, n, s) => {
					Y(i, "id", e), Y(i, "aria-selected", o() === H(r).item.id), Y(i, "aria-label", t), Y(i, "data-composition-item", H(r).item.id), a = gi(i, 0, "svelte-8fl9lq", null, a, {
						selected: o() === H(r).item.id,
						active: H(S) === H(r).item.id
					}), K(c, n), Y(l, "x", H(r).x), Y(l, "y", H(r).y), Y(l, "width", H(r).width), Y(l, "height", H(r).height), Y(l, "fill", s), u = gi(l, 0, "svelte-8fl9lq", null, u, { partial: H(r).item.estimateCoverage !== "complete" });
				}, [
					() => Oe(H(r).optionIndex),
					() => je(H(r).item),
					() => je(H(r).item),
					() => wa(t.indexed, H(r).item.id, n())
				]), U("pointerup", i, () => Me(H(r).item)), G(e, i);
			}), j(c), j(s), V(() => {
				Y(c, "width", H(re).width), Y(c, "viewBox", `0 0 ${H(re).width} 360`), Y(c, "aria-label", `${H(ge)} treemap; ${H(re).rectangles.length} visible tiles of ${H(D).items.length} items; use arrow keys to inspect`), Y(c, "aria-activedescendant", H(ue));
			}), U("keydown", c, Pe), G(e, r);
		}, st = (e) => {
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
				}), j(u);
				var y = B(u, 2), b = L(y), x = z(b, !0), ee = B(b, 2), C = z(ee, !0), te = z(B(ee, 2), !0);
				j(y), j(a), V((e, t, n, i, u, d) => {
					Y(a, "id", e), s = gi(a, 1, "composition-row svelte-8fl9lq", null, s, {
						selected: o() === H(r).id,
						active: H(S) === H(r).id,
						unavailable: H(r).tokens === null
					}), Y(a, "aria-selected", o() === H(r).id), Y(a, "aria-label", t), Y(a, "data-composition-item", H(r).id), vi(l, n), K(f, H(r).label), K(m, `${H(r).kindLabel ?? ""} · ${i ?? ""} · ${H(r).estimateCoverage ?? ""} estimate coverage`), K(x, u), K(C, d), K(te, H(r).ageAtCall === null ? "Age unavailable" : `${H(r).ageAtCall} calls old at ${c() === "atCall" ? "this call" : "scope endpoint"}`);
				}, [
					() => Oe(H(i)),
					() => je(H(r)),
					() => `background:${wa(t.indexed, H(r).id, n())}`,
					() => H(r).estimateMethods.length > 1 ? "Mixed estimate methods" : Ae(H(r).estimateMethod),
					() => Le(H(r)),
					() => Re(H(r))
				]), U("pointerup", a, () => Me(H(r))), G(e, a);
			}), j(r), Li(r, (e) => I(_, e), () => H(_)), V(() => {
				Y(r, "aria-label", `${H(ge)} items ranked by estimated contribution; ${H(O).length} items`), Y(r, "aria-activedescendant", H(ue));
			}), U("keydown", r, Pe), G(e, r);
		};
		q(at, (e) => {
			H(oe) === "treemap" ? e(ot) : e(st, -1);
		});
		var ct = B(at, 2), lt = (e) => {
			var t = Ms(), n = L(t), r = L(n), i = z(r, !0), a = B(r, 2), o = (e) => {
				var t = ks(), n = R(t), r = z(n), i = B(n, 2), a = (e) => {
					var t = Es(), n = z(t);
					V((e, t, r) => K(n, `Known subtotal; ${e ?? ""} item-call
                estimates unavailable, ${t ?? ""} partial-coverage, and ${r ?? ""} unavailable-semantic.`), [
						() => Z(H(fe).missingContributionCount),
						() => Z(H(fe).partialEstimateContributionCount),
						() => Z(H(fe).unavailableCoverageContributionCount)
					]), G(e, t);
				};
				q(i, (e) => {
					(H(fe).missingContributionCount > 0 || H(fe).partialEstimateContributionCount > 0 || H(fe).unavailableCoverageContributionCount > 0) && e(a);
				}), V((e, t) => K(r, `${e ?? ""} · ${t ?? ""}`), [() => Le(H(fe)), () => Re(H(fe))]), G(e, t);
			}, s = (e) => {
				var t = As(), n = z(t, !0);
				V(() => K(n, c() === "atCall" ? `Not present at call ${H(w)?.index ?? "Unknown"}.` : "No contribution within this cumulative scope.")), G(e, t);
			};
			q(a, (e) => {
				H(fe) ? e(o) : e(s, -1);
			}), j(n);
			var l = B(n, 2), u = L(l), d = B(u, 2), h = B(d, 2), g = (e) => {
				var t = js();
				U("click", t, () => f()(H(de).id)), G(e, t);
			};
			q(h, (e) => {
				H(pe) && e(g);
			}), j(l), j(t), V(() => K(i, H(de).label)), U("click", u, function(...e) {
				p()?.apply(this, e);
			}), U("click", d, () => m()(H(de).id)), G(e, t);
		};
		q(ct, (e) => {
			o() && H(de) && e(lt);
		});
		var ut = B(ct, 2), dt = (e) => {
			var t = Ns(), n = B(L(t), 4), r = L(n), i = z(B(L(r), 2));
			j(r);
			var a = B(r, 2), o = z(B(L(a), 2));
			j(a);
			var s = B(a, 2), c = z(B(L(s), 2));
			j(s);
			var l = B(s, 2), u = z(B(L(l), 2), !0);
			j(l), j(n), j(t), V((e, t, n, r) => {
				K(i, `${e ?? ""} tokens`), K(o, `${t ?? ""} tokens`), K(c, `${n ?? ""} tokens`), K(u, r);
			}, [
				() => Z(H(w).reportedPromptTokens),
				() => Z(H(w).tokenAnalysis.calculatedVisibleTokens),
				() => Z(H(w).tokenAnalysis.knownFramingOverheadTokens),
				() => H(w).tokenAnalysis.residualTokens === null ? "Unknown" : `${Z(H(w).tokenAnalysis.residualTokens)} tokens`
			]), G(e, t);
		};
		q(ut, (e) => {
			c() === "atCall" && H(w) && e(dt);
		}), V((e, t, n, r, i, a, o) => {
			K(b, H(ge)), K(x, `${H(ve) ?? ""} · ${H(_e) ?? ""}`), K(se, `${e ?? ""}
        ${H(k) ?? ""}`), K(Ce, `${t ?? ""} items `), K(Ve, `Tokenizer: ${H(he) ?? ""}`), K(Ke, `${n ?? ""} of ${r ?? ""} item appearances
        have numeric estimates in this ${c() === "atCall" ? "call" : "cumulative scope"}.
        ${i ?? ""} are missing, ${a ?? ""} have partial payload coverage, and ${o ?? ""} have unavailable semantic coverage.`);
		}, [
			() => Z(H(D).measuredTokenTotal),
			() => Z(H(D).items.length),
			() => Z(H(A)),
			() => Z(H(be)),
			() => Z(H(D).missingItemCallCount),
			() => Z(H(D).partialItemCallCount),
			() => Z(H(D).unavailableCoverageItemCallCount)
		]), U("keydown", $e, M), G(e, i);
	};
	q(Je, (e) => {
		H(C).length === 0 ? e(Ye) : c() === "atCall" && !H(w) ? e(Xe, 1) : H(D) ? e(Qe, -1) : e(Ze, 2);
	}), j(Ge), Li(Ge, (e) => I(g, e), () => H(g)), G(e, Ge), He(), i();
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
	Ve(t, !0), li(e, Bs);
	let n = X(t, "ready", 3, !1), r = X(t, "onDone", 3, () => {}), i = X(t, "message", 15, ""), a = X(t, "hideMessage", 3, !1), o = /* @__PURE__ */ F(""), s = /* @__PURE__ */ N(() => !n() || t.callIndices.length === 0), c = /* @__PURE__ */ N(() => t.callIndices[0] ?? 1), l = /* @__PURE__ */ N(() => t.callIndices[t.callIndices.length - 1] ?? 1);
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
	ki(h), j(m);
	var g = B(m, 2);
	j(p);
	var _ = B(p, 2), v = (e) => {
		var t = Rs(), n = z(t, !0);
		V(() => K(n, i())), G(e, t);
	};
	q(_, (e) => {
		i() && !a() && e(v);
	}), j(f), V(() => {
		Y(h, "min", H(c)), Y(h, "max", H(l)), h.disabled = H(s), g.disabled = H(s);
	}), Or("submit", p, d), U("keydown", h, u), Ni(h, () => H(o), (e) => I(o, e)), G(e, f), He();
}
kr(["keydown"]);
//#endregion
//#region src/lib/components/CompactMenu.svelte
var Hs = /* @__PURE__ */ W("<details class=\"view-options compact-menu svelte-1ilwl0u\"><summary class=\"svelte-1ilwl0u\"> </summary> <div class=\"menu-panel svelte-1ilwl0u\" role=\"group\"><!></div></details>"), Us = {
	hash: "svelte-1ilwl0u",
	code: ".compact-menu.svelte-1ilwl0u {position:relative;}summary.svelte-1ilwl0u {display:inline-flex;align-items:center;gap:6px;min-height:var(--control-size);padding:var(--toggle-padding);border:1px solid var(--separator);border-radius:var(--control-radius);background:var(--surface);color:var(--text);list-style:none;white-space:nowrap;}summary.svelte-1ilwl0u::-webkit-details-marker {display:none;}summary.svelte-1ilwl0u::after {content:'';width:0;height:0;border-top:5px solid currentColor;border-right:4px solid transparent;border-left:4px solid transparent;}.compact-menu[open].svelte-1ilwl0u > summary:where(.svelte-1ilwl0u) {border-color:var(--accent);}.menu-panel.svelte-1ilwl0u {position:absolute;top:calc(100% + 4px);right:0;z-index:6;display:flex;flex-wrap:wrap;align-items:center;gap:8px;width:max-content;max-width:min(320px, calc(100cqw - 24px));padding:10px;border:1px solid var(--separator);border-radius:var(--radius);background:var(--surface-raised);box-shadow:0 6px 18px rgb(0 0 0 / 0.18);}"
};
function Ws(e, t) {
	Ve(t, !0), li(e, Us);
	let n = /* @__PURE__ */ F(!1), r;
	Cn(() => {
		if (!H(n)) return;
		let e = (e) => {
			e.composedPath().includes(r) || I(n, !1);
		};
		return document.addEventListener("pointerdown", e, !0), () => document.removeEventListener("pointerdown", e, !0);
	});
	var i = Hs(), a = L(i), o = z(a, !0), s = B(a, 2);
	ci(L(s), () => t.children), j(s), j(i), Li(i, (e) => r = e, () => r), V(() => {
		K(o, t.label), Y(s, "aria-label", t.label);
	}), Ri("open", "toggle", i, (e) => I(n, e), () => H(n)), G(e, i), He();
}
//#endregion
//#region src/lib/components/ContextRiverNavigation.svelte
var Gs = /* @__PURE__ */ W("<button type=\"button\" class=\"step-call svelte-i2yay7\" aria-label=\"Previous call\" aria-keyshortcuts=\"ArrowLeft h\" title=\"Previous call (← / h)\">‹</button>"), Ks = /* @__PURE__ */ W("<button type=\"button\" class=\"step-call svelte-i2yay7\" aria-label=\"Next call\" aria-keyshortcuts=\"ArrowRight l\" title=\"Next call (→ / l)\">›</button>"), qs = /* @__PURE__ */ W("<span class=\"zoom-level svelte-i2yay7\"> </span> <button type=\"button\" aria-label=\"Zoom out\" title=\"Zoom out\">−</button> <button type=\"button\" aria-label=\"Zoom in\" title=\"Zoom in\">+</button> <button type=\"button\" aria-label=\"Fit all calls\" title=\"Fit all calls\">Fit all</button> <button type=\"button\">Latest</button> <!>", 1), Js = /* @__PURE__ */ W("<div class=\"controls svelte-i2yay7\" role=\"group\" aria-label=\"Chart zoom and navigation\"><!> <span class=\"range svelte-i2yay7\" aria-live=\"polite\" data-testid=\"visible-call-range\"> </span> <!> <!></div>"), Ys = /* @__PURE__ */ W("<div class=\"viewport-status svelte-i2yay7\"><span class=\"range svelte-i2yay7\" aria-live=\"polite\" data-testid=\"visible-call-range\"> </span></div> <div class=\"controls svelte-i2yay7\" role=\"group\" aria-label=\"Chart zoom and navigation\"><!> <!> <!></div>", 1), Xs = /* @__PURE__ */ W("<p class=\"jump-message svelte-i2yay7\" role=\"status\"> </p>"), Zs = /* @__PURE__ */ W("<div role=\"group\" aria-label=\"Context River navigation\"><!> <!></div>"), Qs = {
	hash: "svelte-i2yay7",
	code: ".viewport-navigation.svelte-i2yay7 {display:grid;grid-template-columns:minmax(0, 1fr) minmax(0, auto);align-items:start;gap:10px 16px;margin:8px 0 12px;min-width:0;}\n  /* One button row tall, so the range lines up with the first row of controls even when\n     they wrap onto a second row. */.viewport-status.svelte-i2yay7 {display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;min-width:0;min-height:var(--control-size);}.range.svelte-i2yay7 {color:var(--text);font-variant-numeric:tabular-nums;font-weight:600;}.controls.svelte-i2yay7 {display:flex;grid-column:2;grid-row:1;align-self:start;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:7px;}.jump-message.svelte-i2yay7 {grid-column:1 / -1;margin:0;color:var(--secondary);font-size:var(--text-sm);}.step-call.svelte-i2yay7 {width:var(--control-size);height:var(--control-size);padding:0;flex:0 0 var(--control-size);font-size:22px;line-height:1;}.zoom-level.svelte-i2yay7 {color:var(--secondary);font-size:var(--text-sm);font-variant-numeric:tabular-nums;}.compact.svelte-i2yay7 {grid-template-columns:minmax(0, 1fr);}.compact.svelte-i2yay7 .controls:where(.svelte-i2yay7) {grid-column:1;flex-wrap:nowrap;justify-content:flex-start;}.compact.svelte-i2yay7 .range:where(.svelte-i2yay7) {min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}.compact.svelte-i2yay7 .compact-menu {margin-left:auto;}\n  @container highwater (max-width: 760px) {.viewport-navigation.svelte-i2yay7 {grid-template-columns:minmax(0, 1fr);}.controls.svelte-i2yay7 {grid-column:1;grid-row:2;justify-content:flex-start;}\n  }"
};
function $s(e, t) {
	Ve(t, !0), li(e, Qs);
	let n = (e) => {
		var t = Gs();
		Li(t, (e) => m = e, () => m), V(() => t.disabled = H(f) === null || !c()), U("click", t, () => H(f) !== null && o()(H(f))), G(e, t);
	}, r = (e) => {
		var t = Ks();
		Li(t, (e) => h = e, () => h), V(() => t.disabled = H(p) === null || !c()), U("click", t, () => H(p) !== null && o()(H(p))), G(e, t);
	}, i = (e) => {
		var n = qs(), r = R(n), i = z(r), a = B(r, 2), o = B(a, 2), l = B(o, 2), f = B(l, 2), p = B(f, 2);
		{
			let e = /* @__PURE__ */ N(() => t.viewport.ready && c());
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
	}, a = X(t, "pinnedCallIndex", 3, null), o = X(t, "onSelectCall", 3, () => {}), s = X(t, "onJumpToCall", 3, (e) => o()(e)), c = X(t, "isVisible", 3, !0), l = X(t, "compact", 3, !1), u = /* @__PURE__ */ F(""), d = /* @__PURE__ */ N(() => t.callIndices.length === 0), f = /* @__PURE__ */ N(() => t.viewport.ready ? na(t.callIndices, a(), t.viewport, -1) : null), p = /* @__PURE__ */ N(() => t.viewport.ready ? na(t.callIndices, a(), t.viewport, 1) : null), m, h;
	Tn(() => {
		H(p) === null && H(f) !== null && Vi(h).activeElement === h && gr().then(() => m.focus()), H(f) === null && H(p) !== null && Vi(m).activeElement === m && gr().then(() => h.focus());
	});
	let g = /* @__PURE__ */ N(() => H(d) ? "No model calls" : t.viewport.ready ? t.viewport.firstVisibleCallIndex === null || t.viewport.lastVisibleCallIndex === null ? `No call markers visible of ${t.callIndices.length}` : t.viewport.firstVisibleCallIndex === t.viewport.lastVisibleCallIndex ? `Call ${t.viewport.firstVisibleCallIndex} of ${t.callIndices.length}` : `Calls ${t.viewport.firstVisibleCallIndex}–${t.viewport.lastVisibleCallIndex} of ${t.callIndices.length}` : "Measuring chart viewport…");
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
		}), j(t), V(() => K(s, H(g))), G(e, t);
	}, x = (e) => {
		var t = Ys(), a = R(t), o = z(L(a), !0);
		j(a);
		var s = B(a, 2), c = L(s);
		n(c);
		var l = B(c, 2);
		r(l);
		var u = B(l, 2);
		i(u), j(s), V(() => K(o, H(g))), G(e, t);
	};
	q(y, (e) => {
		l() ? e(b) : e(x, -1);
	});
	var S = B(y, 2), ee = (e) => {
		var t = Xs(), n = z(t, !0);
		V(() => K(n, H(u))), G(e, t);
	};
	q(S, (e) => {
		H(u) && e(ee);
	}), j(_), V(() => v = gi(_, 1, "viewport-navigation svelte-i2yay7", null, v, { compact: l() })), G(e, _), He();
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
	Ve(t, !0), li(e, Kc);
	let n = () => st(Ma, "$activePalette", r), [r, i] = ct(), a = X(t, "selectedItemId", 3, null), o = X(t, "pinnedCallIndex", 3, null), s = X(t, "findRequest", 3, null), c = X(t, "compact", 3, !1), l = [
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
	let S = /* @__PURE__ */ N(() => t.indexed.analysis.contextItems), ee = /* @__PURE__ */ N(() => Mo(H(S))), C = /* @__PURE__ */ N(() => rc(H(S))), te = /* @__PURE__ */ N(() => H(C) === null ? null : t.indexed.analysis.tokenAnalysis.profiles.find((e) => e.id === H(C)) ?? null), w = /* @__PURE__ */ N(() => H(te) ? `${H(te).provider}/${H(te).model} · ${H(te).method}` : H(C) ?? "unavailable"), T = /* @__PURE__ */ N(() => o() === null ? null : t.indexed.contextSetByCall.get(o()) ?? null), E = /* @__PURE__ */ N(() => H(S).filter((e) => (t.indexed.versionByItemId.get(e.id)?.number ?? 1) === 1)), D = /* @__PURE__ */ N(() => new Map(H(E).map((e) => [e.id, hc(t.indexed.itemById, t.indexed.versionByItemId, e.id)]))), O = /* @__PURE__ */ N(() => (e) => H(D).get(e.id) ?? [e]), ne = /* @__PURE__ */ N(() => sc(H(E), H(m), H(C), H(O))), re = /* @__PURE__ */ N(() => H(f) === "presentAtPin" && H(T) !== null ? H(ne).filter((e) => H(O)(e).some((e) => H(T).has(e.id))) : H(ne)), ie = /* @__PURE__ */ N(() => H(u).trim().slice(0, 120).toLowerCase()), ae = /* @__PURE__ */ N(() => H(re).filter((e) => {
		let t = H(d) === "all" || e.kind === H(d), n = H(ie).length === 0 || H(O)(e).some((e) => e.label.toLowerCase().includes(H(ie)) || (e.preview?.text ?? "").toLowerCase().includes(H(ie)));
		return t && n;
	})), oe = /* @__PURE__ */ N(() => H(ae).reduce((e, t) => e + H(O)(t).length, 0)), se = /* @__PURE__ */ N(() => H(ae).slice(0, H(h))), ce = /* @__PURE__ */ N(() => H(ae).length - H(se).length), le = /* @__PURE__ */ N(() => l.filter((e) => H(S).some((t) => t.kind === e))), ue = /* @__PURE__ */ N(() => +!!H(ie) + (H(d) === "all" ? 0 : 1) + (H(f) === "all" ? 0 : 1)), de = /* @__PURE__ */ N(() => H(ie).length > 0 || H(d) !== "all" || H(f) !== "all"), fe = /* @__PURE__ */ N(() => t.indexed.analysis.modelCalls.map((e) => e.index)), pe = /* @__PURE__ */ N(() => cc(H(fe))), me = /* @__PURE__ */ N(() => H(fe).length), he = /* @__PURE__ */ N(() => new Map(H(fe).map((e, t) => [e, t]))), ge = /* @__PURE__ */ N(() => o() === null || !H(he).has(o()) ? null : k(o())), _e = /* @__PURE__ */ N(() => a() !== null && H(de) && !H(ae).some((e) => we(e, a())));
	Tn(() => {
		H(d) !== "all" && !H(le).includes(H(d)) && I(d, "all");
	}), Tn(() => {
		H(m) === "size" && H(C) === null && I(m, "tokenTurns");
	}), Tn(() => {
		H(f) === "presentAtPin" && o() === null && (I(f, "all"), I(p, "Pin cleared; showing all items."));
	}), Tn(() => {
		H(f) === "all" && o() !== null && I(p, "");
	}), Tn(() => {
		H(ie), H(d), H(f), H(m), I(h, 50);
	}), Tn(() => {
		if (s() && s().requestId !== _) {
			_ = s().requestId, I(v, s().itemId, !0), I(y, ""), I(g, !0);
			let e = s().requestId;
			gr().then(() => Pe(e));
		}
	}), Tn(() => {
		!s() && H(v) && (I(v, null), I(y, ""));
	});
	function ve(e) {
		return `${Q(e)} item${e === 1 ? "" : "s"}`;
	}
	function k(e) {
		let t = H(he).get(e);
		return t === void 0 ? 0 : H(me) <= 1 ? 50 : t / (H(me) - 1) * 100;
	}
	function ye(e, n, r) {
		if (e.detail === 0) {
			t.onSelectItem(n);
			return;
		}
		let i = e.currentTarget.closest(".track")?.getBoundingClientRect(), a = i && i.width > 0 ? ec(H(fe), r, (e.clientX - i.left) / i.width) : null;
		a === null ? t.onSelectItem(n) : t.onSelectItem(n, a);
	}
	function A(e, t, n = !1, r = !1) {
		let i = H(me) <= 1 ? 8 : Math.min(2.2, 35 / Math.max(1, H(me) - 1)), a = n ? be(e.startCall) : Math.max(0, k(e.startCall) - i), o = r ? be(e.endCall + 1) : Math.min(100, k(e.endCall) + i);
		return `left:${a}%;width:${Math.max(1, o - a)}%;background-color:${t}`;
	}
	function be(e) {
		let t = H(fe)[0] ?? 1;
		if (e > (H(fe)[H(fe).length - 1] ?? 0)) return 100;
		let n = k(e), r = k(e - 1);
		return e <= t ? Math.max(0, n - 1) : (n + r) / 2;
	}
	function xe(e) {
		return H(ee).get(e.id) ?? Ce(e);
	}
	function Ce(e) {
		return Ao(e, "Unlabelled item");
	}
	function we(e, t) {
		return H(O)(e).some((e) => e.id === t);
	}
	function Te(e) {
		return t.indexed.versionByItemId.get(e)?.firstId ?? e;
	}
	function Ee(e) {
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
	function De(e) {
		let t = Ee(e);
		if (t.length === 0) return "No model-call presence";
		let n = H(O)(e).length, r = n > 1 ? ` · ${n} versions` : "";
		return `Present at ${t.map((e) => e.startCall === e.endCall ? `call ${e.startCall}` : `calls ${e.startCall}–${e.endCall}`).join(", ")}${r}`;
	}
	function Oe(e) {
		return H(O)(e).reduce((e, t) => e + t.tokenTurnsCoverage.coveredCalls, 0);
	}
	function ke(e) {
		return H(O)(e).reduce((e, t) => e + t.tokenTurnsCoverage.totalCalls, 0);
	}
	function Ae(e, n) {
		return (t.indexed.compactionBySourceId.get(e) ?? []).some((e) => e.beforeModelCall === n.endCall + 1);
	}
	function je() {
		return `Full-session call axis ${H(fe).length === 0 ? "this session has no model calls" : `from call ${H(fe)[0]} to ${H(fe)[H(fe).length - 1]}; ticks ${H(pe).join(", ")}`}; dashed markers show compaction boundaries${o() === null ? "" : `; solid vertical marker shows pinned call ${o()}`}; independent of chart zoom`;
	}
	function Me() {
		I(u, ""), I(d, "all"), I(f, "all"), I(p, ""), I(y, "");
	}
	function Ne(e) {
		return `lifespan-item-${encodeURIComponent(e)}`;
	}
	async function Pe(e = _) {
		if (!x || e !== _ || !H(v)) return;
		let t = Te(H(v)), n = H(ae).findIndex((e) => e.id === t);
		if (n >= H(h) && (I(h, Math.ceil((n + 1) / 50) * 50), await gr(), !x || e !== _)) return;
		let r = [...H(b)?.querySelectorAll("[data-lifespan-item-id]") ?? []].find((e) => e.dataset.lifespanItemId === t);
		r ? (r.scrollIntoView({ block: "center" }), r.focus({ preventScroll: !0 }), I(y, "")) : (I(y, "The selected item is hidden by current lifespan filters."), gr().then(() => {
			let e = H(b)?.querySelector(".find-status button");
			e?.scrollIntoView({ block: "center" }), e?.focus();
		}));
	}
	async function Fe() {
		Me(), await gr(), await Pe();
	}
	function Ie() {
		I(h, H(h) + 50);
	}
	var M = Gc(), Le = L(M), Re = L(Le), ze = B(L(Re), 2), Be = z(L(ze));
	j(ze);
	var Ue = B(ze, 2), We = (e) => {
		var t = vc(), n = z(t);
		V((e, t) => K(n, `${e ?? ""} of ${t ?? ""} items`), [() => Q(H(oe)), () => Q(H(S).length)]), G(e, t);
	};
	q(Ue, (e) => {
		H(de) && e(We);
	}), j(Re);
	var Ge = B(Re, 2), Ke = (e) => {
		var r = Wc();
		{
			let e = (e) => {
				var t = xc(), n = L(t), r = B(L(n), 2);
				ki(r), Y(r, "maxlength", 120), j(n);
				var i = B(n, 2), a = B(L(i), 2), s = L(a);
				s.value = s.__value = "all", J(B(s), 16, () => H(le), (e) => e, (e, t) => {
					var n = yc(), r = z(n, !0), i = {};
					V((e) => {
						K(r, e), i !== (i = t) && (n.value = (n.__value = i) ?? "");
					}, [() => Fo(t)]), G(e, n);
				}), j(a), Si(a), j(i);
				var c = B(i, 2), l = B(L(c), 2), p = L(l);
				p.value = p.__value = "tokenTurns";
				var h = B(p);
				h.value = h.__value = "size";
				var g = B(h);
				g.value = g.__value = "firstAppearance";
				var _ = B(g);
				_.value = _.__value = "presenceCount", j(l), Si(l), j(c);
				var v = B(c, 2), y = B(L(v), 2), b = L(y);
				b.value = b.__value = "all";
				var x = B(b), S = z(x);
				x.value = x.__value = "presentAtPin", j(y), Si(y), j(v);
				var ee = B(v, 2), te = (e) => {
					var t = bc();
					U("click", t, Me), G(e, t);
				};
				q(ee, (e) => {
					H(de) && e(te);
				}), j(t), V(() => {
					h.disabled = H(C) === null, x.disabled = o() === null, K(S, `Present at call ${o() ?? "(pin a call first)" ?? ""}`);
				}), Ni(r, () => H(u), (e) => I(u, e)), Ci(a, () => H(d), (e) => I(d, e)), Ci(l, () => H(m), (e) => I(m, e)), Ci(y, () => H(f), (e) => I(f, e)), G(e, t);
			};
			var i = L(r), s = (t) => {
				var n = Sc(), r = L(n);
				{
					let t = /* @__PURE__ */ N(() => H(ue) > 0 ? `Filter and sort (${H(ue)})` : "Filter and sort");
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
				j(n), G(t, n);
			}, l = (t) => {
				e(t);
			};
			q(i, (e) => {
				c() ? e(s) : e(l, -1);
			});
			var h = B(i, 2), g = L(h), _ = z(B(L(g)), !0);
			j(g);
			var b = B(g, 2), x = (e) => {
				var t = Cc(), n = z(t);
				V(() => {
					t.disabled = H(f) === "presentAtPin", K(n, `Show items present at call ${o() ?? ""}`);
				}), U("click", t, () => I(f, "presentAtPin")), G(e, t);
			}, ee = (e) => {
				G(e, wc());
			};
			q(b, (e) => {
				o() === null ? e(ee, -1) : e(x);
			}), j(h);
			var te = B(h, 2), T = (e) => {
				var t = Tc(), n = z(t, !0);
				V(() => K(n, H(p))), G(e, t);
			};
			q(te, (e) => {
				H(p) && e(T);
			});
			var E = B(te, 2), D = (e) => {
				var n = Dc(), r = L(n), i = B(r), a = (e) => {
					var t = Ec();
					U("click", t, Fe), G(e, t);
				}, o = /* @__PURE__ */ N(() => H(v) && t.indexed.itemById.has(H(v)));
				q(i, (e) => {
					H(o) && e(a);
				}), j(n), V(() => K(r, `${H(y) ?? ""} `)), G(e, n);
			};
			q(E, (e) => {
				H(y) && e(D);
			});
			var ne = B(E, 2), re = (e) => {
				var t = Oc(), n = z(t);
				V(() => K(n, `Size uses one shared profile (${H(w) ?? ""}); items without a numeric estimate for
            it sort last.`)), G(e, t);
			};
			q(ne, (e) => {
				H(m) === "size" && e(re);
			});
			var ie = B(ne, 2), oe = (e) => {
				G(e, kc());
			};
			q(ie, (e) => {
				H(_e) && e(oe);
			});
			var fe = B(ie, 4), me = B(L(fe), 2), he = L(me), Te = (e) => {
				var t = Ac(), n = z(L(t), !0);
				j(t), V(() => {
					vi(t, `left:${H(ge)}%`), K(n, o());
				}), G(e, t);
			};
			q(he, (e) => {
				H(ge) !== null && e(Te);
			});
			var Ee = B(he, 2);
			J(Ee, 19, () => H(pe), (e) => `tick:${e}`, (e, t, n) => {
				var r = jc();
				let i;
				var a = z(r, !0);
				V((e) => {
					i = gi(r, 1, "axis-tick svelte-1pk7niq", null, i, {
						first: H(n) === 0,
						last: H(n) === H(pe).length - 1,
						center: H(pe).length === 1
					}), vi(r, e), K(a, H(t));
				}, [() => `left:${k(H(t))}%`]), G(e, r);
			}), J(B(Ee, 2), 17, () => t.indexed.analysis.compactions, (e) => e.id, (e, t) => {
				var n = Mc();
				V((e) => vi(n, e), [() => `left:${be(H(t).beforeModelCall)}%`]), G(e, n);
			}), j(me), Se(2), j(fe);
			var Pe = B(fe, 2), M = (e) => {
				G(e, Nc());
			}, Le = (e) => {
				G(e, Pc());
			}, Re = (e) => {
				var r = Uc(), i = R(r);
				J(i, 21, () => H(se), (e) => e.id, (e, r) => {
					let i = /* @__PURE__ */ N(() => xe(H(r)));
					var o = Vc();
					let s;
					var c = L(o), l = L(c), u = B(l, 2), d = L(u);
					let f;
					var p = z(d, !0), m = z(B(d, 2));
					j(u), j(c);
					var h = B(c, 2), g = L(h), _ = (e) => {
						var t = Fc();
						V(() => vi(t, `left:${H(ge)}%`)), G(e, t);
					};
					q(g, (e) => {
						H(ge) !== null && e(_);
					});
					var v = B(g, 2);
					J(v, 17, () => t.indexed.analysis.compactions, (e) => e.id, (e, t) => {
						var n = Ic();
						V((e) => vi(n, e), [() => `left:${be(H(t).beforeModelCall)}%`]), G(e, n);
					}), J(B(v, 2), 19, () => H(O)(H(r)), (e) => e.id, (e, o, s) => {
						let c = /* @__PURE__ */ N(() => H(O)(H(r)).length > 1 ? `${Ce(H(r))} version ${H(s) + 1}` : Ce(H(r)));
						var l = zc(), u = R(l);
						J(u, 19, () => H(o).presence, (e, t) => `${H(o).id}:${t}`, (e, l, u) => {
							let d = /* @__PURE__ */ N(() => H(u) === H(o).presence.length - 1 && H(O)(H(r))[H(s) + 1]?.firstModelCall === H(l).endCall + 1), f = /* @__PURE__ */ N(() => H(u) === 0 && H(s) > 0 && H(O)(H(r))[H(s) - 1]?.lastModelCall === H(l).startCall - 1);
							var p = Lc();
							let m;
							V((e, t, n) => {
								m = gi(p, 1, "segment svelte-1pk7niq", null, m, {
									compacted: e,
									"replaced-after": H(d),
									"replaces-before": H(f)
								}), Y(p, "aria-label", `${H(c)}, calls ${H(l).startCall} through ${H(l).endCall}`), Y(p, "aria-pressed", a() === H(o).id), Y(p, "title", t), vi(p, n);
							}, [
								() => Ae(H(o).id, H(l)),
								() => `${H(c) === Ce(H(r)) ? H(i) : H(c)}: calls ${H(l).startCall}–${H(l).endCall}`,
								() => A(H(l), wa(t.indexed, H(r).id, n()), H(f), H(d))
							]), Or("pointerenter", p, (e) => t.onHoverItem(H(o).id, e)), U("pointermove", p, (e) => t.onHoverItem(H(o).id, e)), Or("pointerleave", p, () => t.onHoverItem(null)), U("click", p, (e) => ye(e, H(o).id, H(l))), G(e, p);
						});
						var d = B(u, 2), f = (e) => {
							var t = Rc();
							V((e) => vi(t, e), [() => `left:${be(H(o).firstModelCall)}%`]), G(e, t);
						};
						q(d, (e) => {
							H(s) > 0 && e(f);
						}), G(e, l);
					}), j(h);
					var y = B(h, 2), b = L(y), x = B(b), S = (e) => {
						var t = Bc(), n = z(t);
						V((e) => K(n, `${e ?? ""} calls covered`), [() => Ka(Oe(H(r)), ke(H(r)))]), G(e, t);
					}, ee = /* @__PURE__ */ N(() => Oe(H(r)) < ke(H(r)));
					q(x, (e) => {
						H(ee) && e(S);
					}), j(y), j(o), V((e, t, n, a, u, h, g, _, v, x) => {
						Y(o, "id", e), s = gi(o, 1, "row svelte-1pk7niq", null, s, { selected: t }), Y(o, "aria-label", n), Y(o, "data-lifespan-item-id", H(r).id), Y(c, "title", a), vi(l, u), f = gi(d, 1, "item-label svelte-1pk7niq", null, f, { "terminal-item": H(r).presence.length === 0 }), Y(d, "aria-label", h), K(p, H(i)), K(m, `${g ?? ""} · ${_ ?? ""}`), Y(y, "title", v), K(b, `${x ?? ""} `);
					}, [
						() => Ne(H(r).id),
						() => we(H(r), a()),
						() => `${Ce(H(r))}; ${Fo(H(r).kind)}; ${De(H(r))}`,
						() => Ce(H(r)),
						() => `background:${wa(t.indexed, H(r).id, n())}`,
						() => `Select ${Ce(H(r))}${H(r).presence.length === 0 ? "; no model-call presence" : ""}`,
						() => Fo(H(r).kind),
						() => De(H(r)),
						() => `${oc(H(O)(H(r)))} calls; ${Ka(Oe(H(r)), ke(H(r)))} tokenized`,
						() => Ga(ac(H(O)(H(r))), "calculatedTokens")
					]), U("click", d, () => t.onSelectItem(H(r).id)), G(e, o);
				}), j(i);
				var o = B(i, 2), s = (e) => {
					var t = Hc(), n = L(t), r = z(n), i = B(n, 2), a = z(i);
					j(t), V((e, t, n) => {
						K(r, `Showing ${e ?? ""} of ${t ?? ""}`), K(a, `Show ${n ?? ""} more`);
					}, [
						() => Q(H(se).length),
						() => ve(H(ae).length),
						() => Q(Math.min(50, H(ce)))
					]), U("click", i, Ie), G(e, t);
				};
				q(o, (e) => {
					H(ce) > 0 && e(s);
				}), G(e, r);
			};
			q(Pe, (e) => {
				H(S).length === 0 ? e(M) : H(ae).length === 0 ? e(Le, 1) : e(Re, -1);
			}), j(r), V((e) => {
				K(_, H(f) === "all" ? "Whole session" : `Present at call ${o()}`), Y(me, "aria-label", e);
			}, [() => je()]);
		}
		G(e, r);
	};
	q(Ge, (e) => {
		H(g) && e(Ke);
	}), j(Le), j(M), Li(M, (e) => I(b, e), () => H(b)), V((e) => K(Be, `Context lifespans · ${e ?? ""}`), [() => ve(H(S).length)]), Ri("open", "toggle", Le, (e) => I(g, e), () => H(g)), G(e, M), He(), i();
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
	subagentCallsNotShown: "Subagents' model calls are recorded in the session's file but are not shown.",
	repairedCompactionLink: "A compaction marker named a later or missing record as its predecessor; the conversation was continued from the record before the marker."
}, wl = /* @__PURE__ */ new Set([
	"opencode",
	"claude-code",
	"codex",
	"copilot",
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
}, Rl = {
	...Ll,
	note: "Copilot records what it charged for each call in credits, in the session file. Calls without a record are priced from the price table."
};
function zl(e, t) {
	return t === "claude-code" ? Fl : t === "codex" ? Il : t === "vscode-copilot" ? Ll : t === "copilot" ? Rl : Pl[e] ?? Pl.unknown;
}
function Bl(e) {
	return e === "pi";
}
function Vl(e) {
	return Bl(e) ? "Pi-normalized" : "Source-normalized";
}
//#endregion
//#region src/lib/economics.ts
var Hl = {
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
function Ul(e, t = "piModelRates", n = "pi") {
	if (!Object.prototype.hasOwnProperty.call(Hl, e)) return null;
	let r = Hl[e];
	if (e === "cacheWriteNotRetainedByPi" && !Bl(n)) return {
		title: "Source did not retain cache-write detail",
		impact: "The source normalizes cache writes to zero and may drop upstream write tokens; this is not a measured zero."
	};
	if (e === "piCostComponentsIncomplete" || e === "piCostMissing" || e === "piCostTotalDiffersFromComponents") {
		let n = zl(t), i = n.label;
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
		impact: zl(t, n).note
	};
	if (e === "piModelRateCostBasis" || e === "sourceModelRateCostBasis" || e === "providerReportedCostBasis" || e === "unknownCostBasis") {
		let e = zl(t);
		return {
			title: `Cost uses ${e.basisLabel.toLowerCase()}`,
			impact: t === "piModelRates" ? "This is a calculation from configured model rates, not a provider invoice or exact billed charge." : e.note
		};
	}
	return r;
}
//#endregion
//#region src/lib/session-label.ts
var Wl = new Intl.DateTimeFormat(void 0, {
	day: "numeric",
	month: "short",
	hour: "numeric",
	minute: "2-digit"
}), Gl = new Intl.DateTimeFormat(void 0, {
	day: "numeric",
	month: "short",
	year: "numeric",
	hour: "numeric",
	minute: "2-digit"
});
new Intl.NumberFormat(void 0, { maximumFractionDigits: 1 });
function Kl(e, t = /* @__PURE__ */ new Date()) {
	if (!e) return null;
	let n = new Date(e);
	return Number.isNaN(n.getTime()) ? null : (n.getFullYear() === t.getFullYear() ? Wl : Gl).format(n);
}
//#endregion
//#region src/lib/cost-assessment.ts
function ql(e) {
	return e === "pi" ? "Pi" : e === "opencode" ? "OpenCode" : e === "claude-code" ? "Claude Code" : e === "codex" ? "Codex" : e === "vscode-copilot" ? "VS Code Copilot" : e === "copilot" ? "Copilot" : "the harness";
}
function Jl(e, t) {
	return ["claude-code", "codex"].includes(t) && e.classificationRule === "billingModeTable";
}
function Yl(e, t) {
	if (e.kind === "apiEquivalent" && Jl(e, t)) return "API rate";
	switch (e.kind) {
		case "recorded": return "Recorded";
		case "estimated": return "Estimated";
		case "apiEquivalent": return "API-equivalent";
		case "free": return "Free";
		default: return "Unknown";
	}
}
function Xl(e, t, n) {
	return t === null || t === e ? n(e) : `${n(e)}–${n(t)}`;
}
function Zl(e) {
	if (e.amount === null) return "Unknown";
	let t = Xl(e.amount, e.amountHigh, (e) => za(e));
	return e.kind === "estimated" || e.kind === "apiEquivalent" ? `≈ ${t}` : t;
}
function Ql(e, t) {
	if (e.low === null) return "Unknown";
	let n = Xl(e.low, e.high, (e) => Ba(e));
	return t || e.high !== e.low ? `≈ ${n}` : n;
}
var $l = new Intl.DateTimeFormat("en-AU", {
	day: "numeric",
	month: "short",
	year: "numeric",
	timeZone: "UTC"
}), eu = {
	documented: "date from the provider",
	firstObserved: "date first seen on the provider's pricing page",
	modelsDevCommit: "date recorded by models.dev, which may lag the provider"
};
function tu(e) {
	let t = e.rate;
	if (!t) return null;
	let n = t.validFrom ? `from ${$l.format(new Date(t.validFrom))}` : "its first listed rate";
	return `${e.kind === "apiEquivalent" ? `${t.provider} API rate` : `${t.provider} rate`} for ${t.model}, ${n} (${eu[t.startBasis]})`;
}
function nu(e, t) {
	return e.kind === "recorded" || e.recordedByHarness === null || e.amount !== null && e.amountHigh === null && e.recordedByHarness === e.amount ? null : `Recorded by ${ql(t)}: ${za(e.recordedByHarness)}`;
}
function ru(e, t) {
	let n = ql(t);
	switch (e.classificationRule) {
		case "recordedCost": return t === "vscode-copilot" || t === "copilot" ? "Billed per token; this is what Copilot recorded charging, in credits at $0.01 each." : `Billed per token; this is the cost ${n} recorded.`;
		case "billingModeTable": return Jl(e, t) ? `At ${t === "codex" ? "OpenAI" : "Anthropic"}'s API rate.` : e.billingMode === "subscription" ? "This provider is covered by a subscription, so this is what the call would have cost at the API rate. It is not a charge." : e.kind === "free" ? "Billed per token, and the provider listed this model as free at the time." : `Billed per token. ${n} recorded no cost, so it is estimated at the provider's rate.`;
		case "opencodeZeroWithListedPrice": return "OpenCode recorded $0 although OpenAI listed a price, which happens when OpenCode signs in with a ChatGPT plan. Treated as a subscription: this is what the call would have cost at the API rate, not a charge.";
		case "perTokenDefault": return e.kind === "free" ? "The provider listed this model as free at the time." : `${n} recorded no cost, so it is estimated at the provider's rate.`;
		case "failedAttempt": return "The attempt failed; its recorded zeros are not a measurement, so no cost is shown.";
		case "missingTime": return "The call has no time to choose a price by.";
		case "noPrice": return "No price is known for this model at the time.";
		case "missingUsage": return "Token counts needed to estimate the cost were not recorded.";
	}
}
var iu = "A range because the harness did not record whether its output count already includes reasoning tokens.";
function au(e) {
	let t = [e.billed, e.apiEquivalent].filter((e) => e.calls > 0);
	if (t.length === 0) return null;
	let n = (e) => t.some((t) => t[e] === null) ? null : t.reduce((t, n) => t + (n[e] ?? 0), 0), r = {
		low: n("low"),
		high: n("high"),
		calls: t.reduce((e, t) => e + t.calls, 0)
	};
	return {
		label: "Cost",
		value: Ql(r, !0),
		note: ((e) => `${e.toLocaleString("en-AU")} call${e === 1 ? "" : "s"}`)(r.calls),
		title: "At API rates: the cost the harness recorded, or an estimate at the provider’s rate. Calls covered by a subscription are priced at what they would have cost. Not an invoice.",
		split: t.length === 2 ? `${Ql(e.billed, !0)} billed per token · ${Ql(e.apiEquivalent, !0)} covered by a subscription` : null
	};
}
function ou(e) {
	let t = [];
	return e.unknownCalls > 0 && t.push(`${e.unknownCalls.toLocaleString("en-AU")} call${e.unknownCalls === 1 ? "" : "s"} without a price`), e.failedAttemptCalls > 0 && t.push(`${e.failedAttemptCalls.toLocaleString("en-AU")} failed attempt${e.failedAttemptCalls === 1 ? "" : "s"} not counted`), t.length ? t.join(" · ") : null;
}
function su(e, t, n = /* @__PURE__ */ new Date()) {
	if (t === "vscode-copilot") return "The credits Copilot recorded for every request, at $0.01 each, including calls whose trace record is gone";
	let r = e.sinceMs === null ? null : Kl(new Date(e.sinceMs).toISOString(), n), i = `includes subagents and ${ql(t)}'s own calls, which are not in this transcript`;
	return r ? `Since ${r} · ${i}` : `Covers ${i.replace(/^includes /, "")}`;
}
//#endregion
//#region src/lib/recorded-usage.ts
var cu = {
	includesReasoning: "Recorded output includes reasoning",
	excludesReasoning: "Recorded output excludes reasoning",
	unknown: "Output/reasoning overlap not established"
};
function lu(e) {
	return cu[e];
}
function uu(e) {
	let t = [{
		label: "Recorded output",
		value: e.placeholder ? "Unavailable" : e.recordedOutput === null ? "Not recorded" : Z(e.recordedOutput)
	}];
	return (e.reasoning !== null || e.placeholder?.reasoning != null) && t.push({
		label: "Recorded reasoning",
		value: e.placeholder ? "Unavailable" : Z(e.reasoning)
	}), t;
}
function du(e) {
	let { recordedCalls: t, failedAttemptCalls: n, missingCalls: r } = e, i = t + n + r;
	if (i === 0 || t === i) return null;
	let a = [`${Q(t)} of ${Q(i)} calls`];
	return n > 0 && a.push(`${Q(n)} failed attempt${n === 1 ? "" : "s"} not recorded`), a.join(" · ");
}
//#endregion
//#region src/lib/components/ItemContribution.svelte
var fu = /* @__PURE__ */ W("<span class=\"track svelte-jx5fif\" aria-hidden=\"true\"><span class=\"fill svelte-jx5fif\"></span></span>"), pu = /* @__PURE__ */ W("<span class=\"unknown svelte-jx5fif\" aria-hidden=\"true\">Share unavailable</span>"), mu = /* @__PURE__ */ W("<span><!> <span class=\"detail svelte-jx5fif\"> </span></span>"), hu = {
	hash: "svelte-jx5fif",
	code: ".track.svelte-jx5fif {display:block;height:3px;margin-top:6px;overflow:hidden;border-radius:var(--radius-small);background:var(--separator);}.fill.svelte-jx5fif {display:block;height:100%;background:var(--secondary);}.unknown.svelte-jx5fif,\n  .detail.svelte-jx5fif {display:block;margin-top:5px;color:var(--secondary);font-size:var(--text-xs);font-weight:normal;}.detail.svelte-jx5fif {display:none;}button:focus .detail.svelte-jx5fif {display:block;}"
};
function gu(e, t) {
	Ve(t, !0), li(e, hu);
	var n = mu(), r = L(n), i = (e) => {
		var n = fu(), r = L(n);
		let i;
		j(n), V(() => i = vi(r, "", i, { width: `${t.value.share * 100}%` })), G(e, n);
	}, a = (e) => {
		G(e, pu());
	};
	q(r, (e) => {
		t.value.share === null ? e(a, -1) : e(i);
	});
	var o = B(r, 2), s = z(o, !0);
	j(n), V(() => {
		Y(o, "id", t.descriptionId), K(s, t.value.detail);
	}), G(e, n), He();
}
//#endregion
//#region src/lib/economics-policy.ts
var _u = {
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
}, vu = /* @__PURE__ */ new Set([
	"anthropic-messages-cache-v1",
	"github-copilot-messages-cache-v1",
	"github-copilot-responses-cache-v1"
]), yu = "openai-completions-cache-v1", bu = /* @__PURE__ */ new Set(["openai-responses-cache-read-v1", "openai-codex-responses-cache-read-v1"]), xu = Object.fromEntries(Object.entries(_u).map(([e, t]) => [e, t.categories])), Su = {
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
}, Cu = [
	"cacheRead",
	"cacheWrite",
	"fresh",
	"uncached",
	"nonRead"
];
function wu(e, t) {
	return `Cache-read share ${e.direction === "drop" ? "dropped" : "rose"} from ${Ha(e.previousRatio)} on call ${e.previousCallIndex} to ${Ha(e.currentRatio)} on call ${t}`;
}
function Tu(e) {
	let t = e.modelCalls.map((t) => Du(t, e));
	return {
		points: t,
		maximum: t.reduce((e, t) => t.status === "complete" || t.status === "zero" ? Math.max(e, t.promptTokens ?? 0) : e, 0),
		presentation: Eu(e, t)
	};
}
function Eu(e, t = e.modelCalls.map((t) => Du(t, e))) {
	let n = [...new Set(e.modelCalls.map((e) => e.economics.policyId).filter((e) => e !== null && xu[e] !== void 0))], r = new Map(t.map((e) => [e.callIndex, e])), i = Cu.flatMap((t) => {
		let i = n.filter((e) => xu[e]?.includes(t));
		if (i.length === 0) return [];
		let a = e.modelCalls.flatMap((e) => {
			if (!i.includes(e.economics.policyId ?? "")) return [];
			let t = r.get(e.index);
			return t ? [t] : [];
		}), o = a.length, s = a.filter((e) => (e.status === "complete" || e.status === "zero") && e.segments.some((e) => e.kind === t)).length, c = a.flatMap((e) => e.segments.filter((e) => e.kind === t).map((e) => e.value)), l = c.length > 0 && c.every((e) => e === 0), u = a.filter((e) => e.status === "missing").length, d = a.filter((e) => e.status === "partial").length, f = a.filter((e) => e.status === "unsupported").length, p, m = "";
		return t === "cacheWrite" && i.includes(yu) ? (p = "notReported", m = "Chat Completions does not report a separate cache-write bucket.") : p = s === 0 ? f === o ? "unsupported" : u === o ? "missing" : u > 0 || d > 0 || f > 0 ? "partial" : "missing" : u > 0 || d > 0 || f > 0 || s < o ? "partial" : l ? "measuredZero" : "available", t === "nonRead" && (m = "Read-only Responses policies cannot establish a separate fresh/write split."), t === "cacheWrite" && i.some((e) => bu.has(e)) && (p = "notRetained", m = Bl(e.session.source) ? "The audited read-only policy does not establish separate cache-write detail from Pi." : "The audited read-only policy does not establish separate cache-write detail from the source."), [{
			kind: t,
			label: Su[t].label,
			shortLabel: Su[t].shortLabel,
			applicablePolicyIds: i,
			availability: p,
			completeCalls: s,
			applicableCalls: o,
			note: m
		}];
	}), a = [], o = e.modelCalls.filter((e) => e.economics.policyId === null || e.economics.usageCompleteness === "unsupported").length;
	n.length === 0 ? a.push("No supported provider/API cache policy is available for this session.") : o > 0 && a.push(`${o} call${o === 1 ? "" : "s"} lack a supported cache interpretation; raw call details remain available.`), n.includes(yu) && a.push("Chat Completions does not report cache writes separately; its input series is labeled uncached."), n.some((e) => bu.has(e)) && a.push(Bl(e.session.source) ? "Read-only Responses policies: non-cache-read input may include writes; the audited Pi policy does not establish the write/fresh split." : "Read-only Responses policies: non-cache-read input may include writes; the source policy does not establish the write/fresh split.");
	let s = n.length > 1;
	return s && a.unshift("Categories vary by model/API; each call retains its exact policy semantics."), {
		categories: i,
		applicablePolicyIds: n,
		mixedPolicy: s,
		summary: n.length === 0 ? "Cache categories unavailable under the retained provider/API policy." : s ? "Categories vary by model/API." : "Categories follow the audited provider/API policy.",
		notes: a
	};
}
function Du(e, t) {
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
	if (vu.has(n.policyId)) {
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
	} else if (n.policyId === yu) s = [{
		kind: "cacheRead",
		label: "Cache read",
		value: a
	}, {
		kind: "uncached",
		label: "Uncached input",
		value: i
	}], c = "The audited Chat Completions target does not report a separate cache-write bucket.";
	else if (bu.has(n.policyId)) s = [{
		kind: "cacheRead",
		label: "Cache read",
		value: a
	}, {
		kind: "nonRead",
		label: "Non-cache-read input",
		value: i
	}], c = Bl(t.session.source) ? "Non-cache-read input may include writes; Pi does not retain the write/fresh split." : "Non-cache-read input may include writes; the source does not retain the write/fresh split.";
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
function Ou(e) {
	let t = e.modelCalls.map(ku);
	return {
		points: t,
		maximum: t.reduce((e, t) => t.status === "known" || t.status === "zero" ? Math.max(e, t.high ?? t.total ?? 0) : e, 0)
	};
}
function ku(e) {
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
function Au(e, t, n, r) {
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
function ju(e, t, n) {
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
function Mu(e, t) {
	return e.map((e, n) => ({
		id: e,
		position: n,
		tokens: t.get(e)?.tokens ?? null
	})).sort((e, t) => (t.tokens ?? -1) - (e.tokens ?? -1) || e.position - t.position).map((e) => e.id);
}
//#endregion
//#region src/lib/components/call-timing.ts
var Nu = "The rate is reported output, including reasoning, over that time.";
function Pu(e, t = !1) {
	switch (e) {
		case "claude-code": return "Claude Code does not record when a request started, so the response time and output rate are unavailable.";
		case "codex": return "Codex does not record when a request started, so the response time and output rate are unavailable.";
		case "vscode-copilot": return t ? `From Copilot sending the request to the end of the response, as its trace records show. ${Nu}` : "VS Code Copilot's trace record for this call is gone (Copilot keeps them for a few days), and the session file does not record when a response started, so the response time and output rate are unavailable.";
		case "copilot": return `From Copilot sending the request to the end of the response, as its usage record reports. ${Nu}`;
		case "pi": return `From Pi starting the response to recording it, including waiting and retries. ${Nu}`;
		case "opencode": return `From OpenCode creating the response to completing it, including waiting and retries. ${Nu}`;
		default: return `From the recorded start of the response to its end, including waiting and retries. ${Nu}`;
	}
}
function Fu(e) {
	return e === null ? "Unavailable" : e < 1e3 ? `${e.toLocaleString()} ms` : e < 6e4 ? `${(e / 1e3).toLocaleString(void 0, { maximumFractionDigits: 2 })} s` : `${Math.floor(e / 6e4).toLocaleString()} min ${(e % 6e4 / 1e3).toLocaleString(void 0, { maximumFractionDigits: 2 })} s`;
}
function Iu(e) {
	return e === null ? "Unavailable" : e > 0 && e < .01 ? "<0.01 tok/s" : `${e.toLocaleString(void 0, { maximumFractionDigits: 2 })} tok/s`;
}
//#endregion
//#region src/lib/components/CallDetails.svelte
var Lu = 0;
function Ru(e, t, n) {
	let r = t(e);
	return e !== null && n ? `≈ ${r}` : r;
}
var zu = /* @__PURE__ */ W("<span class=\"retry-note svelte-1d84xhe\">Copilot recorded this call as a retry after an error.</span>"), Bu = /* @__PURE__ */ W("<small class=\"svelte-1d84xhe\">The total of several requests: this response ran web searches, so it is not compared\n              with the context.</small>"), Vu = /* @__PURE__ */ W("<small class=\"svelte-1d84xhe\">The compaction's own call, which wrote the summary that replaced the context.</small>"), Hu = /* @__PURE__ */ W("<small class=\"svelte-1d84xhe\">The total of the compaction's requests, which wrote the summary that replaced the\n              context.</small>"), Uu = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div>"), Wu = /* @__PURE__ */ W("<p class=\"svelte-1d84xhe\"> </p>"), Gu = /* @__PURE__ */ W("<div class=\"cost-explanation svelte-1d84xhe\"><p class=\"svelte-1d84xhe\"> </p> <!> <!> <!></div>"), Ku = /* @__PURE__ */ W("<small class=\"svelte-1d84xhe\"> </small>"), qu = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\">Provider usage</dt> <dd class=\"svelte-1d84xhe\"> <!></dd></div>"), Ju = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\">Response time (approx.)</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Effective output rate</dt> <dd class=\"svelte-1d84xhe\"> </dd></div>", 1), Yu = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\">Timing</dt> <dd class=\"svelte-1d84xhe\">Not recorded<!></dd></div>"), Xu = /* @__PURE__ */ W("<span class=\"timing-explanation svelte-1d84xhe\"> </span>"), Zu = /* @__PURE__ */ W("<li class=\"svelte-1d84xhe\"><button type=\"button\" class=\"svelte-1d84xhe\"> <!></button></li>"), Qu = /* @__PURE__ */ W("<div class=\"change-list svelte-1d84xhe\"><h4 class=\"svelte-1d84xhe\"> </h4> <p class=\"change-baseline svelte-1d84xhe\">Share of estimated added tokens</p> <ul role=\"list\" class=\"svelte-1d84xhe\"></ul></div>"), $u = /* @__PURE__ */ W("<div class=\"change-list svelte-1d84xhe\"><h4 class=\"svelte-1d84xhe\"> </h4> <p class=\"change-baseline svelte-1d84xhe\"><!></p> <ul role=\"list\" class=\"svelte-1d84xhe\"></ul></div>"), ed = /* @__PURE__ */ W("<details class=\"svelte-1d84xhe\"><summary class=\"svelte-1d84xhe\"> </summary> <div><!> <!></div></details>"), td = /* @__PURE__ */ W("<p> </p>"), nd = /* @__PURE__ */ W("<span> </span>"), rd = /* @__PURE__ */ W("<div class=\"tool-summary svelte-1d84xhe\"><b>Tools invoked after this response</b> <div class=\"tool-list svelte-1d84xhe\"></div></div>"), id = /* @__PURE__ */ W("<p class=\"economics-note svelte-1d84xhe\">Failed or aborted attempt: recorded zeros are placeholders, not measured usage. Actual\n          token consumption and cost are unavailable; partial output does not establish usage.</p> <h4 class=\"svelte-1d84xhe\">Raw recorded placeholders</h4> <dl class=\"detail-rows svelte-1d84xhe\" aria-label=\"Raw recorded placeholders\"><!> <!></dl>", 1), ad = /* @__PURE__ */ W("<p class=\"economics-note svelte-1d84xhe\">These dollar figures do not measure Copilot subscription charges or premium requests.</p>"), od = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Reported total tokens</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div>", 1), sd = /* @__PURE__ */ W("<div class=\"ratio-discontinuity svelte-1d84xhe\" role=\"note\"><b> </b> <p class=\"svelte-1d84xhe\"> <!></p> <button type=\"button\" class=\"svelte-1d84xhe\"> </button></div>"), cd = /* @__PURE__ */ W("<b> </b> ", 1), ld = /* @__PURE__ */ W("<b>Unrecognized economics explanation</b> — see the raw code in Technical identifiers.", 1), ud = /* @__PURE__ */ W("<li><!></li>"), dd = /* @__PURE__ */ W("<h4 class=\"svelte-1d84xhe\">Economics notes</h4> <ul class=\"economics-explanations svelte-1d84xhe\"></ul>", 1), fd = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\">Known framing</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Calculated request</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Residual</dt> <dd class=\"svelte-1d84xhe\"> </dd></div>", 1), pd = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\">Reported − reconstructed (approximate)</dt> <dd class=\"svelte-1d84xhe\"> <!></dd></div>"), md = /* @__PURE__ */ W("<b>Unrecognized diagnostic</b> — see the raw code in Technical identifiers.", 1), hd = /* @__PURE__ */ W("<h4 class=\"svelte-1d84xhe\">Diagnostic explanations</h4> <ul class=\"diagnostics svelte-1d84xhe\"></ul>", 1), gd = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\">Cache write 1h (source detail)</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Output accounting</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Completion total (including reasoning)</dt> <dd class=\"svelte-1d84xhe\"> </dd></div>", 1), _d = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\">Reconciliation status</dt> <dd class=\"svelte-1d84xhe\"> </dd></div>"), vd = /* @__PURE__ */ W("<small class=\"metric-note svelte-1d84xhe\"> </small>"), yd = /* @__PURE__ */ W(" <!>", 1), bd = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\">Tokenization profile ID</dt> <dd class=\"svelte-1d84xhe\"><code class=\"svelte-1d84xhe\"> </code> <!></dd></div>"), xd = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\">Economics policy ID</dt> <dd class=\"svelte-1d84xhe\"><code class=\"svelte-1d84xhe\"> </code> <!></dd></div>"), Sd = /* @__PURE__ */ W("<div><dt class=\"svelte-1d84xhe\">Compaction before this call</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Compaction ID</dt> <dd class=\"svelte-1d84xhe\"><code class=\"svelte-1d84xhe\"> </code></dd></div>", 1), Cd = /* @__PURE__ */ W("<span class=\"error-mark svelte-1d84xhe\">failed</span>"), wd = /* @__PURE__ */ W("<li class=\"svelte-1d84xhe\"> <code class=\"svelte-1d84xhe\"> </code> <!> <!></li>"), Td = /* @__PURE__ */ W("<h4 class=\"svelte-1d84xhe\">Tool-call IDs</h4> <ul class=\"tool-identifiers svelte-1d84xhe\"></ul>", 1), Ed = /* @__PURE__ */ W("<li><code class=\"svelte-1d84xhe\"> </code></li>"), Dd = /* @__PURE__ */ W("<h4 class=\"svelte-1d84xhe\">Raw diagnostic codes</h4> <ul class=\"svelte-1d84xhe\"></ul>", 1), Od = /* @__PURE__ */ W("<h4 class=\"svelte-1d84xhe\">Raw economics codes</h4> <ul class=\"svelte-1d84xhe\"></ul>", 1), kd = /* @__PURE__ */ W("<section class=\"call-details svelte-1d84xhe\"><header class=\"svelte-1d84xhe\"><div class=\"svelte-1d84xhe\"><h3 id=\"pinned-call-summary\" tabindex=\"-1\" class=\"svelte-1d84xhe\"> </h3> <span class=\"svelte-1d84xhe\"> </span> <!></div></header> <dl class=\"essential-metrics svelte-1d84xhe\"><div><dt class=\"svelte-1d84xhe\">Input</dt> <dd class=\"svelte-1d84xhe\"> <!></dd></div> <!> <div><dt class=\"svelte-1d84xhe\">Cost</dt> <dd class=\"svelte-1d84xhe\"> <!><small class=\"svelte-1d84xhe\"> </small></dd></div> <!> <!></dl> <!> <!> <!> <!> <details class=\"usage-breakdown svelte-1d84xhe\"><summary class=\"svelte-1d84xhe\">Usage and economics</summary> <!> <!> <dl class=\"detail-rows svelte-1d84xhe\"><div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Cache-read share</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Cache-write share</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\"> </dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <!></dl> <!> <!></details> <details class=\"token-diagnostics svelte-1d84xhe\"><summary class=\"svelte-1d84xhe\">Token estimates</summary> <dl class=\"detail-rows svelte-1d84xhe\"><div><dt class=\"svelte-1d84xhe\">Visible context</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <!> <div><dt class=\"svelte-1d84xhe\">Added tokens</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Retained tokens</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Dropped tokens</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Oldest / median live age</dt> <dd class=\"svelte-1d84xhe\"> </dd></div></dl> <!></details> <details class=\"call-diagnostics svelte-1d84xhe\"><summary class=\"svelte-1d84xhe\">Diagnostics</summary> <dl class=\"detail-rows svelte-1d84xhe\"><!> <div><dt class=\"svelte-1d84xhe\">Cumulative prompt</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Cumulative completion (including reasoning)</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Cumulative reasoning</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Cumulative usage completeness</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Estimate coverage</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <!> <div><dt class=\"svelte-1d84xhe\">Model / tokenizer</dt> <dd class=\"svelte-1d84xhe\"><!></dd></div> <div><dt class=\"svelte-1d84xhe\">Token-weighted mean age</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <div><dt class=\"svelte-1d84xhe\">Items aged ≥5 / ≥10 / ≥20 calls</dt> <dd class=\"svelte-1d84xhe\"> </dd></div></dl></details> <details class=\"technical-identifiers svelte-1d84xhe\"><summary class=\"svelte-1d84xhe\">Technical identifiers</summary> <dl class=\"identifier-list svelte-1d84xhe\"><div><dt class=\"svelte-1d84xhe\">Source record ID</dt> <dd class=\"svelte-1d84xhe\"><code class=\"svelte-1d84xhe\"> </code> <!></dd></div> <!> <!></dl> <dl class=\"technical-values svelte-1d84xhe\"><div><dt class=\"svelte-1d84xhe\">Stop reason</dt> <dd class=\"svelte-1d84xhe\"> </dd></div> <!></dl> <!> <!> <!></details></section>"), Ad = {
	hash: "svelte-1d84xhe",
	code: ".call-details.svelte-1d84xhe {color:var(--text);min-width:0;max-width:100%;}header.svelte-1d84xhe {position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;gap:16px;align-items:start;margin:-2px 0 8px;padding:4px 0 7px;background:var(--surface);}header.svelte-1d84xhe div:where(.svelte-1d84xhe) {display:flex;flex-direction:column;gap:2px;}header.svelte-1d84xhe h3:where(.svelte-1d84xhe) {margin:0;color:var(--text);font-size:var(--text-lg);}header.svelte-1d84xhe h3:where(.svelte-1d84xhe):focus {outline:2px solid var(--accent);outline-offset:2px;}header.svelte-1d84xhe span:where(.svelte-1d84xhe) {color:var(--secondary);font-size:var(--text-sm);overflow-wrap:anywhere;}header.svelte-1d84xhe .retry-note:where(.svelte-1d84xhe) {display:block;margin-top:2px;}.essential-metrics.svelte-1d84xhe,\n  .detail-rows.svelte-1d84xhe,\n  .technical-values.svelte-1d84xhe {display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:7px 14px;margin:0;}.cost-explanation.svelte-1d84xhe p:where(.svelte-1d84xhe) {margin:0;overflow-wrap:anywhere;}.cost-explanation.svelte-1d84xhe p:where(.svelte-1d84xhe) + p:where(.svelte-1d84xhe) {margin-top:6px;}.timing-explanation.svelte-1d84xhe {position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;}dt.svelte-1d84xhe {color:var(--secondary);font-size:var(--text-sm);}dd.svelte-1d84xhe {margin:1px 0 0;color:var(--text-strong);overflow-wrap:anywhere;}dd.svelte-1d84xhe small:where(.svelte-1d84xhe) {display:block;color:var(--secondary);font-size:var(--text-sm);}.change-lists.svelte-1d84xhe {display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:8px 14px;margin-top:10px;}.change-lists.single.svelte-1d84xhe {grid-template-columns:minmax(0, 1fr);}details.svelte-1d84xhe {margin-top:10px;min-width:0;}.change-list.svelte-1d84xhe {min-width:0;}.change-lists.svelte-1d84xhe h4:where(.svelte-1d84xhe) {margin-top:0;}.change-lists.svelte-1d84xhe ul:where(.svelte-1d84xhe) {list-style:none;padding-left:0;}.change-lists.svelte-1d84xhe button:where(.svelte-1d84xhe) {width:100%;text-align:left;}.change-baseline.svelte-1d84xhe {margin:0 0 6px;color:var(--secondary);font-size:var(--text-xs);}summary.svelte-1d84xhe {color:var(--text);cursor:pointer;}.tool-summary.svelte-1d84xhe {margin-top:10px;}.tool-list.svelte-1d84xhe {display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:4px;}.tool-chip.svelte-1d84xhe {display:inline;color:var(--secondary);font-size:var(--text-sm);cursor:default;}.tool-chip.failed.svelte-1d84xhe {color:var(--error);}.detail-rows.svelte-1d84xhe,\n  .technical-values.svelte-1d84xhe {margin-top:8px;}.economics-note.svelte-1d84xhe,\n  .economics-explanations.svelte-1d84xhe {color:var(--secondary);font-size:var(--text-sm);line-height:1.4;}.economics-note.svelte-1d84xhe {margin:6px 0;}.ratio-discontinuity.svelte-1d84xhe {margin-top:9px;padding:8px 10px;border-left:3px solid var(--event-warning);border-radius:4px;background:var(--surface-raised);color:var(--text);font-size:var(--text-sm);}.ratio-discontinuity.svelte-1d84xhe p:where(.svelte-1d84xhe) {margin:4px 0 7px;color:var(--text);}h4.svelte-1d84xhe {margin:11px 0 4px;color:var(--text);font-size:var(--text-sm);}ul.svelte-1d84xhe {margin:4px 0 0;padding-left:18px;overflow-wrap:anywhere;}.diagnostics.svelte-1d84xhe {font-size:var(--text-sm);}.identifier-list.svelte-1d84xhe {display:grid;gap:7px;margin:8px 0 0;}.identifier-list.svelte-1d84xhe dd:where(.svelte-1d84xhe) {display:grid;justify-items:start;gap:4px;}.tool-identifiers.svelte-1d84xhe li:where(.svelte-1d84xhe) {margin-top:5px;}code.svelte-1d84xhe {color:var(--secondary);overflow-wrap:anywhere;user-select:all;}button.svelte-1d84xhe:not(.copy-control:where(.svelte-1d84xhe) button:where(.svelte-1d84xhe)) {max-width:100%;overflow-wrap:anywhere;}.error-mark.svelte-1d84xhe {color:var(--error);margin-left:6px;}\n  @container highwater (max-width: 520px) {.essential-metrics.svelte-1d84xhe,\n    .detail-rows.svelte-1d84xhe,\n    .technical-values.svelte-1d84xhe,\n    .change-lists.svelte-1d84xhe {grid-template-columns:1fr;}\n  }"
};
function jd(e, t) {
	Ve(t, !0), li(e, Ad);
	let n = `call-contribution-${Lu++}`, r = X(t, "sections", 19, Hi), i = X(t, "pinned", 3, !1), a = X(t, "onSelectItem", 3, () => {}), o = X(t, "onPinCall", 3, () => {}), s = /* @__PURE__ */ N(() => t.call?.tokenAnalysis.metricsIncludePartialEstimates ?? !1), c = /* @__PURE__ */ N(() => t.call ? gl(t.indexed, t.call) : null), l = /* @__PURE__ */ N(() => t.call?.compactionBefore ? t.indexed.compactionById.get(t.call.compactionBefore) ?? null : null), u = /* @__PURE__ */ N(() => (() => {
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
	})()), d = /* @__PURE__ */ N(() => t.call ? uu(t.call.usage) : []), f = /* @__PURE__ */ N(() => t.call?.tokenAnalysis.explanationCodes ?? []), p = /* @__PURE__ */ N(() => jl(t.indexed.analysis)), h = /* @__PURE__ */ N(() => H(f).filter((e) => !H(p).has(e))), g = /* @__PURE__ */ N(() => t.indexed.analysis.session.source === "vscode-copilot" ? t.call?.timing.durationMs != null : !["claude-code", "codex"].includes(t.indexed.analysis.session.source)), _ = /* @__PURE__ */ N(() => t.call?.economics.explanationCodes ?? []), v = /* @__PURE__ */ N(() => t.call !== null && t.call !== void 0 && t.call.stopReason !== "compaction-aggregate" && (t.call.stopReason === "compaction-call" || t.indexed.analysis.compactions.some((e) => e.details.summaryCall === t.call.index))), y = /* @__PURE__ */ N(() => zl(t.indexed.analysis.economics.costBasis, t.indexed.analysis.session.source)), b = /* @__PURE__ */ N(() => t.call?.costAssessment ?? null), x = /* @__PURE__ */ N(() => H(b) ? tu(H(b)) : null), S = /* @__PURE__ */ N(() => Pu(t.indexed.analysis.session.source, H(g))), ee = /* @__PURE__ */ N(() => H(b) ? nu(H(b), t.indexed.analysis.session.source) : null), C = /* @__PURE__ */ N(() => t.call?.tokenizationProfileId ? t.indexed.analysis.tokenAnalysis.profiles.find((e) => e.id === t.call?.tokenizationProfileId) ?? null : null), te = /* @__PURE__ */ N(() => t.call ? t.indexed.analysis.modelCalls[t.indexed.analysis.modelCalls.findIndex((e) => e.index === t.call?.index) - 1] ?? null : null), w = /* @__PURE__ */ N(() => Au(t.indexed, t.call?.addedItemIds ?? [], t.call, "added")), T = /* @__PURE__ */ N(() => Au(t.indexed, t.call?.droppedItemIds ?? [], H(te), "dropped"));
	function E(e) {
		return Ao(t.indexed.itemById.get(e), e);
	}
	function D(e) {
		return e === "anthropic-messages-cache-v1" || e === "github-copilot-messages-cache-v1" || e === "github-copilot-responses-cache-v1" ? "Fresh input" : e === "openai-completions-cache-v1" ? "Uncached input" : e === "openai-responses-cache-read-v1" || e === "openai-codex-responses-cache-read-v1" ? "Non-cache-read input (may include writes)" : "Input (raw normalized bucket)";
	}
	function O() {
		if (!t.call) return "Unknown";
		switch (t.call.economics.cacheWriteStatus) {
			case "reported": return Z(t.call.usage.cacheWrite);
			case "notReported": return "Not separately reported";
			case "notRetainedByPi": return Bl(t.indexed.analysis.session.source) ? "Not retained by Pi" : "Not retained by source";
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
		return e === null ? t.call ? t.call.economics.usageCompleteness === "unsupported" ? "Unsupported policy" : t.call.economics.usageCompleteness === "missing" ? "Provider usage missing" : t.call.economics.usageCompleteness === "partial" ? "Provider usage incomplete" : t.call.economics.promptTokens === 0 ? "No prompt tokens" : "Unavailable" : "Unknown" : Va(e);
	}
	function ae() {
		return t.call ? t.call.economics.cacheWriteStatus === "notReported" ? "Not separately reported" : t.call.economics.cacheWriteStatus === "notRetainedByPi" ? Bl(t.indexed.analysis.session.source) ? "Not retained by Pi" : "Not retained by source" : t.call.economics.cacheWriteStatus === "unsupported" ? "Unsupported policy" : ie(t.call.economics.cacheWriteRatio) : "Unknown";
	}
	function oe() {
		return t.call ? t.call.economics.policyId === "openai-responses-cache-read-v1" || t.call.economics.policyId === "openai-codex-responses-cache-read-v1" ? "Unavailable; writes may be included in non-read input" : ie(t.call.economics.freshRatio) : "Unknown";
	}
	var se = Br(), ce = R(se), le = (e) => {
		var p = kd(), b = L(p), se = L(b), ce = L(se), le = z(ce), ue = B(ce, 2), de = z(ue), fe = B(ue, 2), pe = (e) => {
			G(e, zu());
		};
		q(fe, (e) => {
			t.call.retried && e(pe);
		}), j(se), j(b);
		var me = B(b, 2), he = L(me), ge = B(L(he), 2), _e = L(ge), ve = B(_e), k = (e) => {
			G(e, Bu());
		}, ye = (e) => {
			G(e, Vu());
		}, A = (e) => {
			G(e, Hu());
		};
		q(ve, (e) => {
			t.call.stopReason === "web-search-aggregate" ? e(k) : H(v) ? e(ye, 1) : t.call.stopReason === "compaction-aggregate" && e(A, 2);
		}), j(ge), j(he);
		var be = B(he, 2);
		J(be, 17, () => H(d), $r, (e, t) => {
			var n = Uu(), r = L(n), i = z(r, !0), a = z(B(r, 2), !0);
			j(n), V(() => {
				K(i, H(t).label), K(a, H(t).value);
			}), G(e, n);
		});
		var xe = B(be, 2), Ce = B(L(xe), 2), we = L(Ce, !0), Te = B(we);
		{
			let e = /* @__PURE__ */ N(() => `${n}-cost`);
			_a(Te, {
				get id() {
					return H(e);
				},
				label: "How this cost is worked out",
				children: (e, n) => {
					var r = Gu(), i = L(r), a = z(i, !0), o = B(i, 2), s = (e) => {
						var t = Wu(), n = z(t, !0);
						V(() => K(n, iu)), G(e, t);
					};
					q(o, (e) => {
						t.call.costAssessment.amountHigh !== null && e(s);
					});
					var c = B(o, 2), l = (e) => {
						var t = Wu(), n = z(t);
						V(() => K(n, `Rate: ${H(x) ?? ""}.`)), G(e, t);
					};
					q(c, (e) => {
						H(x) && e(l);
					});
					var u = B(c, 2), d = (e) => {
						var t = Wu(), n = z(t, !0);
						V(() => K(n, H(ee))), G(e, t);
					};
					q(u, (e) => {
						H(ee) && e(d);
					}), j(r), V((e) => K(a, e), [() => ru(t.call.costAssessment, t.indexed.analysis.session.source)]), G(e, r);
				},
				$$slots: { default: !0 }
			});
		}
		var Ee = z(B(Te), !0);
		j(Ce), j(xe);
		var De = B(xe, 2), Oe = (e) => {
			var n = qu(), r = B(L(n), 2), i = L(r, !0), a = B(i), o = (e) => {
				var n = Ku(), r = z(n);
				V(() => K(r, `Audited policy: ${t.call.economics.usageCompleteness ?? ""}`)), G(e, n);
			};
			q(a, (e) => {
				t.call.economics.usageCompleteness !== t.call.reportedUsageCompleteness && e(o);
			}), j(r), j(n), V(() => K(i, t.call.usage.placeholder ? "Unavailable" : t.call.reportedUsageCompleteness)), G(e, n);
		};
		q(De, (e) => {
			(t.call.usage.placeholder || t.call.reportedUsageCompleteness !== "complete" || t.call.economics.usageCompleteness !== t.call.reportedUsageCompleteness) && e(Oe);
		});
		var ke = B(De, 2), Ae = (e) => {
			var r = Ju(), i = R(r), a = B(L(i), 2), o = z(a, !0);
			j(i);
			var s = B(i, 2), c = B(L(s), 2), l = z(c, !0);
			j(s), V((e, t) => {
				Y(a, "title", H(S)), Y(a, "aria-describedby", `${n}-timing`), K(o, e), Y(c, "title", H(S)), Y(c, "aria-describedby", `${n}-timing`), K(l, t);
			}, [() => Fu(t.call.timing.durationMs), () => Iu(t.call.timing.effectiveOutputTokensPerSecond)]), G(e, r);
		}, je = (e) => {
			var t = Yu(), r = B(L(t), 2), i = B(L(r));
			{
				let e = /* @__PURE__ */ N(() => `${n}-timing`);
				_a(i, {
					get id() {
						return H(e);
					},
					label: "Why timing is not recorded",
					children: (e, t) => {
						Se();
						var n = zr();
						V(() => K(n, H(S))), G(e, n);
					},
					$$slots: { default: !0 }
				});
			}
			j(r), j(t), G(e, t);
		};
		q(ke, (e) => {
			H(g) ? e(Ae) : e(je, -1);
		}), j(me);
		var Me = B(me, 2), Ne = (e) => {
			var t = Xu(), r = z(t, !0);
			V(() => {
				Y(t, "id", `${n}-timing`), K(r, H(S));
			}), G(e, t);
		};
		q(Me, (e) => {
			H(g) && e(Ne);
		});
		var Pe = B(Me, 2), Fe = (e) => {
			var i = ed(), o = L(i), s = z(o), c = B(o, 2);
			let l;
			var u = L(c), d = (e) => {
				var r = Qu(), i = L(r), o = z(i), s = B(i, 4);
				J(s, 21, () => t.call.addedItemIds, $r, (e, t, r) => {
					let i = /* @__PURE__ */ N(() => H(w).get(H(t)));
					var o = Zu(), s = L(o), c = L(s, !0), l = B(c);
					{
						let e = /* @__PURE__ */ N(() => `${n}-added-${r}`);
						gu(l, {
							get value() {
								return H(i);
							},
							get descriptionId() {
								return H(e);
							}
						});
					}
					j(s), j(o), V((e, t, i) => {
						Y(s, "aria-label", e), Y(s, "aria-describedby", `${n}-added-${r}`), Y(s, "title", t), K(c, i);
					}, [
						() => `Select added item ${E(H(t))}`,
						() => `${E(H(t))} — ${H(i).detail}`,
						() => E(H(t))
					]), U("click", s, () => a()(H(t))), G(e, o);
				}), j(s), j(r), V((e) => K(o, `Added items (${e ?? ""})`), [() => Q(t.call.addedItemIds.length)]), G(e, r);
			};
			q(u, (e) => {
				t.call.addedItemIds.length > 0 && e(d);
			});
			var f = B(u, 2), p = (e) => {
				var r = $u(), i = L(r), o = z(i), s = B(i, 2), c = L(s), l = (e) => {
					var t = zr();
					V(() => K(t, `Share of estimated dropped tokens · previous call ${H(te).index ?? ""}`)), G(e, t);
				}, u = (e) => {
					G(e, zr("Previous\n                  call unavailable"));
				};
				q(c, (e) => {
					H(te) ? e(l) : e(u, -1);
				}), j(s);
				var d = B(s, 2);
				J(d, 21, () => t.call.droppedItemIds, $r, (e, t, r) => {
					let i = /* @__PURE__ */ N(() => H(T).get(H(t)));
					var o = Zu(), s = L(o), c = L(s, !0), l = B(c);
					{
						let e = /* @__PURE__ */ N(() => `${n}-dropped-${r}`);
						gu(l, {
							get value() {
								return H(i);
							},
							get descriptionId() {
								return H(e);
							}
						});
					}
					j(s), j(o), V((e, t, i) => {
						Y(s, "aria-label", e), Y(s, "aria-describedby", `${n}-dropped-${r}`), Y(s, "title", t), K(c, i);
					}, [
						() => `Select dropped item ${E(H(t))}`,
						() => `${E(H(t))} — ${H(i).detail}`,
						() => E(H(t))
					]), U("click", s, () => a()(H(t))), G(e, o);
				}), j(d), j(r), V((e) => K(o, `Dropped items (${e ?? ""})`), [() => Q(t.call.droppedItemIds.length)]), G(e, r);
			};
			q(f, (e) => {
				t.call.droppedItemIds.length > 0 && e(p);
			}), j(c), j(i), ui(i, (e, t) => Ui?.(e, t), () => ({
				state: r(),
				key: "changes"
			})), V((e, n, r) => {
				K(s, `Context changes · ${e ?? ""} added / ${n ?? ""} retained / ${r ?? ""} dropped`), l = gi(c, 1, "change-lists svelte-1d84xhe", null, l, { single: t.call.addedItemIds.length === 0 || t.call.droppedItemIds.length === 0 });
			}, [
				() => Q(t.call.transitionItemCounts.added),
				() => Q(t.call.transitionItemCounts.retained),
				() => Q(t.call.transitionItemCounts.dropped)
			]), G(e, i);
		}, Ie = (e) => {
			var n = td(), r = z(n);
			V((e, t, n) => K(r, `Context changes · ${e ?? ""} added / ${t ?? ""} retained / ${n ?? ""} dropped`), [
				() => Q(t.call.transitionItemCounts.added),
				() => Q(t.call.transitionItemCounts.retained),
				() => Q(t.call.transitionItemCounts.dropped)
			]), G(e, n);
		};
		q(Pe, (e) => {
			t.call.addedItemIds.length > 0 || t.call.droppedItemIds.length > 0 ? e(Fe) : e(Ie, -1);
		});
		var M = B(Pe, 2), Le = (e) => {
			var t = td(), n = z(t);
			V((e, t) => K(n, `Compaction · ${e ?? ""} removed / ${t ?? ""} retained`), [() => Q(H(l).sourceItemIds.length), () => Q(H(l).retainedItemIds.length)]), G(e, t);
		};
		q(M, (e) => {
			H(l) && e(Le);
		});
		var Re = B(M, 2), ze = (e) => {
			var t = rd(), n = B(L(t), 2);
			J(n, 21, () => H(u), $r, (e, t) => {
				var n = nd();
				let r;
				var i = z(n);
				V(() => {
					r = gi(n, 1, "tool-chip svelte-1d84xhe", null, r, { failed: H(t).failed }), K(i, `${H(t).name ?? ""}${H(t).count > 1 ? ` × ${H(t).count}` : ""}${H(t).failed ? " · failed" : ""}`);
				}), G(e, n);
			}), j(n), j(t), G(e, t);
		};
		q(Re, (e) => {
			H(u).length > 0 && e(ze);
		});
		var Be = B(Re, 2), Ve = B(L(Be), 2), He = (e) => {
			let n = /* @__PURE__ */ N(() => t.call.usage.placeholder);
			var r = id(), i = B(R(r), 4), a = L(i);
			J(a, 17, () => [
				["Input", H(n).input],
				["Output", H(n).output],
				["Cache read", H(n).cacheRead],
				["Cache write", H(n).cacheWrite],
				["Cache write 1h", H(n).cacheWrite1h],
				["Reasoning", H(n).reasoning],
				["Total tokens", H(n).totalTokens]
			], $r, (e, t) => {
				var n = /* @__PURE__ */ N(() => m(H(t), 2));
				let r = () => H(n)[0], i = () => H(n)[1];
				var a = Uu(), o = L(a), s = z(o), c = z(B(o, 2), !0);
				j(a), V((e) => {
					K(s, `${r() ?? ""} (raw placeholder)`), K(c, e);
				}, [() => Z(i())]), G(e, a);
			}), J(B(a, 2), 17, () => [
				["Input", H(n).cost?.input],
				["Output", H(n).cost?.output],
				["Cache read", H(n).cost?.cacheRead],
				["Cache write", H(n).cost?.cacheWrite],
				["Total", H(n).cost?.total]
			], $r, (e, t) => {
				var n = /* @__PURE__ */ N(() => m(H(t), 2));
				let r = () => H(n)[0], i = () => H(n)[1];
				var a = Uu(), o = L(a), s = z(o), c = z(B(o, 2), !0);
				j(a), V((e) => {
					K(s, `${r() ?? ""} cost (raw placeholder)`), K(c, e);
				}, [() => za(i())]), G(e, a);
			}), j(i), G(e, r);
		};
		q(Ve, (e) => {
			t.call.usage.placeholder && e(He);
		});
		var Ue = B(Ve, 2), We = (e) => {
			G(e, ad());
		};
		q(Ue, (e) => {
			t.call.provider === "github-copilot" && e(We);
		});
		var Ge = B(Ue, 2), Ke = L(Ge), qe = L(Ke), Je = z(qe, !0), Ye = z(B(qe, 2), !0);
		j(Ke);
		var Xe = B(Ke, 2), Ze = L(Xe), Qe = z(Ze, !0), $e = z(B(Ze, 2), !0);
		j(Xe);
		var et = B(Xe, 2), tt = L(et), nt = z(tt, !0), rt = z(B(tt, 2), !0);
		j(et);
		var it = B(et, 2), at = z(B(L(it), 2), !0);
		j(it);
		var ot = B(it, 2), st = z(B(L(ot), 2), !0);
		j(ot);
		var ct = B(ot, 2), lt = L(ct), ut = z(lt, !0), dt = z(B(lt, 2), !0);
		j(ct);
		var ft = B(ct, 2), pt = (e) => {
			var n = od(), r = R(n), i = L(r), a = z(i), o = z(B(i, 2), !0);
			j(r);
			var s = B(r, 2), c = L(s), l = z(c, !0), u = z(B(c, 2), !0);
			j(s);
			var d = B(s, 2), f = z(B(L(d), 2), !0);
			j(d);
			var p = B(d, 2), m = L(p), h = z(m), g = z(B(m, 2), !0);
			j(p);
			var _ = B(p, 2), v = L(_), b = z(v), x = z(B(v, 2), !0);
			j(_);
			var S = B(_, 2), ee = L(S), C = z(ee), te = z(B(ee, 2), !0);
			j(S);
			var w = B(S, 2), T = L(w), E = z(T), D = z(B(T, 2), !0);
			j(w);
			var O = B(w, 2), ne = L(O), re = z(ne, !0), ie = z(B(ne, 2), !0);
			j(O), V((e, n, r, i, s, c, d) => {
				K(a, `${H(y).label ?? ""} component completeness`), K(o, t.call.economics.costCompleteness), K(l, H(y).promptLabel), K(u, e), K(f, n), K(h, `${H(y).componentPrefix ?? ""} input cost`), K(g, r), K(b, `${H(y).componentPrefix ?? ""} output cost`), K(x, i), K(C, `${H(y).componentPrefix ?? ""} cache-read cost`), K(te, s), K(E, `${H(y).componentPrefix ?? ""} cache-write cost`), K(D, c), K(re, H(y).totalLabel), K(ie, d);
			}, [
				() => za(t.call.economics.piPromptCost),
				() => Z(t.call.reportedTotalTokens),
				() => za(t.call.cost?.input),
				() => za(t.call.cost?.output),
				() => za(t.call.cost?.cacheRead),
				() => za(t.call.cost?.cacheWrite),
				() => za(t.call.cost?.total)
			]), G(e, n);
		}, mt = /* @__PURE__ */ N(() => ![
			"claude-code",
			"codex",
			"copilot",
			"vscode-copilot"
		].includes(t.indexed.analysis.session.source));
		q(ft, (e) => {
			H(mt) && e(pt);
		}), j(Ge);
		var ht = B(Ge, 2), gt = (e) => {
			let n = /* @__PURE__ */ N(() => t.call.economics.cacheRatioDiscontinuity);
			var r = sd(), i = L(r), a = z(i, !0), s = B(i, 2), c = L(s), l = B(c), u = (e) => {
				var t = zr();
				V(() => K(t, `Compaction ${H(n).compactionBefore ?? ""} is nearby context.`)), G(e, t);
			};
			q(l, (e) => {
				H(n).compactionBefore && e(u);
			}), j(s);
			var d = B(s, 2), f = z(d);
			j(r), V((e, t, r, i) => {
				K(a, e), K(c, `Adjacent-call change: ${t ?? ""} to
            ${r ?? ""} prompt tokens; change of
            ${i ?? ""} percentage points (${H(n).magnitude ?? ""}). Method:
            ${H(n).method ?? ""}. `), K(f, `Inspect previous call ${H(n).previousCallIndex ?? ""}`);
			}, [
				() => wu(H(n), t.call.index),
				() => Q(H(n).previousPromptTokens),
				() => Q(H(n).currentPromptTokens),
				() => (H(n).delta * 100).toFixed(1)
			]), U("click", d, () => o()(H(n).previousCallIndex)), G(e, r);
		};
		q(ht, (e) => {
			t.call.economics.cacheRatioDiscontinuity && e(gt);
		});
		var _t = B(ht, 2), vt = (e) => {
			var n = dd(), r = B(R(n), 2);
			J(r, 20, () => H(_), (e) => e, (e, n) => {
				let r = /* @__PURE__ */ N(() => Ul(n, t.indexed.analysis.economics.costBasis, t.indexed.analysis.session.source));
				var i = ud(), a = L(i), o = (e) => {
					var t = cd(), n = R(t), i = z(n, !0), a = B(n);
					V(() => {
						K(i, H(r).title), K(a, ` — ${H(r).impact ?? ""}`);
					}), G(e, t);
				}, s = (e) => {
					var t = ld();
					Se(), G(e, t);
				};
				q(a, (e) => {
					H(r) ? e(o) : e(s, -1);
				}), j(i), G(e, i);
			}), j(r), G(e, n);
		};
		q(_t, (e) => {
			H(_).length > 0 && e(vt);
		}), j(Be), ui(Be, (e, t) => Ui?.(e, t), () => ({
			state: r(),
			key: "usage"
		}));
		var yt = B(Be, 2), bt = B(L(yt), 2), xt = L(bt), St = z(B(L(xt), 2), !0);
		j(xt);
		var Ct = B(xt, 2), wt = (e) => {
			var n = fd(), r = R(n), i = z(B(L(r), 2), !0);
			j(r);
			var a = B(r, 2), o = z(B(L(a), 2), !0);
			j(a);
			var s = B(a, 2), c = z(B(L(s), 2));
			j(s), V((e, t, n, r) => {
				K(i, e), K(o, t), K(c, `${n ?? ""} (${r ?? ""})`);
			}, [
				() => Z(t.call.tokenAnalysis.knownFramingOverheadTokens),
				() => Z(t.call.tokenAnalysis.calculatedRequestTokens),
				() => Z(t.call.tokenAnalysis.residualTokens),
				() => Va(t.call.tokenAnalysis.residualPercent)
			]), G(e, n);
		}, Tt = (e) => {
			var t = pd(), n = B(L(t), 2), r = L(n), i = B(r), a = (e) => {
				var t = zr();
				V((e) => K(t, `(${e ?? ""} of reported input)`), [() => Va((H(c).reported - H(c).reconstructed) / H(c).reported)]), G(e, t);
			};
			q(i, (e) => {
				H(c).reported > 0 && e(a);
			}), j(n), j(t), V((e) => K(r, `${e ?? ""} tokens `), [() => Z(H(c).reported - H(c).reconstructed)]), G(e, t);
		};
		q(Ct, (e) => {
			t.call.tokenAnalysis.calculatedRequestTokens === null ? H(c) && e(Tt, 1) : e(wt);
		});
		var Et = B(Ct, 2), Dt = z(B(L(Et), 2), !0);
		j(Et);
		var P = B(Et, 2), Ot = z(B(L(P), 2), !0);
		j(P);
		var kt = B(P, 2), At = z(B(L(kt), 2), !0);
		j(kt);
		var jt = B(kt, 2), Mt = z(B(L(jt), 2));
		j(jt), j(bt);
		var Nt = B(bt, 2), Pt = (e) => {
			var t = hd(), n = B(R(t), 2);
			J(n, 20, () => H(h), (e) => e, (e, t) => {
				let n = /* @__PURE__ */ N(() => Ro(t));
				var r = ud(), i = L(r), a = (e) => {
					var t = cd(), r = R(t), i = z(r, !0), a = B(r);
					V(() => {
						K(i, H(n).title), K(a, ` — ${H(n).impact ?? ""}`);
					}), G(e, t);
				}, o = (e) => {
					var t = md();
					Se(), G(e, t);
				};
				q(i, (e) => {
					H(n) ? e(a) : e(o, -1);
				}), j(r), G(e, r);
			}), j(n), G(e, t);
		};
		q(Nt, (e) => {
			H(h).length > 0 && e(Pt);
		}), j(yt), ui(yt, (e, t) => Ui?.(e, t), () => ({
			state: r(),
			key: "diagnostics"
		}));
		var Ft = B(yt, 2), It = B(L(Ft), 2), Lt = L(It), Rt = (e) => {
			var n = gd(), r = R(n), i = z(B(L(r), 2), !0);
			j(r);
			var a = B(r, 2), o = z(B(L(a), 2), !0);
			j(a);
			var s = B(a, 2), c = z(B(L(s), 2), !0);
			j(s), V((e, t, n) => {
				K(i, e), K(o, t), K(c, n);
			}, [
				() => Z(t.call.usage.cacheWrite1h),
				() => lu(t.call.usage.outputReasoningRelationship),
				() => Z(t.call.reportedCompletionTokens)
			]), G(e, n);
		};
		q(Lt, (e) => {
			t.call.usage.placeholder || e(Rt);
		});
		var zt = B(Lt, 2), Bt = z(B(L(zt), 2), !0);
		j(zt);
		var Vt = B(zt, 2), Ht = z(B(L(Vt), 2), !0);
		j(Vt);
		var Ut = B(Vt, 2), Wt = z(B(L(Ut), 2), !0);
		j(Ut);
		var Gt = B(Ut, 2), Kt = z(B(L(Gt), 2), !0);
		j(Gt);
		var qt = B(Gt, 2), Jt = z(B(L(qt), 2));
		j(qt);
		var F = B(qt, 2), Yt = (e) => {
			var n = _d(), r = z(B(L(n), 2), !0);
			j(n), V(() => K(r, t.call.tokenAnalysis.status)), G(e, n);
		};
		q(F, (e) => {
			t.call.tokenAnalysis.status !== "unavailable" && e(Yt);
		});
		var I = B(F, 2), Xt = B(L(I), 2), Zt = L(Xt), Qt = (e) => {
			var t = yd(), n = R(t), r = B(n), i = (e) => {
				var t = vd(), n = z(t, !0);
				V((e) => K(n, e), [() => fa(H(C))]), G(e, t);
			}, a = /* @__PURE__ */ N(() => fa(H(C)));
			q(r, (e) => {
				H(a) && e(i);
			}), V((e) => K(n, `${H(C).provider ?? ""} / ${H(C).model ?? ""} · ${e ?? ""} `), [() => ma(H(C).method)]), G(e, t);
		}, $t = (e) => {
			var n = zr();
			V(() => K(n, `Tokenizer profile unavailable · ${t.call.tokenizationProfileId ?? ""}`)), G(e, n);
		}, en = (e) => {
			G(e, zr("Unavailable"));
		};
		q(Zt, (e) => {
			H(C) ? e(Qt) : t.call.tokenizationProfileId ? e($t, 1) : e(en, -1);
		}), j(Xt), j(I);
		var tn = B(I, 2), nn = z(B(L(tn), 2));
		j(tn);
		var rn = B(tn, 2), an = z(B(L(rn), 2));
		j(rn), j(It), j(Ft), ui(Ft, (e, t) => Ui?.(e, t), () => ({
			state: r(),
			key: "estimator"
		}));
		var on = B(Ft, 2), sn = B(L(on), 2), cn = L(sn), ln = B(L(cn), 2), un = L(ln), dn = z(un, !0);
		Ya(B(un, 2), {
			get value() {
				return t.call.sourceRecordId;
			},
			label: "source record ID"
		}), j(ln), j(cn);
		var fn = B(cn, 2), pn = (e) => {
			var n = bd(), r = B(L(n), 2), i = L(r), a = z(i, !0);
			Ya(B(i, 2), {
				get value() {
					return t.call.tokenizationProfileId;
				},
				label: "tokenization profile ID"
			}), j(r), j(n), V(() => K(a, t.call.tokenizationProfileId)), G(e, n);
		};
		q(fn, (e) => {
			t.call.tokenizationProfileId && e(pn);
		});
		var mn = B(fn, 2), hn = (e) => {
			var n = xd(), r = B(L(n), 2), i = L(r), a = z(i, !0);
			Ya(B(i, 2), {
				get value() {
					return t.call.economics.policyId;
				},
				label: "economics policy ID"
			}), j(r), j(n), V(() => K(a, t.call.economics.policyId)), G(e, n);
		};
		q(mn, (e) => {
			t.call.economics.policyId && e(hn);
		}), j(sn);
		var gn = B(sn, 2), _n = L(gn), vn = z(B(L(_n), 2), !0);
		j(_n);
		var yn = B(_n, 2), bn = (e) => {
			var t = Sd(), n = R(t), r = z(B(L(n), 2));
			j(n);
			var i = B(n, 2), a = B(L(i), 2), o = z(L(a), !0);
			j(a), j(i), V((e, t) => {
				K(r, `${e ?? ""} removed ·
              ${t ?? ""} retained`), K(o, H(l).id);
			}, [() => Q(H(l).sourceItemIds.length), () => Q(H(l).retainedItemIds.length)]), G(e, t);
		};
		q(yn, (e) => {
			H(l) && e(bn);
		}), j(gn);
		var xn = B(gn, 2), Sn = (e) => {
			var n = Td(), r = B(R(n), 2);
			J(r, 21, () => t.call.toolCallsAfter, (e) => e.id, (e, t) => {
				var n = wd(), r = L(n), i = B(r), a = z(i, !0), o = B(i, 2);
				{
					let e = /* @__PURE__ */ N(() => `${H(t).name} tool-call ID`);
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
					G(e, Cd());
				};
				q(s, (e) => {
					H(t).failed && e(c);
				}), j(n), V(() => {
					K(r, `${H(t).name ?? ""} `), K(a, H(t).id);
				}), G(e, n);
			}), j(r), G(e, n);
		};
		q(xn, (e) => {
			H(u).length > 0 && e(Sn);
		});
		var Cn = B(xn, 2), wn = (e) => {
			var t = Dd(), n = B(R(t), 2);
			J(n, 20, () => H(f), (e) => e, (e, t) => {
				var n = Ed(), r = z(L(n), !0);
				j(n), V(() => K(r, t)), G(e, n);
			}), j(n), G(e, t);
		};
		q(Cn, (e) => {
			H(f).length > 0 && e(wn);
		});
		var Tn = B(Cn, 2), En = (e) => {
			var t = Od(), n = B(R(t), 2);
			J(n, 20, () => H(_), (e) => e, (e, t) => {
				var n = Ed(), r = z(L(n), !0);
				j(n), V(() => K(r, t)), G(e, n);
			}), j(n), G(e, t);
		};
		q(Tn, (e) => {
			H(_).length > 0 && e(En);
		}), j(on), ui(on, (e, t) => Ui?.(e, t), () => ({
			state: r(),
			key: "identifiers"
		})), j(p), V((e, r, a, o, s, c, l, u, d, f, m, h, g, _, v, y, b, x, S, ee, C, te, w, T, E, D, O, ne) => {
			Y(p, "aria-label", `${i() ? "Pinned" : "Model"} call ${t.call.index}`), K(le, `${i() ? "Pinned call" : "Call"}
          ${t.call.index ?? ""}`), K(de, `${t.call.provider ?? "Unknown provider" ?? ""} / ${t.call.model ?? "Unknown model" ?? ""}`), K(_e, `${e ?? ""} `), Y(Ce, "aria-describedby", `${n}-cost`), K(we, r), K(Ee, a), K(Je, o), K(Ye, s), K(Qe, t.call.economics.policyId ? "Cache read" : "Cache read (raw field)"), K($e, c), K(nt, l), K(rt, u), K(at, d), K(st, f), K(ut, m), K(dt, h), K(St, g), K(Dt, _), K(Ot, v), K(At, y), K(Mt, `${b ?? ""} /
            ${x ?? ""} calls`), K(Bt, S), K(Ht, ee), K(Wt, C), K(Kt, t.call.cumulativeReportedUsageCompleteness), K(Jt, `${te ?? ""}
            items complete · ${w ?? ""} partial
            · ${T ?? ""} unavailable`), K(nn, `${E ?? ""} calls`), K(an, `${D ?? ""} /
            ${O ?? ""} /
            ${ne ?? ""}`), K(dn, t.call.sourceRecordId), K(vn, t.call.stopReason ?? "Unknown");
		}, [
			() => t.call.usage.placeholder ? "Unavailable" : Z(t.call.reportedPromptTokens),
			() => t.call.usage.placeholder ? "Unavailable" : Zl(t.call.costAssessment),
			() => Yl(t.call.costAssessment, t.indexed.analysis.session.source),
			() => D(t.call.economics.policyId),
			() => Z(t.call.usage.input),
			() => Z(t.call.usage.cacheRead),
			() => re(),
			() => O(),
			() => ie(t.call.economics.cacheReadRatio),
			() => ae(),
			() => ne(t.call.economics.policyId),
			() => oe(),
			() => Z(t.call.tokenAnalysis.calculatedVisibleTokens),
			() => Ru(t.call.tokenAnalysis.addedTokens, Z, H(s)),
			() => Ru(t.call.tokenAnalysis.retainedTokens, Z, H(s)),
			() => Ru(t.call.tokenAnalysis.droppedTokens, Z, H(s)),
			() => Z(t.call.tokenAnalysis.age.oldestLiveItemAgeCalls),
			() => Z(t.call.tokenAnalysis.age.medianLiveItemAgeCalls),
			() => Z(t.call.cumulativeReportedPromptTokens),
			() => Z(t.call.cumulativeReportedCompletionTokens),
			() => Z(t.call.cumulativeReportedReasoningTokens),
			() => Ka(t.call.tokenAnalysis.estimateCoverage.completeItems, t.call.tokenAnalysis.estimateCoverage.totalItems),
			() => Q(t.call.tokenAnalysis.estimateCoverage.partialItems),
			() => Q(t.call.tokenAnalysis.estimateCoverage.unavailableItems),
			() => Ru(t.call.tokenAnalysis.age.tokenWeightedMeanAgeCalls, Z, H(s)),
			() => Q(t.call.tokenAnalysis.age.itemsAtLeast5CallsOld),
			() => Q(t.call.tokenAnalysis.age.itemsAtLeast10CallsOld),
			() => Q(t.call.tokenAnalysis.age.itemsAtLeast20CallsOld)
		]), G(e, p);
	};
	q(ce, (e) => {
		t.call && e(le);
	}), G(e, se), He();
}
kr(["click"]);
//#endregion
//#region src/lib/session-links.ts
function Md(e) {
	return e.metadata.childSession || null;
}
function Nd(e, t = null) {
	let n = new URLSearchParams({ session: e });
	return t !== null && n.set("child", t), `#${n}`;
}
function Pd(e, t) {
	return e.filter((e) => e.parentReference === t);
}
//#endregion
//#region src/lib/compaction-details.ts
var Fd = /* @__PURE__ */ new Set(["automatic", "manual"]), Id = /* @__PURE__ */ new Set([
	"keptFromEntry",
	"recentExchange",
	"preservedSegment",
	"summaryOnly",
	"replacementHistory",
	"keptLastMessages",
	"inferredFromInput"
]), Ld = [
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
function Rd(e, t) {
	let n = e.details, r = (t) => {
		throw new $(`Compaction ${e.id} has ${t}`);
	};
	if (!n || typeof n != "object") return r("no details");
	n.trigger !== null && !Fd.has(n.trigger) && r("an unknown trigger"), n.rule !== null && !Id.has(n.rule) && r("an unknown rule"), n.instructions !== null && typeof n.instructions != "string" && r("invalid instructions");
	for (let e of Ld) {
		let t = n[e];
		t !== null && (!Number.isSafeInteger(t) || t < 0) && r(`an invalid ${e}`);
	}
	let i = n.startedBeforeModelCall;
	i !== null && (!Number.isSafeInteger(i) || i < 1 || i > e.beforeModelCall) && r("a start after it is applied"), n.summaryCall !== null && !t.has(n.summaryCall) && r("an unknown summary call");
}
var zd = (e, t, n) => `${Q(e)} ${e === 1 ? t : n}`;
function Bd(e, t) {
	let n = ql(t), r = e.details, i = e.retainedItemIds.length;
	switch (r.rule) {
		case "keptLastMessages": {
			let e = r.messagesKept ?? 0, t = r.messagesAddedWhileRunning;
			return `${n} kept the last ${zd(e, "message", "messages")} from when the compaction started` + (t ? `, and the ${zd(t, "message", "messages")} added while it ran.` : ".");
		}
		case "keptFromEntry": return `${n} kept everything from the first entry it marked to keep: ${zd(i, "item", "items")}.`;
		case "preservedSegment": return `${n} kept the recent messages it recorded as preserved: ${zd(r.messagesKept ?? i, "message", "messages")}.`;
		case "recentExchange": return `${n} kept its summary and the recent exchange it saved with it, as one item.`;
		case "replacementHistory": return `${n} recorded the conversation that replaced the old one; ${zd(i, "item", "items")} in it were already in context.`;
		case "summaryOnly": return `${n} kept only its summary.`;
		case "inferredFromInput": return `${n} does not record what it kept, so this was worked out from the next call's input.`;
		default: return null;
	}
}
function Vd(e, t, n) {
	let r = e.details, i = ql(t), a = [];
	if (r.trigger && a.push({
		label: "Started",
		value: r.trigger === "manual" ? r.instructions ? `By the user, with the focus “${r.instructions}”` : "By the user" : `Automatically by ${i}`
	}), a.push({
		label: "When",
		value: r.startedBeforeModelCall !== null && r.startedBeforeModelCall < e.beforeModelCall ? `Started before call ${r.startedBeforeModelCall} and ran in the background; applied before call ${e.beforeModelCall}` : `Before call ${e.beforeModelCall}`
	}), r.durationMs !== null && a.push({
		label: "Took",
		value: Fu(r.durationMs)
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
		value: s ? `Call ${s.index} · ${Z(s.reportedPromptTokens)} input · ${za(s.costAssessment.amount)}` : `Not recorded by ${i}`
	}), {
		rule: Bd(e, t),
		rows: a,
		summaryCall: s
	};
}
//#endregion
//#region src/lib/components/ItemDetails.svelte
var Hd = /* @__PURE__ */ W("<p class=\"presence-note svelte-bb734v\">This item has no model-call presence, so it has no location to reveal in Context River.</p>"), Ud = /* @__PURE__ */ W("<p class=\"presence-note svelte-bb734v\"> </p>"), Wd = /* @__PURE__ */ W("<button type=\"button\">Reveal in River</button>"), Gd = /* @__PURE__ */ W("<button type=\"button\"> </button>"), Kd = /* @__PURE__ */ W("<p class=\"preview-note svelte-bb734v\">Expanded preview truncated.</p>"), qd = /* @__PURE__ */ W("<pre class=\"svelte-bb734v\"> </pre> <!>", 1), Jd = /* @__PURE__ */ W("<p class=\"content-preview svelte-bb734v\"><b>Content preview</b> </p>"), Yd = /* @__PURE__ */ W("<p class=\"preview-note svelte-bb734v\">No content preview is available.</p>"), Xd = /* @__PURE__ */ W("<button type=\"button\" class=\"preview-toggle svelte-bb734v\"> </button>"), Zd = /* @__PURE__ */ W("<small class=\"svelte-bb734v\">Latest actual presence; not a newly pinned call.</small>"), Qd = /* @__PURE__ */ W("<small class=\"svelte-bb734v\"> </small>"), $d = /* @__PURE__ */ W("<small class=\"svelte-bb734v\">Includes partial, heuristic or unavailable profile estimates.</small>"), ef = /* @__PURE__ */ W("Started <a class=\"svelte-bb734v\"> </a>", 1), tf = /* @__PURE__ */ W("<h4 class=\"svelte-bb734v\">Child session</h4> <p class=\"svelte-bb734v\"><!></p>", 1), nf = /* @__PURE__ */ W("<p class=\"svelte-bb734v\"> </p>"), rf = /* @__PURE__ */ W("<div><dt class=\"svelte-bb734v\"> </dt> <dd class=\"svelte-bb734v\"> </dd></div>"), af = /* @__PURE__ */ W("<p class=\"svelte-bb734v\"> </p> <!> <dl class=\"detail-rows compaction-rows svelte-bb734v\"></dl> <!>", 1), of = /* @__PURE__ */ W("<h4 class=\"svelte-bb734v\">Compaction</h4> <!> <!> <!>", 1), sf = /* @__PURE__ */ W("<b class=\"svelte-bb734v\"> </b>"), cf = /* @__PURE__ */ W("<li class=\"svelte-bb734v\"><!> <!></li>"), lf = /* @__PURE__ */ W("<h4 class=\"svelte-bb734v\">Versions</h4> <ol class=\"versions svelte-bb734v\"></ol>", 1), uf = /* @__PURE__ */ W("<button type=\"button\" class=\"svelte-bb734v\"> </button>"), df = /* @__PURE__ */ W("<div class=\"relations svelte-bb734v\"><span class=\"svelte-bb734v\">Predecessors</span> <!></div>"), ff = /* @__PURE__ */ W("<div class=\"relations svelte-bb734v\"><span class=\"svelte-bb734v\">Successors</span> <!></div>"), pf = /* @__PURE__ */ W("<div class=\"lineage-actions svelte-bb734v\"><b>Lineage actions</b> <!> <!></div>"), mf = /* @__PURE__ */ W("<small class=\"metric-note\"> </small>"), hf = /* @__PURE__ */ W(" <!>", 1), gf = /* @__PURE__ */ W("<div><dt class=\"svelte-bb734v\">Selected estimate method</dt> <dd class=\"svelte-bb734v\"> </dd></div> <div><dt class=\"svelte-bb734v\">Selected estimate coverage</dt> <dd class=\"svelte-bb734v\"> </dd></div>", 1), _f = /* @__PURE__ */ W("<p class=\"svelte-bb734v\">Unavailable</p>"), vf = /* @__PURE__ */ W("<li><b> </b> </li>"), yf = /* @__PURE__ */ W("<ul class=\"svelte-bb734v\"></ul>"), bf = /* @__PURE__ */ W("<b> </b> ", 1), xf = /* @__PURE__ */ W("<b>Unrecognized diagnostic</b> — see the raw code in Technical identifiers.", 1), Sf = /* @__PURE__ */ W("<li><!></li>"), Cf = /* @__PURE__ */ W("<h4 class=\"svelte-bb734v\">Diagnostic explanations</h4> <ul class=\"diagnostics svelte-bb734v\"></ul>", 1), wf = /* @__PURE__ */ W("<div><dt class=\"svelte-bb734v\">Estimate profile ID</dt> <dd class=\"svelte-bb734v\"><code class=\"svelte-bb734v\"> </code> <!></dd></div>"), Tf = /* @__PURE__ */ W("<div><dt class=\"svelte-bb734v\">Source record ID</dt> <dd class=\"svelte-bb734v\"><code class=\"svelte-bb734v\"> </code> <!></dd></div>"), Ef = /* @__PURE__ */ W("<div><dt class=\"svelte-bb734v\">Source tool-call ID</dt> <dd class=\"svelte-bb734v\"><code class=\"svelte-bb734v\"> </code> <!></dd></div>"), Df = /* @__PURE__ */ W("<h4 class=\"svelte-bb734v\">Source metadata</h4> <ul class=\"svelte-bb734v\"></ul>", 1), Of = /* @__PURE__ */ W("<li><code class=\"svelte-bb734v\"> </code></li>"), kf = /* @__PURE__ */ W("<h4 class=\"svelte-bb734v\">Raw diagnostic codes</h4> <ul class=\"svelte-bb734v\"></ul>", 1), Af = /* @__PURE__ */ W("<header class=\"item-identity svelte-bb734v\"><div class=\"svelte-bb734v\"><span class=\"svelte-bb734v\"> </span> <h3 id=\"selected-item-summary\" class=\"selected-item-summary svelte-bb734v\" tabindex=\"-1\"> </h3></div></header> <!> <!> <!> <!> <details class=\"svelte-bb734v\"><summary class=\"svelte-bb734v\">Content preview</summary> <div class=\"preview-details svelte-bb734v\"><!> <!></div></details> <dl class=\"essential-metrics svelte-bb734v\"><div><dt class=\"svelte-bb734v\">Lifetime</dt> <dd class=\"svelte-bb734v\"><!></dd></div> <div><dt class=\"svelte-bb734v\"><!></dt> <dd class=\"svelte-bb734v\"> <!></dd></div> <div><dt class=\"svelte-bb734v\">Whole-session exposure<!></dt> <dd class=\"svelte-bb734v\"> <!> <!></dd></div></dl> <!> <!> <!> <!> <details class=\"item-diagnostics svelte-bb734v\"><summary class=\"svelte-bb734v\">Diagnostics</summary> <dl class=\"detail-rows svelte-bb734v\"><div><dt class=\"svelte-bb734v\">Estimate basis</dt> <dd class=\"svelte-bb734v\"><!> </dd></div> <div><dt class=\"svelte-bb734v\">Token coverage</dt> <dd class=\"svelte-bb734v\"> </dd></div> <div><dt class=\"svelte-bb734v\">Serialized diagnostic size</dt> <dd class=\"svelte-bb734v\"> </dd></div> <!></dl> <h4 class=\"svelte-bb734v\">Profile estimates</h4> <!> <!></details> <details class=\"technical-identifiers svelte-bb734v\"><summary class=\"svelte-bb734v\">Technical identifiers</summary> <dl class=\"identifier-list svelte-bb734v\"><!> <div><dt class=\"svelte-bb734v\">Context ID</dt> <dd class=\"svelte-bb734v\"><code class=\"svelte-bb734v\"> </code><!></dd></div> <!> <!></dl> <!> <!></details>", 1), jf = /* @__PURE__ */ W("<p class=\"svelte-bb734v\">Select an item to inspect its context.</p>"), Mf = /* @__PURE__ */ W("<section class=\"item-details svelte-bb734v\" aria-live=\"polite\"><!></section>"), Nf = {
	hash: "svelte-bb734v",
	code: ".item-details.svelte-bb734v {color:var(--text);min-width:0;}.item-identity.svelte-bb734v {position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:4px 0 7px;background:var(--surface);}.item-identity.svelte-bb734v > div:where(.svelte-bb734v) {display:grid;min-width:0;gap:5px;}.item-identity.svelte-bb734v span:where(.svelte-bb734v) {display:inline-block;color:var(--text);border:1px solid var(--separator);border-radius:999px;padding:2px 7px;font-size:var(--text-sm);}h3.svelte-bb734v {color:var(--text-strong);font-size:var(--text-lg);margin:0 0 6px;overflow-wrap:anywhere;}h3.svelte-bb734v:focus {outline:2px solid var(--accent);outline-offset:2px;}a.svelte-bb734v {color:var(--accent);}h4.svelte-bb734v {margin:11px 0 4px;color:var(--text);font-size:var(--text-sm);}.content-preview.svelte-bb734v {color:var(--text);white-space:pre-wrap;overflow-wrap:anywhere;}.preview-note.svelte-bb734v,\n  .presence-note.svelte-bb734v {color:var(--secondary);font-size:var(--text-sm);}details.svelte-bb734v {margin-top:10px;}summary.svelte-bb734v {color:var(--text);cursor:pointer;}.preview-toggle.svelte-bb734v {display:block;width:fit-content;margin:7px 0 0 auto;min-height:28px;padding:4px 8px;font-size:var(--text-xs);color:var(--secondary);background:transparent;border:1px solid transparent;}.preview-toggle.svelte-bb734v:hover {text-decoration:underline;background:var(--plot);}.preview-details.svelte-bb734v pre:where(.svelte-bb734v) {color:var(--text);background:var(--plot);border-radius:var(--control-radius);margin:7px 0 0;padding:8px;white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;}.essential-metrics.svelte-bb734v,\n  .detail-rows.svelte-bb734v {display:grid;grid-template-columns:minmax(0, 1fr);gap:7px 14px;margin:10px 0 0;}dt.svelte-bb734v {color:var(--secondary);font-size:var(--text-sm);}dd.svelte-bb734v {margin:1px 0 0;overflow-wrap:anywhere;color:var(--text);}.essential-metrics.svelte-bb734v dd:where(.svelte-bb734v) small:where(.svelte-bb734v) {display:block;margin-top:2px;color:var(--secondary);font-size:var(--text-sm);}.versions.svelte-bb734v {display:grid;gap:6px;margin:0;padding:0;list-style:none;font-size:var(--text-sm);}.versions.svelte-bb734v li:where(.svelte-bb734v) {display:grid;justify-items:start;gap:2px;}.versions.svelte-bb734v b:where(.svelte-bb734v) {font-weight:600;}.versions.svelte-bb734v small:where(.svelte-bb734v) {color:var(--secondary);overflow-wrap:anywhere;}.lineage-actions.svelte-bb734v {display:grid;gap:7px;margin-top:10px;}.relations.svelte-bb734v {display:flex;flex-wrap:wrap;align-items:center;gap:5px;}.relations.svelte-bb734v span:where(.svelte-bb734v) {color:var(--secondary);font-size:var(--text-sm);}.relations.svelte-bb734v button:where(.svelte-bb734v) {max-width:100%;overflow-wrap:anywhere;text-align:left;}.diagnostics.svelte-bb734v,\n  .item-diagnostics.svelte-bb734v ul:where(.svelte-bb734v),\n  .technical-identifiers.svelte-bb734v ul:where(.svelte-bb734v) {margin:4px 0 0;padding-left:18px;overflow-wrap:anywhere;font-size:var(--text-sm);}.identifier-list.svelte-bb734v {display:grid;gap:7px;margin:8px 0 0;}.identifier-list.svelte-bb734v dd:where(.svelte-bb734v) {display:grid;justify-items:start;gap:4px;}code.svelte-bb734v {color:var(--secondary);overflow-wrap:anywhere;user-select:all;}.technical-identifiers.svelte-bb734v code:where(.svelte-bb734v) {display:block;}p.svelte-bb734v {margin:8px 0 0;}\n  @container highwater (max-width: 520px) {.essential-metrics.svelte-bb734v,\n    .detail-rows.svelte-bb734v {grid-template-columns:1fr;}\n  }"
};
function Pf(e, t) {
	Ve(t, !0), li(e, Nf);
	let n = X(t, "sections", 23, Hi), r = X(t, "onInspectCall", 3, () => {}), i = X(t, "callIndex", 3, null), a = X(t, "pinnedCallIndex", 3, null), o = X(t, "onSelectItem", 3, () => {}), s = X(t, "onRevealInRiver", 3, () => {}), c = X(t, "sessions", 19, () => []), l = /* @__PURE__ */ N(() => t.item ? Md(t.item) : null), u = /* @__PURE__ */ N(() => H(l) ? c().find((e) => e.id === H(l)) : void 0), d = /* @__PURE__ */ N(() => t.item ? t.indexed.compactionBySourceId.get(t.item.id) ?? [] : []), f = /* @__PURE__ */ N(() => t.item ? t.indexed.compactionBySummaryId.get(t.item.id) ?? null : null), p = /* @__PURE__ */ N(() => H(f) ? Vd(H(f), t.indexed.analysis.session.source, t.indexed.callByIndex) : null), h = /* @__PURE__ */ N(() => t.item ? t.indexed.compactionsByRetainedId.get(t.item.id) ?? [] : []), g = /* @__PURE__ */ N(() => t.item ? (t.indexed.incomingLineage.get(t.item.id) ?? []).map((e) => e.from) : []), _ = /* @__PURE__ */ N(() => t.item ? (t.indexed.outgoingLineage.get(t.item.id) ?? []).map((e) => e.to) : []), v = /* @__PURE__ */ N(() => t.item ? t.indexed.versionByItemId.get(t.item.id) ?? null : null), y = /* @__PURE__ */ N(() => t.item && H(v) ? hc(t.indexed.itemById, t.indexed.versionByItemId, t.item.id) : []), b = /* @__PURE__ */ N(() => t.indexed.analysis.modelCalls.length), x = /* @__PURE__ */ N(() => i() === null ? null : t.indexed.callByIndex.get(i()) ?? null), S = /* @__PURE__ */ N(() => a() === null ? null : t.indexed.callByIndex.get(a()) ?? null), ee = /* @__PURE__ */ N(() => t.item !== null && H(S) !== null && !H(S).contextItemIds.includes(t.item.id)), C = /* @__PURE__ */ N(() => t.item?.presence.length ? t.indexed.callByIndex.get(t.item.presence[0].startCall) ?? null : null), te = /* @__PURE__ */ N(() => t.item && t.item.presence.length > 0 ? t.indexed.callByIndex.get(t.item.lastModelCall) ?? null : null), w = /* @__PURE__ */ N(() => H(x) && H(x).contextItemIds.includes(t.item?.id ?? "") ? H(x) : a() === null ? H(te) : null), T = /* @__PURE__ */ N(() => H(x) === null && H(w) !== null), E = /* @__PURE__ */ N(() => t.item && H(w) ? t.item.tokenEstimates.find((e) => e.profileId === H(w)?.tokenizationProfileId) : void 0), D = /* @__PURE__ */ N(() => H(E) ? t.indexed.analysis.tokenAnalysis.profiles.find((e) => e.id === H(E).profileId) ?? null : null), O = /* @__PURE__ */ N(() => n().expandedPreview);
	function ne() {
		I(O, !H(O)), n().expandedPreview = H(O);
	}
	let re = /* @__PURE__ */ N(() => t.item?.preview !== null && t.item?.preview !== void 0 && (t.item.preview.expandedText !== t.item.preview.text || t.item.preview.expandedTruncated)), ie = /* @__PURE__ */ N(() => [...new Set(t.item?.tokenEstimates.flatMap((e) => e.noteCodes) ?? [])]);
	function ae(e) {
		return Ao(t.indexed.itemById.get(e), e);
	}
	function oe(e) {
		let n = t.indexed.callByIndex.get(e.firstModelCall)?.tokenizationProfileId ?? "";
		return t.indexed.itemEstimateByProfile.get(e.id)?.get(n)?.tokens ?? null;
	}
	function se(e, t) {
		return `Version ${t} · ${ce(e)} · ${Z(oe(e))} tokens`;
	}
	function ce(e) {
		return e.presence.map((e) => e.startCall === e.endCall ? `call ${e.startCall}` : `calls ${e.startCall}–${e.endCall}`).join(", ");
	}
	function le() {
		return !t.item || t.item.presence.length === 0 ? "No model-call presence" : t.item.presence.map((e) => e.startCall === e.endCall ? `call ${e.startCall}` : `calls ${e.startCall}–${e.endCall}`).join(", ");
	}
	var ue = Mf(), de = L(ue), fe = (e) => {
		var i = Af(), c = R(i), x = L(c), te = L(x), oe = z(te), ce = z(B(te, 2), !0);
		j(x), j(c);
		var ue = B(c, 2), de = (e) => {
			G(e, Hd());
		}, fe = (e) => {
			var t = Ud(), n = z(t);
			V(() => K(n, `This item is not present at pinned call ${H(S).index ?? ""}. Its inspector remains selected.`)), G(e, t);
		};
		q(ue, (e) => {
			t.item.presence.length === 0 ? e(de) : H(ee) && H(S) && e(fe, 1);
		});
		var pe = B(ue, 2), me = (e) => {
			var n = Wd();
			U("click", n, () => s()(t.item.id)), G(e, n);
		};
		q(pe, (e) => {
			t.item.presence.length > 0 && e(me);
		});
		var he = B(pe, 2), ge = (e) => {
			var t = Gd(), n = z(t);
			V(() => K(n, `Inspect first included call · ${H(C).index ?? ""}`)), U("click", t, () => r()(H(C).index)), G(e, t);
		};
		q(he, (e) => {
			H(C) && H(C).index !== a() && e(ge);
		});
		var _e = B(he, 2), ve = (e) => {
			var t = Ud(), n = z(t);
			V((e) => K(n, `Estimate: ${H(E).coverage ?? ""} · ${e ?? ""}`), [() => ma(H(E).method)]), G(e, t);
		};
		q(_e, (e) => {
			H(E) && (H(E).coverage !== "complete" || H(E).method === "characterHeuristic") && e(ve);
		});
		var k = B(_e, 2), ye = B(L(k), 2), A = L(ye), be = (e) => {
			var n = qd(), r = R(n), i = z(r, !0), a = B(r, 2), o = (e) => {
				G(e, Kd());
			};
			q(a, (e) => {
				t.item.preview.expandedTruncated && e(o);
			}), V(() => K(i, t.item.preview.expandedText)), G(e, n);
		}, xe = (e) => {
			var n = Br(), r = R(n), i = (e) => {
				var n = Jd(), r = B(L(n));
				j(n), V(() => K(r, ` ${t.item.preview.text ?? ""}`)), G(e, n);
			}, a = (e) => {
				G(e, Yd());
			};
			q(r, (e) => {
				t.item.preview?.text ? e(i) : e(a, -1);
			}), G(e, n);
		};
		q(A, (e) => {
			H(re) && H(O) && t.item.preview ? e(be) : e(xe, -1);
		});
		var Ce = B(A, 2), we = (e) => {
			var t = Xd(), n = z(t, !0);
			V(() => {
				Y(t, "aria-expanded", H(O)), K(n, H(O) ? "Show less" : "Show more");
			}), U("click", t, ne), G(e, t);
		};
		q(Ce, (e) => {
			H(re) && e(we);
		}), j(ye), j(k), ui(k, (e, t) => Ui?.(e, t), () => ({
			state: n(),
			key: "preview"
		}));
		var Te = B(k, 2), Ee = L(Te), De = B(L(Ee), 2), Oe = L(De), ke = (e) => {
			G(e, zr("No model-call presence"));
		}, Ae = (e) => {
			var n = zr();
			V((e, t, r, i) => K(n, `${e ?? ""} · present in ${t ?? ""} of ${r ?? ""} calls (${i ?? ""} ranges)`), [
				() => le(),
				() => Z(tc(t.item)),
				() => Z(H(b)),
				() => Z(t.item.presence.length)
			]), G(e, n);
		};
		q(Oe, (e) => {
			t.item.presence.length === 0 ? e(ke) : e(Ae, -1);
		}), j(De), j(Ee);
		var je = B(Ee, 2), Me = L(je), Ne = L(Me), Pe = (e) => {
			var t = zr();
			V(() => K(t, a() === null ? H(T) ? "Tokens at last included call" : "Tokens at call" : "Tokens at pinned call")), G(e, t);
		}, Fe = (e) => {
			G(e, zr("Tokens at pinned call · unavailable"));
		}, Ie = (e) => {
			G(e, zr("Tokens at last included call · unavailable"));
		};
		q(Ne, (e) => {
			H(w) && H(E) ? e(Pe) : a() === null ? e(Ie, -1) : e(Fe, 1);
		}), j(Me);
		var M = B(Me, 2), Le = L(M), Re = B(Le), ze = (e) => {
			G(e, Zd());
		};
		q(Re, (e) => {
			H(T) && e(ze);
		}), j(M), j(je);
		var Be = B(je, 2), Ve = L(Be), He = B(L(Ve));
		{
			let e = /* @__PURE__ */ N(() => `item-exposure-note-${t.item.id}`);
			_a(He, {
				get id() {
					return H(e);
				},
				label: "About whole-session exposure",
				children: (e, t) => {
					Se(), G(e, zr("The item's estimated tokens added up over every call it appears in, in estimated\n            token-turns. It shows how much context the item took up across the session; it is not\n            usage or cost."));
				},
				$$slots: { default: !0 }
			});
		}
		j(Ve);
		var Ue = B(Ve, 2), We = L(Ue), Ge = B(We), Ke = (e) => {
			var n = Qd(), r = z(n);
			V((e) => K(r, `Partial exposure · ${e ?? ""} calls covered`), [() => Ka(t.item.tokenTurnsCoverage.coveredCalls, t.item.tokenTurnsCoverage.totalCalls)]), G(e, n);
		};
		q(Ge, (e) => {
			t.item.tokenTurnsCoverage.coveredCalls < t.item.tokenTurnsCoverage.totalCalls && e(Ke);
		});
		var qe = B(Ge, 2), Je = (e) => {
			G(e, $d());
		}, Ye = /* @__PURE__ */ N(() => t.item.tokenEstimates.some((e) => e.coverage !== "complete" || e.method === "characterHeuristic"));
		q(qe, (e) => {
			H(Ye) && e(Je);
		}), j(Ue), j(Be), j(Te);
		var Xe = B(Te, 2), Ze = (e) => {
			var t = tf(), n = B(R(t), 2), r = L(n), i = (e) => {
				var t = ef(), n = B(R(t)), r = z(n, !0);
				V((e) => {
					Y(n, "href", e), K(r, H(u).displayName);
				}, [() => Nd(H(u).id)]), G(e, t);
			}, a = (e) => {
				G(e, zr("Started a child session that is not listed."));
			};
			q(r, (e) => {
				H(u) ? e(i) : e(a, -1);
			}), j(n), G(e, t);
		};
		q(Xe, (e) => {
			H(l) && e(Ze);
		});
		var Qe = B(Xe, 2), $e = (e) => {
			var t = of(), n = B(R(t), 2), i = (e) => {
				var t = nf(), n = z(t);
				V((e) => K(n, `Removed at the compaction before call ${e ?? ""}.`), [() => H(d).map((e) => e.beforeModelCall).join(", ")]), G(e, t);
			};
			q(n, (e) => {
				H(d).length > 0 && e(i);
			});
			var a = B(n, 2), o = (e) => {
				var t = nf(), n = z(t);
				V((e) => K(n, `Retained unchanged through compaction before call ${e ?? ""}.`), [() => H(h).map((e) => e.beforeModelCall).join(", ")]), G(e, t);
			};
			q(a, (e) => {
				H(h).length > 0 && e(o);
			});
			var s = B(a, 2), c = (e) => {
				var t = af(), n = R(t), i = z(n), a = B(n, 2), o = (e) => {
					var t = nf(), n = z(t, !0);
					V(() => K(n, H(p).rule)), G(e, t);
				};
				q(a, (e) => {
					H(p).rule && e(o);
				});
				var s = B(a, 2);
				J(s, 21, () => H(p).rows, (e) => e.label, (e, t) => {
					var n = rf(), r = L(n), i = z(r, !0), a = z(B(r, 2), !0);
					j(n), V(() => {
						K(i, H(t).label), K(a, H(t).value);
					}), G(e, n);
				}), j(s);
				var c = B(s, 2), l = (e) => {
					let t = /* @__PURE__ */ N(() => H(p).summaryCall);
					var n = Gd(), i = z(n);
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
		q(Qe, (e) => {
			(H(d).length > 0 || H(h).length > 0 || H(f)) && e($e);
		});
		var et = B(Qe, 2), tt = (e) => {
			var n = lf(), r = B(R(n), 2);
			J(r, 23, () => H(y), (e) => e.id, (e, n, r) => {
				var i = cf(), a = L(i), s = (e) => {
					var t = sf(), i = z(t);
					V((e) => K(i, `${e ?? ""} · this version`), [() => se(H(n), H(r) + 1)]), G(e, t);
				}, c = (e) => {
					var t = Gd(), i = z(t, !0);
					V((e) => K(i, e), [() => se(H(n), H(r) + 1)]), U("click", t, () => o()(H(n).id)), G(e, t);
				};
				q(a, (e) => {
					H(n).id === t.item.id ? e(s) : e(c, -1);
				});
				var l = B(a, 2), u = (e) => {
					var r = Qd(), i = z(r);
					V((e) => K(i, `Call ${H(n).firstModelCall ?? ""}: ${e ?? ""}`), [() => _c(t.indexed.analysis.contextItems, t.indexed.versionByItemId, H(n).firstModelCall)]), G(e, r);
				};
				q(l, (e) => {
					H(r) > 0 && t.item.kind === "system" && e(u);
				}), j(i), G(e, i);
			}), j(r), G(e, n);
		};
		q(et, (e) => {
			H(v) && e(tt);
		});
		var nt = B(et, 2), rt = (e) => {
			var t = pf(), n = B(L(t), 2), r = (e) => {
				var t = df();
				J(B(L(t), 2), 17, () => H(g), $r, (e, t) => {
					var n = uf(), r = z(n, !0);
					V((e, t) => {
						Y(n, "aria-label", e), K(r, t);
					}, [() => `Select predecessor ${ae(H(t))}`, () => ae(H(t))]), U("click", n, () => o()(H(t))), G(e, n);
				}), j(t), G(e, t);
			};
			q(n, (e) => {
				H(g).length > 0 && e(r);
			});
			var i = B(n, 2), a = (e) => {
				var t = ff();
				J(B(L(t), 2), 17, () => H(_), $r, (e, t) => {
					var n = uf(), r = z(n, !0);
					V((e, t) => {
						Y(n, "aria-label", e), K(r, t);
					}, [() => `Select successor ${ae(H(t))}`, () => ae(H(t))]), U("click", n, () => o()(H(t))), G(e, n);
				}), j(t), G(e, t);
			};
			q(i, (e) => {
				H(_).length > 0 && e(a);
			}), j(t), G(e, t);
		};
		q(nt, (e) => {
			(H(g).length > 0 || H(_).length > 0) && e(rt);
		});
		var it = B(nt, 2), at = B(L(it), 2), ot = L(at), st = B(L(ot), 2), ct = L(st), lt = (e) => {
			var t = hf(), n = R(t), r = B(n), i = (e) => {
				var t = mf(), n = z(t, !0);
				V((e) => K(n, e), [() => fa(H(D))]), G(e, t);
			}, a = /* @__PURE__ */ N(() => fa(H(D)));
			q(r, (e) => {
				H(a) && e(i);
			}), V((e) => K(n, `${e ?? ""} · call ${H(w).index ?? ""} `), [() => H(D) ? `${H(D).provider} / ${H(D).model} · ${ma(H(E).method)}` : ma(H(E).method)]), G(e, t);
		}, ut = (e) => {
			var t = zr();
			V(() => K(t, `No applicable estimate at pinned call ${a() ?? ""}`)), G(e, t);
		}, dt = (e) => {
			G(e, zr("No applicable model-call estimate"));
		};
		q(ct, (e) => {
			H(w) && H(E) ? e(lt) : a() === null ? e(dt, -1) : e(ut, 1);
		});
		var ft = B(ct);
		j(st), j(ot);
		var pt = B(ot, 2), mt = z(B(L(pt), 2));
		j(pt);
		var ht = B(pt, 2), gt = z(B(L(ht), 2), !0);
		j(ht);
		var _t = B(ht, 2), vt = (e) => {
			var t = gf(), n = R(t), r = z(B(L(n), 2), !0);
			j(n);
			var i = B(n, 2), a = z(B(L(i), 2), !0);
			j(i), V(() => {
				K(r, H(E).method), K(a, H(E).coverage);
			}), G(e, t);
		};
		q(_t, (e) => {
			H(E) && e(vt);
		}), j(at);
		var yt = B(at, 4), bt = (e) => {
			G(e, _f());
		}, xt = (e) => {
			var n = yf();
			J(n, 21, () => t.item.tokenEstimates, (e) => e.profileId, (e, t) => {
				var n = vf(), r = L(n), i = z(r, !0), a = B(r);
				j(n), V((e) => {
					K(i, H(t).profileId), K(a, ` · ${e ?? ""} tokens ·
              ${H(t).method ?? ""} · ${H(t).coverage ?? ""}`);
				}, [() => Z(H(t).tokens)]), G(e, n);
			}), j(n), G(e, n);
		};
		q(yt, (e) => {
			t.item.tokenEstimates.length === 0 ? e(bt) : e(xt, -1);
		});
		var St = B(yt, 2), Ct = (e) => {
			var t = Cf(), n = B(R(t), 2);
			J(n, 20, () => H(ie), (e) => e, (e, t) => {
				let n = /* @__PURE__ */ N(() => Ro(t));
				var r = Sf(), i = L(r), a = (e) => {
					var t = bf(), r = R(t), i = z(r, !0), a = B(r);
					V(() => {
						K(i, H(n).title), K(a, ` — ${H(n).impact ?? ""}`);
					}), G(e, t);
				}, o = (e) => {
					var t = xf();
					Se(), G(e, t);
				};
				q(i, (e) => {
					H(n) ? e(a) : e(o, -1);
				}), j(r), G(e, r);
			}), j(n), G(e, t);
		};
		q(St, (e) => {
			H(ie).length > 0 && e(Ct);
		}), j(it), ui(it, (e, t) => Ui?.(e, t), () => ({
			state: n(),
			key: "diagnostics"
		}));
		var wt = B(it, 2), Tt = B(L(wt), 2), Et = L(Tt), Dt = (e) => {
			var t = wf(), n = B(L(t), 2), r = L(n), i = z(r, !0);
			Ya(B(r, 2), {
				get value() {
					return H(E).profileId;
				},
				label: "estimate profile ID"
			}), j(n), j(t), V(() => K(i, H(E).profileId)), G(e, t);
		};
		q(Et, (e) => {
			H(E) && e(Dt);
		});
		var P = B(Et, 2), Ot = B(L(P), 2), kt = L(Ot), At = z(kt, !0);
		Ya(B(kt), {
			get value() {
				return t.item.id;
			},
			label: "context ID"
		}), j(Ot), j(P);
		var jt = B(P, 2), Mt = (e) => {
			var n = Tf(), r = B(L(n), 2), i = L(r), a = z(i, !0);
			Ya(B(i, 2), {
				get value() {
					return t.item.sourceRecordId;
				},
				label: "source record ID"
			}), j(r), j(n), V(() => K(a, t.item.sourceRecordId)), G(e, n);
		};
		q(jt, (e) => {
			t.item.sourceRecordId && e(Mt);
		});
		var Nt = B(jt, 2), Pt = (e) => {
			var n = Ef(), r = B(L(n), 2), i = L(r), a = z(i, !0);
			Ya(B(i, 2), {
				get value() {
					return t.item.sourceToolCallId;
				},
				label: "source tool-call ID"
			}), j(r), j(n), V(() => K(a, t.item.sourceToolCallId)), G(e, n);
		};
		q(Nt, (e) => {
			t.item.sourceToolCallId && e(Pt);
		}), j(Tt);
		var Ft = B(Tt, 2), It = (e) => {
			var n = Df(), r = B(R(n), 2);
			J(r, 21, () => Object.entries(t.item.metadata), $r, (e, t) => {
				var n = /* @__PURE__ */ N(() => m(H(t), 2));
				let r = () => H(n)[0], i = () => H(n)[1];
				var a = vf(), o = L(a), s = z(o, !0), c = B(o);
				j(a), V(() => {
					K(s, r()), K(c, `: ${i() ?? ""}`);
				}), G(e, a);
			}), j(r), G(e, n);
		}, Lt = /* @__PURE__ */ N(() => Object.keys(t.item.metadata).length > 0);
		q(Ft, (e) => {
			H(Lt) && e(It);
		});
		var Rt = B(Ft, 2), zt = (e) => {
			var t = kf(), n = B(R(t), 2);
			J(n, 20, () => H(ie), (e) => e, (e, t) => {
				var n = Of(), r = z(L(n), !0);
				j(n), V(() => K(r, t)), G(e, n);
			}), j(n), G(e, t);
		};
		q(Rt, (e) => {
			H(ie).length > 0 && e(zt);
		}), j(wt), ui(wt, (e, t) => Ui?.(e, t), () => ({
			state: n(),
			key: "identifiers"
		})), V((e, n, r, i, a, o) => {
			K(oe, `${e ?? ""}${H(v) ? ` · version ${H(v).number} of ${H(v).count}` : ""}`), K(ce, n), K(Le, `${r ?? ""} `), K(We, `${i ?? ""} `), K(ft, ` · ${H(E)?.coverage ?? "unavailable" ?? ""}`), K(mt, `${a ?? ""}
            calls covered`), K(gt, o), K(At, t.item.id);
		}, [
			() => Fo(t.item.kind),
			() => Ao(t.item),
			() => H(E) ? `${Z(H(E).tokens)} · call ${H(w)?.index}` : "Unavailable",
			() => Ga(t.item.tokenTurns, "calculatedTokens"),
			() => Ka(t.item.tokenTurnsCoverage.coveredCalls, t.item.tokenTurnsCoverage.totalCalls),
			() => Ua(t.item.displayWeight, "serializedBytes")
		]), G(e, i);
	}, pe = (e) => {
		G(e, jf());
	};
	q(de, (e) => {
		t.item ? e(fe) : e(pe, -1);
	}), j(ue), G(e, ue), He();
}
kr(["click"]);
//#endregion
//#region src/lib/components/Inspector.svelte
var Ff = /* @__PURE__ */ W("<section class=\"panel inspector-empty-prompt svelte-gu3dqx\"><div class=\"panel-head svelte-gu3dqx\"><div class=\"svelte-gu3dqx\"><h2 class=\"svelte-gu3dqx\">Inspect workspace details</h2></div></div> <p class=\"muted svelte-gu3dqx\">Select a call to inspect usage.</p> <p class=\"muted svelte-gu3dqx\">Select an item to inspect its context.</p></section>"), If = /* @__PURE__ */ W("<section class=\"panel svelte-gu3dqx\"><div class=\"panel-head svelte-gu3dqx\"><div class=\"svelte-gu3dqx\"><h2 class=\"svelte-gu3dqx\">Model call</h2></div> <button type=\"button\" class=\"panel-close svelte-gu3dqx\" aria-label=\"Close pinned call\">×</button></div> <!></section>"), Lf = /* @__PURE__ */ W("<section class=\"panel svelte-gu3dqx\"><div class=\"panel-head svelte-gu3dqx\"><div class=\"svelte-gu3dqx\"><h2 class=\"svelte-gu3dqx\">Context item</h2> <p class=\"svelte-gu3dqx\">Selected item</p></div> <button type=\"button\" class=\"panel-close svelte-gu3dqx\" aria-label=\"Close context item\">×</button></div> <!></section>"), Rf = /* @__PURE__ */ W("<p class=\"inspector-secondary-prompt muted svelte-gu3dqx\"> </p>"), zf = /* @__PURE__ */ W("<p class=\"inspector-secondary-prompt muted svelte-gu3dqx\">Select an item to inspect its context.</p>"), Bf = /* @__PURE__ */ W("<!> <!> <!> <!>", 1), Vf = {
	hash: "svelte-gu3dqx",
	code: ".panel.svelte-gu3dqx {background:var(--surface);border:0;border-radius:var(--radius);padding:var(--panel-padding);margin-top:0;min-width:0;}.panel-head.svelte-gu3dqx {display:flex;justify-content:space-between;gap:16px;align-items:start;margin-bottom:10px;min-width:0;}.panel-head.svelte-gu3dqx > :where(.svelte-gu3dqx) {min-width:0;}.panel-head.svelte-gu3dqx p:where(.svelte-gu3dqx) {color:var(--secondary);margin:4px 0 0;font-size:var(--text-sm);}h2.svelte-gu3dqx {font-size:var(--text-lg);margin:0;}.inspector-empty-prompt.svelte-gu3dqx {display:flex;flex-wrap:wrap;gap:4px 0;padding:0;background:transparent;}.inspector-empty-prompt.svelte-gu3dqx .panel-head:where(.svelte-gu3dqx) {display:none;}.inspector-empty-prompt.svelte-gu3dqx p:where(.svelte-gu3dqx) {margin:0;color:var(--secondary);font-size:var(--text-sm);}.inspector-empty-prompt.svelte-gu3dqx p:where(.svelte-gu3dqx) + p:where(.svelte-gu3dqx)::before {content:'·';margin:0 10px;}.panel-close.svelte-gu3dqx {flex-shrink:0;align-self:flex-start;font-size:18px;padding:1px 7px;}.inspector-secondary-prompt.svelte-gu3dqx {margin:0;padding:9px 11px;border:1px solid var(--separator);border-radius:var(--radius);background:var(--plot);font-size:var(--text-sm);}.muted.svelte-gu3dqx {color:var(--secondary);}"
};
function Hf(e, t) {
	li(e, Vf);
	let n = X(t, "sessions", 19, () => []);
	var r = Br(), i = R(r), a = (e) => {
		G(e, Ff());
	}, o = (e) => {
		var r = Bf(), i = R(r), a = (e) => {
			var n = If(), r = L(n), i = B(L(r), 2);
			j(r), jd(B(r, 2), {
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
			}), j(n), U("click", i, function(...e) {
				t.onClosePinnedCall?.apply(this, e);
			}), G(e, n);
		};
		q(i, (e) => {
			t.pinnedCall && e(a);
		});
		var o = B(i, 2), s = (e) => {
			var r = Lf(), i = L(r), a = B(L(i), 2);
			j(i);
			var o = B(i, 2);
			{
				let e = /* @__PURE__ */ N(() => t.pinnedCallIndex ?? t.hoveredCallIndex);
				Pf(o, {
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
			j(r), U("click", a, function(...e) {
				t.onCloseItem?.apply(this, e);
			}), G(e, r);
		};
		q(o, (e) => {
			t.selectedItem && e(s);
		});
		var c = B(o, 2), l = (e) => {
			var n = Rf(), r = z(n, !0);
			V(() => K(r, t.hasCalls ? "Select a call to inspect usage." : "No call usage is available in this session.")), G(e, n);
		};
		q(c, (e) => {
			t.pinnedCall || e(l);
		});
		var u = B(c, 2), d = (e) => {
			G(e, zf());
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
var Uf = /* @__PURE__ */ W("<p class=\"content-preview svelte-c2davt\"> </p>"), Wf = /* @__PURE__ */ W("<p class=\"preview-note svelte-c2davt\">Preview truncated</p>"), Gf = /* @__PURE__ */ W("<p class=\"lineage svelte-c2davt\"> </p>"), Kf = /* @__PURE__ */ W("<section class=\"item-hover-card svelte-c2davt\"><header class=\"svelte-c2davt\"><span class=\"svelte-c2davt\"> </span><strong class=\"svelte-c2davt\"> </strong></header> <!> <!> <dl class=\"svelte-c2davt\"><div class=\"svelte-c2davt\"><dt class=\"svelte-c2davt\">Present</dt> <dd class=\"svelte-c2davt\"> </dd></div> <div class=\"svelte-c2davt\"><dt class=\"svelte-c2davt\">Lifetime</dt> <dd class=\"svelte-c2davt\"> </dd></div> <div class=\"svelte-c2davt\"><dt class=\"svelte-c2davt\">Serialized size</dt> <dd class=\"svelte-c2davt\"> </dd></div> <div class=\"svelte-c2davt\"><dt class=\"svelte-c2davt\">Calculated token-turns</dt> <dd class=\"svelte-c2davt\"> </dd></div> <div class=\"svelte-c2davt\"><dt class=\"svelte-c2davt\">Token coverage</dt> <dd class=\"svelte-c2davt\"> </dd></div></dl> <!></section>"), qf = {
	hash: "svelte-c2davt",
	code: ".item-hover-card.svelte-c2davt {min-width:300px;max-width:360px;padding:10px;color:var(--text);background:var(--surface);border:1px solid var(--control-border);border-radius:var(--radius);box-shadow:0 10px 30px var(--shadow);}header.svelte-c2davt {display:flex;flex-direction:column;gap:4px;margin-bottom:10px;}header.svelte-c2davt span:where(.svelte-c2davt) {width:fit-content;color:var(--text);border:1px solid var(--separator);border-radius:999px;padding:2px 7px;font-size:var(--text-sm);}header.svelte-c2davt strong:where(.svelte-c2davt) {color:var(--text-strong);overflow-wrap:anywhere;}dl.svelte-c2davt {display:grid;grid-template-columns:repeat(2, minmax(120px, 1fr));gap:7px;margin:0;}dl.svelte-c2davt div:where(.svelte-c2davt) {background:var(--plot);border-radius:var(--control-radius);padding:6px 8px;}dt.svelte-c2davt {color:var(--secondary);font-size:var(--text-sm);}dd.svelte-c2davt {margin:1px 0 0;color:var(--text-strong);}p.svelte-c2davt {margin:9px 0 0;}.content-preview.svelte-c2davt {margin:0 0 9px;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--text);}.preview-note.svelte-c2davt {color:var(--secondary);font-size:var(--text-sm);}.lineage.svelte-c2davt {border-left:3px dashed var(--compaction);padding-left:8px;color:var(--compaction-text);}"
};
function Jf(e, t) {
	Ve(t, !0), li(e, qf);
	let n = /* @__PURE__ */ N(() => t.item ? t.indexed.compactionBySourceId.get(t.item.id) ?? [] : []), r = /* @__PURE__ */ N(() => t.item ? t.indexed.compactionBySummaryId.get(t.item.id) ?? null : null), i = /* @__PURE__ */ N(() => H(n).length > 0 ? `Removed at the compaction before call ${H(n).map((e) => e.beforeModelCall).join(", ")}` : H(r) ? `Replaces ${Q(H(r).sourceItemIds.length)} items removed at the compaction before call ${H(r).beforeModelCall}` : null);
	var a = Br(), o = R(a), s = (e) => {
		var n = Kf(), r = L(n), a = L(r), o = z(a, !0), s = z(B(a), !0);
		j(r);
		var c = B(r, 2), l = (e) => {
			var n = Uf(), r = z(n, !0);
			V(() => K(r, t.item.preview.text)), G(e, n);
		};
		q(c, (e) => {
			t.item.preview?.text && e(l);
		});
		var u = B(c, 2), d = (e) => {
			G(e, Wf());
		};
		q(u, (e) => {
			t.item.preview?.truncated && e(d);
		});
		var f = B(u, 2), p = L(f), m = z(B(L(p), 2));
		j(p);
		var h = B(p, 2), g = z(B(L(h), 2));
		j(h);
		var _ = B(h, 2), v = z(B(L(_), 2), !0);
		j(_);
		var y = B(_, 2), b = z(B(L(y), 2), !0);
		j(y);
		var x = B(y, 2), S = z(B(L(x), 2), !0);
		j(x), j(f);
		var ee = B(f, 2), C = (e) => {
			var t = Gf(), n = z(t, !0);
			V(() => K(n, H(i))), G(e, t);
		};
		q(ee, (e) => {
			H(i) && e(C);
		}), j(n), V((e, r, i, a, c, l, u) => {
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
	}), G(e, a), He();
}
//#endregion
//#region src/lib/components/SessionSummary.svelte
var Yf = /* @__PURE__ */ W("<p class=\"compact-metrics svelte-m8zdew\"><span class=\"svelte-m8zdew\"> </span> <span class=\"svelte-m8zdew\"> </span> <span class=\"svelte-m8zdew\"> </span> <span class=\"svelte-m8zdew\"> </span></p>"), Xf = /* @__PURE__ */ W(" <span class=\"price-source svelte-m8zdew\"> <!>.</span>", 1), Zf = /* @__PURE__ */ W("<small class=\"metric-note svelte-m8zdew\"> </small>"), Qf = /* @__PURE__ */ W("<span class=\"svelte-m8zdew\"> <!></span> <b class=\"svelte-m8zdew\"> </b> <small class=\"metric-note svelte-m8zdew\"> </small> <!>", 1), $f = /* @__PURE__ */ W("<span class=\"svelte-m8zdew\">Cost</span> <b title=\"No call in this session has a known or estimated cost.\" class=\"svelte-m8zdew\">Unknown</b> <!>", 1), ep = /* @__PURE__ */ W("<div class=\"primary-metrics svelte-m8zdew\"><div class=\"svelte-m8zdew\"><span class=\"svelte-m8zdew\">Model calls</span><b class=\"svelte-m8zdew\"> </b></div> <div class=\"svelte-m8zdew\"><span class=\"svelte-m8zdew\">Context items</span><b class=\"svelte-m8zdew\"> </b></div> <div class=\"svelte-m8zdew\"><span class=\"svelte-m8zdew\">Peak calculated context</span> <b class=\"svelte-m8zdew\"> </b></div> <div class=\"cost-metric svelte-m8zdew\"><!></div></div>"), tp = /* @__PURE__ */ W("<li class=\"svelte-m8zdew\"> </li>"), np = /* @__PURE__ */ W("<ul class=\"estimate-reasons svelte-m8zdew\"></ul>"), rp = /* @__PURE__ */ W("<p class=\"estimate-lead svelte-m8zdew\"> </p> <!>", 1), ip = /* @__PURE__ */ W("Not recorded<!>", 1), ap = /* @__PURE__ */ W("<div><dt class=\"svelte-m8zdew\">Billed cost (USD)</dt> <dd class=\"svelte-m8zdew\"> </dd></div>"), op = /* @__PURE__ */ W("<div><dt class=\"svelte-m8zdew\"> </dt> <dd class=\"svelte-m8zdew\"> <small class=\"metric-note svelte-m8zdew\"> </small></dd></div>"), sp = /* @__PURE__ */ W("<div><dt class=\"svelte-m8zdew\">Title</dt> <dd class=\"svelte-m8zdew\"> </dd></div>"), cp = /* @__PURE__ */ W("<div><dt class=\"svelte-m8zdew\"> </dt> <dd class=\"svelte-m8zdew\"> </dd></div>"), lp = /* @__PURE__ */ W("<div><dt class=\"svelte-m8zdew\">Cache-write limits</dt> <dd class=\"svelte-m8zdew\">Anthropic writes are aggregated across TTLs. Copilot Responses uses separately\n                recorded writes; older direct OpenAI adapter zeros do not establish measured zero\n                writes. See each call's audited policy.</dd></div>"), up = /* @__PURE__ */ W("<div><dt class=\"svelte-m8zdew\">Fallback code</dt> <dd class=\"svelte-m8zdew\"><code class=\"svelte-m8zdew\"> </code></dd></div>"), dp = /* @__PURE__ */ W("<div><dt class=\"svelte-m8zdew\">Reconciliation (complete / comparable calls)</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <div><dt class=\"svelte-m8zdew\">Residual median / maximum</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <div><dt class=\"svelte-m8zdew\">Negative residual calls</dt> <dd class=\"svelte-m8zdew\"> </dd></div>", 1), fp = /* @__PURE__ */ W("<div><dt class=\"svelte-m8zdew\">Calls where the estimate exceeds reported input</dt> <dd class=\"svelte-m8zdew\"> </dd></div>"), pp = /* @__PURE__ */ W("<li> <!></li>"), mp = /* @__PURE__ */ W("<h4 class=\"svelte-m8zdew\">Tokenization profiles</h4> <ul class=\"profiles svelte-m8zdew\"></ul>", 1), hp = /* @__PURE__ */ W("<p class=\"svelte-m8zdew\">Child session of <a class=\"svelte-m8zdew\"> </a></p>"), gp = /* @__PURE__ */ W("<li><a class=\"svelte-m8zdew\"> </a></li>"), _p = /* @__PURE__ */ W("<details><summary class=\"disclosure svelte-m8zdew\"> </summary> <ul class=\"svelte-m8zdew\"></ul></details>"), vp = /* @__PURE__ */ W("<div class=\"session-relations svelte-m8zdew\"><!> <!></div>"), yp = /* @__PURE__ */ W("<section class=\"summary svelte-m8zdew\" aria-label=\"Session summary\"><!> <div class=\"session-status svelte-m8zdew\"><div> <!></div> <details class=\"session-details svelte-m8zdew\" id=\"session-details\"><summary class=\"disclosure svelte-m8zdew\" id=\"session-details-summary\">Session details</summary> <div class=\"detail-columns svelte-m8zdew\"><section><h3 class=\"svelte-m8zdew\">Usage breakdown</h3> <dl class=\"svelte-m8zdew\"><div><dt class=\"svelte-m8zdew\">Input tokens, all calls<!></dt> <dd class=\"svelte-m8zdew\"> <!></dd></div> <div><dt class=\"svelte-m8zdew\">Output tokens, all calls</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <div><dt class=\"svelte-m8zdew\">Reasoning tokens, all calls</dt> <dd class=\"svelte-m8zdew\"><!></dd></div> <div><dt class=\"svelte-m8zdew\">Cache-read share<!></dt> <dd class=\"svelte-m8zdew\"> </dd></div> <div><dt class=\"svelte-m8zdew\">Compactions</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <!> <div><dt class=\"svelte-m8zdew\"> <!></dt> <dd class=\"svelte-m8zdew\"><!> <!></dd></div> <!></dl></section> <section><h3 class=\"svelte-m8zdew\">Session metadata</h3> <dl class=\"svelte-m8zdew\"><div><dt class=\"svelte-m8zdew\">Provider</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <div><dt class=\"svelte-m8zdew\">Model</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <!> <div><dt class=\"svelte-m8zdew\">Working directory</dt> <dd class=\"svelte-m8zdew\"> </dd></div></dl></section></div> <details class=\"diagnostics svelte-m8zdew\"><summary class=\"disclosure svelte-m8zdew\">Diagnostics</summary> <dl class=\"svelte-m8zdew\"><div><dt class=\"svelte-m8zdew\">Reported usage completeness</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <div><dt class=\"svelte-m8zdew\">Usage policy coverage (complete / partial / missing / unsupported)</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <!> <!> <!> <div><dt class=\"svelte-m8zdew\">Estimate coverage (complete / partial / unavailable)</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <div><dt class=\"svelte-m8zdew\">Calculated token-turns</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <div><dt class=\"svelte-m8zdew\">Token-turn exposure coverage</dt> <dd class=\"svelte-m8zdew\"> </dd></div> <!> <div><dt class=\"svelte-m8zdew\">Tokenizer methods</dt> <dd class=\"svelte-m8zdew\"> </dd></div></dl> <!></details></details></div> <!></section>"), bp = {
	hash: "svelte-m8zdew",
	code: ".session-relations.svelte-m8zdew {margin-top:8px;color:var(--secondary);font-size:13px;}.session-relations.svelte-m8zdew p:where(.svelte-m8zdew) {margin:0 0 4px;}.session-relations.svelte-m8zdew ul:where(.svelte-m8zdew) {margin:6px 0 0;padding-left:20px;}.session-relations.svelte-m8zdew a:where(.svelte-m8zdew) {color:var(--accent);}.summary.svelte-m8zdew {margin-top:16px;min-width:0;}.compact-metrics.svelte-m8zdew {display:flex;flex-wrap:wrap;gap:2px 0;margin:0 0 4px;color:var(--text-strong);font-weight:600;font-variant-numeric:tabular-nums;}.compact-metrics.svelte-m8zdew span:where(.svelte-m8zdew):not(:last-child)::after {content:'·';margin:0 6px;color:var(--secondary);font-weight:400;}.primary-metrics.svelte-m8zdew {display:grid;grid-template-columns:repeat(4, minmax(0, 1fr));gap:9px;}.primary-metrics.svelte-m8zdew > div:where(.svelte-m8zdew) {min-width:0;padding:8px 12px 8px 0;}.primary-metrics.svelte-m8zdew span:where(.svelte-m8zdew) {display:block;color:var(--secondary);font-size:var(--text-sm);}.primary-metrics.svelte-m8zdew b:where(.svelte-m8zdew) {display:block;color:var(--text-strong);margin-top:2px;overflow-wrap:anywhere;font-variant-numeric:tabular-nums;}.metric-note.svelte-m8zdew {display:block;color:var(--secondary);font-size:var(--text-sm);font-weight:normal;}\n  /* Keep status and trigger inline; the full-width body clears both in either state. */.session-status.svelte-m8zdew {margin-top:8px;}.session-status.svelte-m8zdew::after {content:'';display:block;clear:both;}.estimate-level.svelte-m8zdew {float:left;display:inline-flex;align-items:center;margin:0 16px 0 0;color:var(--secondary);font-size:var(--text-md);}.estimate-level.good.svelte-m8zdew {color:var(--accent);}.estimate-level.partial.svelte-m8zdew {color:var(--warning);}.estimate-level.rough.svelte-m8zdew {color:var(--error);}.price-source.svelte-m8zdew {display:block;margin-top:6px;color:var(--secondary);}.estimate-lead.svelte-m8zdew {margin:0;}.estimate-reasons.svelte-m8zdew {margin:8px 0 0;padding-left:18px;}.estimate-reasons.svelte-m8zdew li:where(.svelte-m8zdew) + li:where(.svelte-m8zdew) {margin-top:4px;}.session-details.svelte-m8zdew {max-width:100%;color:var(--text);}.session-details.svelte-m8zdew > summary:where(.svelte-m8zdew) {float:left;}.profiles.svelte-m8zdew {color:var(--secondary);}summary.svelte-m8zdew {cursor:pointer;width:fit-content;}.detail-columns.svelte-m8zdew {clear:both;display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));align-items:start;gap:14px 24px;margin-top:10px;padding:12px;background:var(--surface);border:1px solid var(--separator);border-radius:var(--radius);}h3.svelte-m8zdew {margin:0 0 7px;color:var(--text);font-size:var(--text-md);}h4.svelte-m8zdew {margin:10px 0 4px;font-size:var(--text-sm);}dl.svelte-m8zdew {display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:6px 14px;margin:0;}dt.svelte-m8zdew {color:var(--secondary);font-size:var(--text-sm);}dd.svelte-m8zdew {margin:1px 0 0;overflow-wrap:anywhere;color:var(--text);}.diagnostics.svelte-m8zdew {margin-top:10px;padding:0 12px;}.diagnostics.svelte-m8zdew > dl:where(.svelte-m8zdew) {margin-top:8px;}.profiles.svelte-m8zdew {margin:0;padding-left:18px;font-size:var(--text-sm);overflow-wrap:anywhere;}code.svelte-m8zdew {overflow-wrap:anywhere;color:var(--secondary);}\n  /* Narrower views show the figures on one line instead (see SessionView), so the four\n     figures stay in one row whenever they are shown separately. */\n  @container highwater (max-width: 800px) {.detail-columns.svelte-m8zdew {grid-template-columns:1fr;}\n  }"
};
function xp(e, t) {
	Ve(t, !0), li(e, bp);
	let n = X(t, "sessionId", 3, null), r = X(t, "sessions", 19, () => []), i = X(t, "compact", 3, !1), a = /* @__PURE__ */ N(() => r().find((e) => e.id === n())), o = /* @__PURE__ */ N(() => H(a)?.parentReference ? r().find((e) => e.id === H(a).parentReference) : void 0), s = /* @__PURE__ */ N(() => n() ? Pd(r(), n()) : []), c = (e) => [
		e.displayName,
		e.subagentType,
		Kl(e.startedAt)
	].filter(Boolean).join(" · "), l = /* @__PURE__ */ N(() => t.indexed.analysis), u = /* @__PURE__ */ N(() => H(l).session), d = /* @__PURE__ */ N(() => H(l).tokenAnalysis), f = /* @__PURE__ */ N(() => H(l).economics), p = /* @__PURE__ */ N(() => [...new Set(H(l).modelCalls.map((e) => e.provider).filter(Boolean))].join(", ") || "Unknown"), m = /* @__PURE__ */ N(() => [...new Set(H(l).modelCalls.filter((e) => !e.usage.placeholder).map((e) => e.model).filter(Boolean))].join(", ") || "Unknown"), h = /* @__PURE__ */ N(() => H(d).itemEstimateCoverage), g = /* @__PURE__ */ N(() => Nl(t.indexed)), _ = /* @__PURE__ */ N(() => zl(H(f).costBasis, H(u).source)), v = /* @__PURE__ */ N(() => H(u).reconciliationComparableCalls > 0), y = /* @__PURE__ */ N(() => H(v) ? null : vl(t.indexed)), b = /* @__PURE__ */ N(() => H(u).costSummary), x = /* @__PURE__ */ N(() => au(H(b))), S = /* @__PURE__ */ N(() => ou(H(b))), ee = /* @__PURE__ */ N(() => H(b).priceData), C = /* @__PURE__ */ N(() => H(u).reportedCostTotal === null ? null : du(H(u).reportedCostCoverage)), te = /* @__PURE__ */ N(() => H(u).reportedPromptTokens === null ? null : du(H(u).reportedUsageCoverage)), w = /* @__PURE__ */ N(() => H(u).harnessSessionCost !== null && !(H(u).source === "vscode-copilot" && H(u).reportedCostTotal !== null && Math.abs(H(u).reportedCostTotal - H(u).harnessSessionCost.totalUsd) < 1e-9));
	var T = yp(), E = L(T), D = (e) => {
		var t = Yf(), n = L(t), r = z(n), i = B(n, 2), a = z(i), o = B(i, 2), s = z(o, !0), c = z(B(o, 2), !0);
		j(t), V((e, n, i) => {
			Y(t, "title", H(x) ? `${H(x).label}: ${H(x).note}` : void 0), K(r, `${e ?? ""} calls`), K(a, `${n ?? ""} items`), K(s, i), K(c, H(x) ? H(x).value : "Cost unknown");
		}, [
			() => Q(H(l).modelCalls.length),
			() => Q(H(l).contextItems.length),
			() => H(u).peakCalculatedVisibleTokens === null ? "Peak unknown" : `${Z(H(u).peakCalculatedVisibleTokens)} peak`
		]), G(e, t);
	}, O = (e) => {
		var t = ep(), n = L(t), r = z(B(L(n)), !0);
		j(n);
		var i = B(n, 2), a = z(B(L(i)), !0);
		j(i);
		var o = B(i, 2), s = z(B(L(o), 2), !0);
		j(o);
		var c = B(o, 2), d = L(c), f = (e) => {
			var t = Qf(), n = R(t), r = L(n, !0);
			_a(B(r), {
				id: "session-cost-note",
				label: "How the cost is worked out",
				children: (e, t) => {
					Se();
					var n = Xf(), r = R(n), i = B(r), a = L(i), o = B(a), s = (e) => {
						var t = zr();
						V((e) => K(t, `, with corrections from model-prices ${e ?? ""}`), [() => H(ee).amendmentsImportedFrom.slice(0, 7)]), G(e, t);
					};
					q(o, (e) => {
						H(ee).amendmentsImportedFrom && e(s);
					}), Se(), j(i), V((e, t) => {
						K(r, `${H(x).title ?? ""} `), K(a, `Prices from models.dev ${e ?? ""} (${t ?? ""})`);
					}, [() => H(ee).modelsDevCommit.slice(0, 7), () => H(ee).modelsDevCommittedAt.slice(0, 10)]), G(e, n);
				},
				$$slots: { default: !0 }
			}), j(n);
			var i = B(n, 2), a = z(i, !0), o = B(i, 2), s = z(o), c = B(o, 2), l = (e) => {
				var t = Zf(), n = z(t, !0);
				V(() => K(n, H(x).split)), G(e, t);
			};
			q(c, (e) => {
				H(x).split && e(l);
			}), V(() => {
				K(r, H(x).label), K(a, H(x).value), K(s, `${H(x).note ?? ""}${H(S) ? ` · ${H(S)}` : ""}`);
			}), G(e, t);
		}, p = (e) => {
			var t = $f(), n = B(R(t), 4), r = (e) => {
				var t = Zf(), n = z(t, !0);
				V(() => K(n, H(S))), G(e, t);
			};
			q(n, (e) => {
				H(S) && e(r);
			}), G(e, t);
		};
		q(d, (e) => {
			H(x) ? e(f) : e(p, -1);
		}), j(c), j(t), V((e, t, n) => {
			K(r, e), K(a, t), K(s, n);
		}, [
			() => Q(H(l).modelCalls.length),
			() => Q(H(l).contextItems.length),
			() => H(u).peakCalculatedVisibleTokens === null ? "Unknown" : Ua(H(u).peakCalculatedVisibleTokens, "calculatedTokens")
		]), G(e, t);
	};
	q(E, (e) => {
		i() ? e(D) : e(O, -1);
	});
	var ne = B(E, 2), re = L(ne), ie = L(re, !0), ae = B(ie);
	{
		let e = /* @__PURE__ */ N(() => `Why are estimates ${H(g).level}?`);
		_a(ae, {
			id: "estimate-quality-note",
			get label() {
				return H(e);
			},
			children: (e, t) => {
				var n = rp(), r = R(n), i = z(r, !0), a = B(r, 2), o = (e) => {
					var t = np();
					J(t, 20, () => H(g).reasons, (e) => e, (e, t) => {
						var n = tp(), r = z(n, !0);
						V(() => K(r, t)), G(e, n);
					}), j(t), G(e, t);
				};
				q(a, (e) => {
					H(g).reasons.length > 0 && e(o);
				}), V(() => K(i, H(g).lead)), G(e, n);
			},
			$$slots: { default: !0 }
		});
	}
	j(re);
	var oe = B(re, 2), se = B(L(oe), 2), ce = L(se), le = B(L(ce), 2), ue = L(le), de = L(ue);
	_a(B(L(de)), {
		id: "input-tokens-note",
		label: "About input tokens",
		children: (e, t) => {
			Se(), G(e, zr("Input tokens summed over every call. Each call sends the whole context again, so\n                  most of these are cache reads."));
		},
		$$slots: { default: !0 }
	}), j(de);
	var fe = B(de, 2), pe = L(fe), me = B(pe), he = (e) => {
		var t = Zf(), n = z(t, !0);
		V(() => K(n, H(te))), G(e, t);
	};
	q(me, (e) => {
		H(te) && e(he);
	}), j(fe), j(ue);
	var ge = B(ue, 2), _e = z(B(L(ge), 2), !0);
	j(ge);
	var ve = B(ge, 2), k = B(L(ve), 2), ye = L(k), A = (e) => {
		var t = ip();
		_a(B(R(t)), {
			id: "reasoning-tokens-note",
			label: "Why reasoning tokens are not recorded",
			children: (e, t) => {
				Se();
				var n = zr();
				V((e) => K(n, `${e ?? ""} does not record reasoning tokens separately for these
                    calls. Any reasoning is included in the output tokens.`), [() => ql(H(u).source)]), G(e, n);
			},
			$$slots: { default: !0 }
		}), G(e, t);
	}, be = (e) => {
		var t = zr();
		V((e) => K(t, e), [() => Z(H(u).reportedReasoningTokens)]), G(e, t);
	};
	q(ye, (e) => {
		H(u).reportedReasoningTokens === null ? e(A) : e(be, -1);
	}), j(k), j(ve);
	var xe = B(ve, 2), Ce = L(xe);
	_a(B(L(Ce)), {
		id: "cache-read-share-note",
		label: "About cache-read share",
		children: (e, t) => {
			Se();
			var n = zr();
			V((e) => K(n, `The share of input tokens read from the provider's cache, over the ${e ?? ""} calls with complete usage.`), [() => Ka(H(f).cacheReadEligibleCalls, H(l).modelCalls.length)]), G(e, n);
		},
		$$slots: { default: !0 }
	}), j(Ce);
	var we = z(B(Ce, 2), !0);
	j(xe);
	var Te = B(xe, 2), Ee = z(B(L(Te), 2), !0);
	j(Te);
	var De = B(Te, 2), Oe = (e) => {
		var t = ap(), n = z(B(L(t), 2), !0);
		j(t), V((e) => K(n, e), [() => H(b).billed.calls > 0 ? Ql(H(b).billed, !0) : "None"]), G(e, t);
	}, ke = /* @__PURE__ */ N(() => !["claude-code", "codex"].includes(H(u).source));
	q(De, (e) => {
		H(ke) && e(Oe);
	});
	var Ae = B(De, 2), je = L(Ae), Me = L(je);
	_a(B(Me), {
		id: "recorded-cost-note",
		label: "About the recorded cost",
		children: (e, t) => {
			Se();
			var n = zr();
			V(() => K(n, H(_).note)), G(e, n);
		},
		$$slots: { default: !0 }
	}), j(je);
	var Ne = B(je, 2), Pe = L(Ne), Fe = (e) => {
		G(e, zr("Not recorded"));
	}, Ie = (e) => {
		var t = zr();
		V((e) => K(t, e), [() => za(H(u).reportedCostTotal)]), G(e, t);
	};
	q(Pe, (e) => {
		H(u).reportedCostTotal === null ? e(Fe) : e(Ie, -1);
	});
	var M = B(Pe, 2), Le = (e) => {
		var t = Zf(), n = z(t, !0);
		V(() => K(n, H(C))), G(e, t);
	};
	q(M, (e) => {
		H(C) && e(Le);
	}), j(Ne), j(Ae);
	var Re = B(Ae, 2), ze = (e) => {
		var t = op(), n = L(t), r = z(n), i = B(n, 2), a = L(i), o = z(B(a), !0);
		j(i), j(t), V((e, t, n) => {
			K(r, `${e ?? ""}'s own total (USD)`), K(a, `${t ?? ""} `), K(o, n);
		}, [
			() => ql(H(u).source),
			() => Ba(H(u).harnessSessionCost.totalUsd),
			() => su(H(u).harnessSessionCost, H(u).source)
		]), G(e, t);
	};
	q(Re, (e) => {
		H(w) && H(u).harnessSessionCost && e(ze);
	}), j(le), j(ce);
	var Be = B(ce, 2), Ue = B(L(Be), 2), We = L(Ue), Ge = z(B(L(We), 2));
	j(We);
	var Ke = B(We, 2), qe = z(B(L(Ke), 2), !0);
	j(Ke);
	var Je = B(Ke, 2), Ye = (e) => {
		var t = sp(), n = z(B(L(t), 2), !0);
		j(t), V(() => K(n, H(u).title)), G(e, t);
	};
	q(Je, (e) => {
		H(u).title && e(Ye);
	});
	var Xe = B(Je, 2), Ze = z(B(L(Xe), 2), !0);
	j(Xe), j(Ue), j(Be), j(se);
	var Qe = B(se, 2), $e = B(L(Qe), 2), et = L($e), tt = z(B(L(et), 2), !0);
	j(et);
	var nt = B(et, 2), rt = z(B(L(nt), 2));
	j(nt);
	var it = B(nt, 2), at = (e) => {
		var t = cp(), n = L(t), r = z(n), i = z(B(n, 2));
		j(t), V((e, t, n, a) => {
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
	}, ot = /* @__PURE__ */ N(() => ![
		"claude-code",
		"codex",
		"copilot",
		"vscode-copilot"
	].includes(H(u).source));
	q(it, (e) => {
		H(ot) && e(at);
	});
	var st = B(it, 2), ct = (e) => {
		G(e, lp());
	}, lt = /* @__PURE__ */ N(() => Bl(H(u).source));
	q(st, (e) => {
		H(lt) && e(ct);
	});
	var ut = B(st, 2), dt = (e) => {
		var t = up(), n = B(L(t), 2), r = z(L(n), !0);
		j(n), j(t), V(() => K(r, H(d).fallbackReason)), G(e, t);
	};
	q(ut, (e) => {
		H(d).fallbackReason && e(dt);
	});
	var ft = B(ut, 2), pt = z(B(L(ft), 2));
	j(ft);
	var mt = B(ft, 2), ht = z(B(L(mt), 2), !0);
	j(mt);
	var gt = B(mt, 2), _t = z(B(L(gt), 2), !0);
	j(gt);
	var vt = B(gt, 2), yt = (e) => {
		var t = dp(), n = R(t), r = z(B(L(n), 2));
		j(n);
		var i = B(n, 2), a = z(B(L(i), 2));
		j(i);
		var o = B(i, 2), s = z(B(L(o), 2), !0);
		j(o), V((e, t, n, i, o) => {
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
	}, bt = (e) => {
		var t = fp(), n = z(B(L(t), 2), !0);
		j(t), V((e) => K(n, e), [() => Q(H(y).estimateAboveReportedCalls)]), G(e, t);
	};
	q(vt, (e) => {
		H(v) ? e(yt) : H(y) && e(bt, 1);
	});
	var xt = B(vt, 2), St = z(B(L(xt), 2), !0);
	j(xt), j($e);
	var Ct = B($e, 2), wt = (e) => {
		var t = mp(), n = B(R(t), 2);
		J(n, 21, () => H(d).profiles, (e) => e.id, (e, t) => {
			var n = pp(), r = L(n), i = B(r), a = (e) => {
				var n = zr();
				V(() => K(n, `· ${H(t).api ?? ""}`)), G(e, n);
			};
			q(i, (e) => {
				H(t).api && e(a);
			}), j(n), V(() => K(r, `${H(t).provider ?? ""} / ${H(t).model ?? ""} · ${H(t).method ?? ""} · ${H(t).tokenizerFamily ?? ""}
                (v${H(t).version ?? ""})`)), G(e, n);
		}), j(n), G(e, t);
	};
	q(Ct, (e) => {
		H(d).profiles.length > 0 && e(wt);
	}), j(Qe), j(oe), j(ne);
	var Tt = B(ne, 2), Et = (e) => {
		var t = vp(), r = L(t), i = (e) => {
			var t = hp(), r = B(L(t)), i = z(r, !0);
			j(t), V((e) => {
				Y(r, "href", e), K(i, H(o).displayName);
			}, [() => Nd(H(o).id, n())]), G(e, t);
		};
		q(r, (e) => {
			H(o) && n() && e(i);
		});
		var a = B(r, 2), l = (e) => {
			var t = _p(), n = L(t), r = z(n), i = B(n, 2);
			J(i, 21, () => H(s), (e) => e.id, (e, t) => {
				var n = gp(), r = L(n), i = z(r, !0);
				j(n), V((e, t) => {
					Y(r, "href", e), K(i, t);
				}, [() => Nd(H(t).id), () => c(H(t))]), G(e, n);
			}), j(i), j(t), V((e) => K(r, `${e ?? ""}
            ${H(s).length === 1 ? "child session" : "child sessions"}`), [() => Q(H(s).length)]), G(e, t);
		};
		q(a, (e) => {
			H(s).length > 0 && e(l);
		}), j(t), G(e, t);
	};
	q(Tt, (e) => {
		(H(o) || H(s).length > 0) && e(Et);
	}), j(T), V((e, t, n, r, i, a, o, s, c, l, d, f, h, _, v, y) => {
		gi(re, 1, `estimate-level ${H(g).level}`, "svelte-m8zdew"), K(ie, H(g).label), K(pe, `${e ?? ""} `), K(_e, t), K(we, n), K(Ee, r), K(Me, `Recorded by ${i ?? ""} (USD)`), K(Ge, `${H(p) ?? ""} · recorded by ${a ?? ""}`), K(qe, H(m)), K(Ze, H(u).workingDirectory ?? "Unknown"), K(tt, H(u).reportedUsageCompleteness), K(rt, `${o ?? ""} complete ·
              ${s ?? ""} partial ·
              ${c ?? ""} missing ·
              ${l ?? ""} unsupported`), K(pt, `${d ?? ""} complete ·
              ${f ?? ""} partial ·
              ${h ?? ""} unavailable`), K(ht, _), K(_t, v), K(St, y);
	}, [
		() => Z(H(u).reportedPromptTokens),
		() => Z(H(u).reportedCompletionTokens),
		() => Va(H(f).cacheReadRatio),
		() => Q(H(l).compactions.length),
		() => ql(H(u).source),
		() => ql(H(u).source),
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
	]), G(e, T), He();
}
//#endregion
//#region src/lib/components/ChartHelp.svelte
var Sp = /* @__PURE__ */ W("<h4 class=\"svelte-1f7lrk7\">System and tools</h4> <p class=\"svelte-1f7lrk7\">Recorded Pi instructions and tool declarations are replayed into per-call revisions. Their\n        token sizes estimate logical context, not exact provider wire framing. Older logs may lack\n        this material; missing does not mean zero. Provider-reported input and cost remain\n        independent totals.</p>", 1), Cp = /* @__PURE__ */ W("<div class=\"chart-help svelte-1f7lrk7\"><button type=\"button\" aria-label=\"Chart help\" aria-controls=\"chart-help-popover\" title=\"Chart help\"> </button> <div id=\"chart-help-popover\" class=\"help-popover svelte-1f7lrk7\" role=\"group\" aria-labelledby=\"chart-help-title\"><div class=\"help-heading svelte-1f7lrk7\"><h3 id=\"chart-help-title\" class=\"svelte-1f7lrk7\">Chart help</h3> <button type=\"button\" class=\"help-close svelte-1f7lrk7\" aria-label=\"Close help\" title=\"Close (Esc)\">×</button></div> <h4 class=\"svelte-1f7lrk7\">Navigate the river</h4> <ul class=\"svelte-1f7lrk7\"><li class=\"svelte-1f7lrk7\">Drag across a range to zoom; scroll horizontally or Shift-drag to pan.</li> <li class=\"svelte-1f7lrk7\">Use pinch or modifier-wheel zoom; ordinary page scrolling remains available.</li> <li class=\"svelte-1f7lrk7\">Use Go to call beside the zoom controls to pin a call without changing zoom. Drag an area to\n        zoom to a range.</li> <li class=\"svelte-1f7lrk7\">The lifespan list spans the full session; filter or search it to locate an item.</li> <li class=\"svelte-1f7lrk7\">Use Find in lifespans from Composition to open and focus a selected item's row.</li> <li class=\"svelte-1f7lrk7\">Escape closes this help first, then clears the selected item, the pin, and Fit all.</li></ul> <!> <h4 class=\"svelte-1f7lrk7\">Read the scale</h4> <p class=\"svelte-1f7lrk7\">Session scale keeps ribbon heights comparable across calls. Visible calls mode rescales to\n      visible columns and interpolated viewport edges, so heights can change while panning or\n      zooming. Cached tokens still occupy context capacity.</p></div></div>"), wp = {
	hash: "svelte-1f7lrk7",
	code: ".chart-help.svelte-1f7lrk7 {display:flex;align-items:center;gap:6px 12px;min-height:var(--toggle-height);color:var(--secondary);font-size:var(--text-sm);}.help-trigger.svelte-1f7lrk7 {cursor:pointer;padding:5px 8px;white-space:nowrap;border:1px solid var(--separator);border-radius:var(--control-radius);color:var(--text);background:var(--surface);font:inherit;}.help-trigger.svelte-1f7lrk7:hover {background:var(--surface-raised);}.help-heading.svelte-1f7lrk7 {display:flex;align-items:center;justify-content:space-between;gap:12px;}.help-heading.svelte-1f7lrk7 h3:where(.svelte-1f7lrk7) {margin:0;}.help-close.svelte-1f7lrk7 {display:inline-flex;align-items:center;justify-content:center;width:var(--control-size);height:var(--control-size);padding:0;font-size:18px;line-height:1;}.help-popover.svelte-1f7lrk7 {position:fixed;z-index:20;left:12px;top:12px;width:min(30rem, calc(100vw - 24px));max-height:min(70vh, calc(100vh - 24px));overflow:auto;overscroll-behavior:contain;padding:14px 16px;border:1px solid var(--control-border);border-radius:var(--radius);background:var(--surface);color:var(--text);box-shadow:0 12px 32px var(--shadow-strong);font-size:var(--text-md);}h3.svelte-1f7lrk7,\n  h4.svelte-1f7lrk7 {margin:0 0 6px;color:var(--text-strong);}h3.svelte-1f7lrk7 {font-size:var(--text-lg);}h4.svelte-1f7lrk7 {margin-top:12px;font-size:var(--text-sm);}p.svelte-1f7lrk7 {margin:5px 0;}ul.svelte-1f7lrk7 {margin:5px 0;padding-left:20px;}li.svelte-1f7lrk7 + li:where(.svelte-1f7lrk7) {margin-top:4px;}"
};
function Tp(e, t) {
	Ve(t, !0), li(e, wp);
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
	var p = Cp();
	Or("resize", rn, u), Or("scroll", rn, u);
	var m = L(p);
	let h;
	var g = z(m, !0);
	Li(m, (e) => I(a, e), () => H(a));
	var _ = B(m, 2), v = L(_), y = B(L(v), 2);
	Li(y, (e) => I(s, e), () => H(s)), j(v);
	var b = B(v, 6), x = (e) => {
		var t = Sp();
		Se(2), G(e, t);
	};
	q(b, (e) => {
		t.source === "pi" && e(x);
	}), Se(4), j(_), Li(_, (e) => I(o, e), () => H(o)), j(p), Li(p, (e) => i = e, () => i), V(() => {
		h = gi(m, 1, "help-trigger svelte-1f7lrk7", null, h, { compact: r() }), Y(m, "aria-expanded", H(l)), K(g, r() ? "?" : "Chart help"), Y(_, "aria-hidden", !H(l)), Y(_, "hidden", !H(l)), vi(_, H(c));
	}), U("click", m, f), U("click", y, () => d()), G(e, p), He();
}
kr(["click"]);
//#endregion
//#region src/lib/context-river/navigation.ts
function Ep(e, t, n) {
	let r = e.find((e) => e.callIndex === t);
	return r ? {
		callIndex: t,
		sourceRecordId: r.sourceRecordId ?? null,
		offsetFromViewportLeft: n
	} : null;
}
function Dp(e, t, n, r) {
	let i = e.findIndex((e) => e.callIndex === t), a = e.findIndex((e) => e.callIndex === n);
	if (i < 0 || a < 0) return null;
	if (i === a) {
		let n = Ep(e, t, r);
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
function Op(e, t, n) {
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
function kp(e, t, n) {
	return e === 0 ? t / (Math.min(15, n) - 1) : t / e;
}
function Ap(e, t, n, r, i) {
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
function jp(e, t) {
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
function Mp(e) {
	return {
		pointerId: e.pointerId,
		pointerType: e.pointerType,
		button: e.button,
		x: e.clientX,
		y: e.clientY,
		shiftKey: e.shiftKey
	};
}
function Np(e, t) {
	try {
		e.setPointerCapture(t);
	} catch {}
}
function Pp(e, t) {
	try {
		e.hasPointerCapture?.(t) && e.releasePointerCapture(t);
	} catch {}
}
//#endregion
//#region src/lib/context-river/overlay-focus.ts
function Fp(e = gr) {
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
function Ip(e, t) {
	return e == null || t == null ? NaN : e < t ? -1 : e > t ? 1 : e >= t ? 0 : NaN;
}
//#endregion
//#region node_modules/d3-array/src/descending.js
function Lp(e, t) {
	return e == null || t == null ? NaN : t < e ? -1 : t > e ? 1 : t >= e ? 0 : NaN;
}
//#endregion
//#region node_modules/d3-array/src/bisector.js
function Rp(e) {
	let t, n, r;
	e.length === 2 ? (t = e === Ip || e === Lp ? e : zp, n = e, r = e) : (t = Ip, n = (t, n) => Ip(e(t), n), r = (t, n) => e(t) - n);
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
function zp() {
	return 0;
}
//#endregion
//#region node_modules/d3-array/src/number.js
function Bp(e) {
	return e === null ? NaN : +e;
}
//#endregion
//#region node_modules/d3-array/src/bisect.js
var Vp = Rp(Ip), Hp = Vp.right;
Vp.left, Rp(Bp).center;
//#endregion
//#region node_modules/d3-array/src/ticks.js
var Up = Math.sqrt(50), Wp = Math.sqrt(10), Gp = Math.sqrt(2);
function Kp(e, t, n) {
	let r = (t - e) / Math.max(0, n), i = Math.floor(Math.log10(r)), a = r / 10 ** i, o = a >= Up ? 10 : a >= Wp ? 5 : a >= Gp ? 2 : 1, s, c, l;
	return i < 0 ? (l = 10 ** -i / o, s = Math.round(e * l), c = Math.round(t * l), s / l < e && ++s, c / l > t && --c, l = -l) : (l = 10 ** i * o, s = Math.round(e / l), c = Math.round(t / l), s * l < e && ++s, c * l > t && --c), c < s && .5 <= n && n < 2 ? Kp(e, t, n * 2) : [
		s,
		c,
		l
	];
}
function qp(e, t, n) {
	if (t = +t, e = +e, n = +n, !(n > 0)) return [];
	if (e === t) return [e];
	let r = t < e, [i, a, o] = r ? Kp(t, e, n) : Kp(e, t, n);
	if (!(a >= i)) return [];
	let s = a - i + 1, c = Array(s);
	if (r) {
		if (o < 0) for (let e = 0; e < s; ++e) c[e] = (a - e) / -o;
		else for (let e = 0; e < s; ++e) c[e] = (a - e) * o;
	} else if (o < 0) for (let e = 0; e < s; ++e) c[e] = (i + e) / -o;
	else for (let e = 0; e < s; ++e) c[e] = (i + e) * o;
	return c;
}
function Jp(e, t, n) {
	return t = +t, e = +e, n = +n, Kp(e, t, n)[2];
}
function Yp(e, t, n) {
	t = +t, e = +e, n = +n;
	let r = t < e, i = r ? Jp(t, e, n) : Jp(e, t, n);
	return (r ? -1 : 1) * (i < 0 ? 1 / -i : i);
}
//#endregion
//#region src/lib/context-river/vertical-scale.ts
function Xp(e, t, n) {
	if (e.length === 0 || !Number.isFinite(t) || !Number.isFinite(n)) return {
		maxWeight: 0,
		visibleCallCount: 0,
		usesInterpolatedEdge: !1
	};
	let r = e, i = Math.min(t, n), a = Math.max(t, n), o = nm(r, i), s = rm(r, a), c = im(r, i), l = im(r, a), u = Math.max(0, c.weight, l.weight);
	for (let e = o; e < s; e += 1) u = Math.max(u, r[e].totalDisplayWeight);
	return {
		maxWeight: u,
		visibleCallCount: Math.max(0, s - o),
		usesInterpolatedEdge: c.interpolated || l.interpolated
	};
}
function Zp(e, t = 4, n = .06) {
	if (!Number.isFinite(e) || e <= 0) return [0];
	let r = e * (1 - n);
	return [
		0,
		...qp(0, e, Math.max(1, Math.floor(t))).filter((e) => e > 0 && e < r),
		e
	];
}
var Qp = new Intl.NumberFormat(void 0, {
	notation: "compact",
	maximumFractionDigits: 1
}), $p = new Intl.NumberFormat(void 0, { maximumFractionDigits: 1 }), em = new Intl.NumberFormat(void 0, { maximumFractionDigits: 0 });
function tm(e) {
	return Number.isFinite(e) ? Math.abs(e) >= 1e3 ? Qp.format(e) : Number.isInteger(e) ? em.format(e) : $p.format(e) : "—";
}
function nm(e, t) {
	let n = 0, r = e.length;
	for (; n < r;) {
		let i = Math.floor((n + r) / 2);
		e[i].x < t ? n = i + 1 : r = i;
	}
	return n;
}
function rm(e, t) {
	let n = 0, r = e.length;
	for (; n < r;) {
		let i = Math.floor((n + r) / 2);
		e[i].x <= t ? n = i + 1 : r = i;
	}
	return n;
}
function im(e, t) {
	let n = e[0], r = e[e.length - 1];
	if (t <= n.x) return {
		weight: Math.max(0, n.totalDisplayWeight),
		interpolated: !1
	};
	if (t >= r.x) return {
		weight: Math.max(0, r.totalDisplayWeight),
		interpolated: !1
	};
	let i = nm(e, t), a = e[i];
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
var am = /* @__PURE__ */ Rr("<rect x=\"1\" y=\"1\" rx=\"4\" class=\"glyph-compaction svelte-1kmdkag\"></rect><text text-anchor=\"middle\" class=\"svelte-1kmdkag\">C</text>", 1), om = /* @__PURE__ */ Rr("<path class=\"glyph-target svelte-1kmdkag\"></path><text text-anchor=\"middle\" class=\"svelte-1kmdkag\">M</text>", 1), sm = /* @__PURE__ */ Rr("<circle class=\"glyph-ratio svelte-1kmdkag\"></circle><text text-anchor=\"middle\" class=\"svelte-1kmdkag\"> </text>", 1), cm = /* @__PURE__ */ Rr("<g><!></g>"), lm = /* @__PURE__ */ Rr("<svg><!></svg>"), um = {
	hash: "svelte-1kmdkag",
	code: ".event-glyph-svg.svelte-1kmdkag {display:inline-block;flex:0 0 auto;overflow:visible;vertical-align:middle;}.event-glyph-svg.svelte-1kmdkag text:where(.svelte-1kmdkag) {fill:var(--active-text);font:750 9px ui-sans-serif,\n      system-ui,\n      sans-serif;pointer-events:none;}.event-glyph-svg-compaction.svelte-1kmdkag text:where(.svelte-1kmdkag) {fill:var(--event-compaction-text);}.event-glyph-svg-ratioChange.svelte-1kmdkag text:where(.svelte-1kmdkag) {fill:var(--event-warning-text);}.event-glyph-svg.rise.svelte-1kmdkag text:where(.svelte-1kmdkag) {fill:var(--event-success-text);}.glyph-compaction.svelte-1kmdkag {fill:var(--event-compaction-fill);stroke:var(--compaction);stroke-width:1.25;}.glyph-target.svelte-1kmdkag {fill:var(--action);stroke:var(--event-target);stroke-width:1.25;}.glyph-ratio.svelte-1kmdkag {fill:var(--event-warning);stroke:var(--page);stroke-width:1.25;}.event-glyph-svg.rise.svelte-1kmdkag .glyph-ratio:where(.svelte-1kmdkag) {fill:var(--event-success);}"
};
function dm(e, t) {
	li(e, um);
	let n = X(t, "direction", 3, void 0), r = X(t, "size", 3, 22), i = X(t, "label", 3, void 0), a = X(t, "svg", 3, !1), o = X(t, "x", 3, void 0), s = X(t, "y", 3, void 0);
	var c = Br(), l = R(c), u = (e) => {
		var a = cm(), c = L(a), l = (e) => {
			var t = am(), n = R(t), i = B(n);
			V(() => {
				Y(n, "width", r() - 2), Y(n, "height", r() - 2), Y(i, "x", r() / 2), Y(i, "y", r() / 2 + 4);
			}), G(e, t);
		}, u = (e) => {
			var t = om(), n = R(t), i = B(n);
			V(() => {
				Y(n, "d", `M ${r() / 2} 1 l ${r() / 2 - 1} ${r() / 2 - 1} l -${r() / 2 - 1} ${r() / 2 - 1} l -${r() / 2 - 1} -${r() / 2 - 1} Z`), Y(i, "x", r() / 2), Y(i, "y", r() / 2 + 4);
			}), G(e, t);
		}, d = (e) => {
			var t = sm(), i = R(t), a = B(i), o = z(a, !0);
			V(() => {
				Y(i, "cx", r() / 2), Y(i, "cy", r() / 2), Y(i, "r", r() / 2 - 2), Y(a, "x", r() / 2), Y(a, "y", r() / 2 + 4), K(o, n() === "drop" ? "↓" : "↑");
			}), G(e, t);
		};
		q(c, (e) => {
			t.kind === "compaction" ? e(l) : t.kind === "targetChange" ? e(u, 1) : e(d, -1);
		}), j(a), V(() => {
			gi(a, 0, `event-glyph-svg event-glyph-svg-${t.kind} ${n() ?? ""}`, "svelte-1kmdkag"), Y(a, "transform", `translate(${o() ?? 0} ${s() ?? 0})`), Y(a, "aria-label", i());
		}), G(e, a);
	}, d = (e) => {
		var a = lm(), o = L(a), s = (e) => {
			var t = am(), n = R(t), i = B(n);
			V(() => {
				Y(n, "width", r() - 2), Y(n, "height", r() - 2), Y(i, "x", r() / 2), Y(i, "y", r() / 2 + 4);
			}), G(e, t);
		}, c = (e) => {
			var t = om(), n = R(t), i = B(n);
			V(() => {
				Y(n, "d", `M ${r() / 2} 1 l ${r() / 2 - 1} ${r() / 2 - 1} l -${r() / 2 - 1} ${r() / 2 - 1} l -${r() / 2 - 1} -${r() / 2 - 1} Z`), Y(i, "x", r() / 2), Y(i, "y", r() / 2 + 4);
			}), G(e, t);
		}, l = (e) => {
			var t = sm(), i = R(t), a = B(i), o = z(a, !0);
			V(() => {
				Y(i, "cx", r() / 2), Y(i, "cy", r() / 2), Y(i, "r", r() / 2 - 2), Y(a, "x", r() / 2), Y(a, "y", r() / 2 + 4), K(o, n() === "drop" ? "↓" : "↑");
			}), G(e, t);
		};
		q(o, (e) => {
			t.kind === "compaction" ? e(s) : t.kind === "targetChange" ? e(c, 1) : e(l, -1);
		}), j(a), V(() => {
			gi(a, 0, `event-glyph-svg event-glyph-svg-${t.kind} ${n() ?? ""}`, "svelte-1kmdkag"), Y(a, "width", r()), Y(a, "height", r()), Y(a, "viewBox", `0 0 ${r()} ${r()}`), Y(a, "aria-label", i()), Y(a, "aria-hidden", i() ? void 0 : "true"), Y(a, "role", i() ? "img" : void 0);
		}), G(e, a);
	};
	q(l, (e) => {
		a() ? e(u) : e(d, -1);
	}), G(e, c);
}
//#endregion
//#region src/lib/context-river/event-clustering.ts
var fm = {
	compaction: "compaction",
	targetChange: "model/provider change",
	ratioChange: "cache-share change"
};
function pm(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e) {
		let e = fm[n.kind];
		t.set(e, (t.get(e) ?? 0) + 1);
	}
	let n = [...t.entries()].sort(([e], [t]) => e.localeCompare(t)).map(([e, t]) => `${t} ${e}${t === 1 ? "" : "s"}`).join(" · ");
	return `${e.length} economics event${e.length === 1 ? "" : "s"} · ${n}`;
}
function mm(e) {
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
function hm(e) {
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
function gm(e, t) {
	return e.length === 1 ? t : Math.max(46, 14 + mm(e).length * 7.2);
}
function _m(e, t) {
	let n = gm(e, t.markerSize), r = Math.max(1, t.chartWidth - t.left - t.right), i = Math.min(n + 16, r), a = Math.min(n, i), o = e.reduce((e, t) => e + t.x, 0) / e.length, s = Math.max(t.left + i / 2, Math.min(t.chartWidth - t.right - i / 2, o));
	return {
		id: `event-cluster-${e[0]?.id ?? "empty"}`,
		x: s,
		anchorX: o,
		events: e,
		badgeWidth: a,
		hitWidth: i,
		left: s - i / 2,
		right: s + i / 2,
		compositionLabel: pm(e),
		badgeLabel: mm(e),
		callRanges: hm(e)
	};
}
function vm(e, t) {
	let n = {
		chartWidth: Math.max(0, t.chartWidth),
		left: Math.max(0, t.left),
		right: Math.max(0, t.right),
		markerSize: t.markerSize ?? 22,
		collisionGap: t.collisionGap ?? 6
	}, r = [...e].sort((e, t) => e.x - t.x || e.id.localeCompare(t.id)), i = [];
	for (let e of r) {
		let t = _m([e], n), r = i[i.length - 1];
		r && t.left < r.right + n.collisionGap ? i[i.length - 1] = _m([...r.events, e], n) : i.push(t);
	}
	for (let e = 1; e < i.length;) {
		let t = i[e - 1], r = i[e];
		t && r && r.left < t.right + n.collisionGap ? (i.splice(e - 1, 2, _m([...t.events, ...r.events], n)), e = Math.max(1, e - 1)) : e += 1;
	}
	return i;
}
//#endregion
//#region src/lib/context-river/EconomicsTrack.svelte
var ym = /* @__PURE__ */ Rr("<line class=\"track-gridline svelte-18b1ucv\"></line><text class=\"track-y-label svelte-18b1ucv\" text-anchor=\"end\"> </text>", 1), bm = /* @__PURE__ */ Rr("<line class=\"compaction-span svelte-18b1ucv\"><title> </title></line>"), xm = /* @__PURE__ */ Rr("<rect class=\"event-count-badge svelte-18b1ucv\" rx=\"5\"></rect><text class=\"event-count svelte-18b1ucv\" text-anchor=\"middle\"> </text>", 1), Sm = /* @__PURE__ */ Rr("<g role=\"button\" tabindex=\"0\"><title> </title><rect class=\"event-hit svelte-18b1ucv\" rx=\"5\"></rect><!></g>"), Cm = /* @__PURE__ */ Rr("<rect></rect>"), wm = /* @__PURE__ */ Rr("<circle class=\"zero-mark svelte-18b1ucv\" r=\"3\"></circle>"), Tm = /* @__PURE__ */ Rr("<rect class=\"missing-mark svelte-18b1ucv\" width=\"8\" height=\"8\"></rect>"), Em = /* @__PURE__ */ Rr("<path class=\"uncertain-mark svelte-18b1ucv\"></path>"), Dm = /* @__PURE__ */ Rr("<line class=\"track-pin svelte-18b1ucv\"></line>"), Om = /* @__PURE__ */ Rr("<line class=\"track-hover svelte-18b1ucv\"></line>"), km = /* @__PURE__ */ Rr("<g role=\"button\"><title> </title><!><!><!></g>"), Am = /* @__PURE__ */ Rr("<line class=\"cost-range svelte-18b1ucv\"></line>"), jm = /* @__PURE__ */ Rr("<line></line><circle r=\"3.5\"></circle>", 1), Mm = /* @__PURE__ */ Rr("<circle r=\"3.5\"></circle>"), Nm = /* @__PURE__ */ Rr("<g role=\"button\"><title> </title><!><!><!><!></g>"), Pm = /* @__PURE__ */ W("<div class=\"track-shell svelte-18b1ucv\" role=\"presentation\"><svg class=\"economics-track-svg svelte-18b1ucv\" role=\"group\"><defs><pattern id=\"economics-write-pattern\" width=\"6\" height=\"6\" patternUnits=\"userSpaceOnUse\" patternTransform=\"rotate(45)\"><rect width=\"6\" height=\"6\" fill=\"var(--cache-write)\"></rect><path d=\"M0 0V6\" stroke=\"var(--cache-write-mark)\" stroke-width=\"1.5\" opacity=\".7\"></path></pattern><pattern id=\"economics-fresh-pattern\" width=\"6\" height=\"6\" patternUnits=\"userSpaceOnUse\"><rect width=\"6\" height=\"6\" fill=\"var(--cache-fresh)\"></rect><circle cx=\"2\" cy=\"2\" r=\"1\" fill=\"var(--cache-fresh-mark)\"></circle></pattern><pattern id=\"economics-nonread-pattern\" width=\"7\" height=\"7\" patternUnits=\"userSpaceOnUse\" patternTransform=\"rotate(45)\"><rect width=\"7\" height=\"7\" fill=\"var(--cache-nonread)\"></rect><path d=\"M0 0V7\" stroke=\"var(--cache-nonread-mark)\" stroke-width=\"1.5\" opacity=\".8\"></path></pattern></defs><rect class=\"track-background svelte-18b1ucv\" x=\"0\" y=\"0\"></rect><rect class=\"track-plot svelte-18b1ucv\"></rect><!><g class=\"track-event-header svelte-18b1ucv\" aria-label=\"Economics event annotations\"><text class=\"svelte-18b1ucv\">Events</text></g><g class=\"track-event-lane svelte-18b1ucv\" aria-label=\"Economics event lane\"><rect class=\"svelte-18b1ucv\"></rect><!><!></g><!></svg></div>"), Fm = {
	hash: "svelte-18b1ucv",
	code: ".track-shell.svelte-18b1ucv {position:relative;min-width:0;}.economics-track-svg.svelte-18b1ucv {display:block;max-width:none;background:var(--plot);touch-action:pan-y;}.track-background.svelte-18b1ucv {fill:var(--plot);pointer-events:none;}.track-plot.svelte-18b1ucv {fill:var(--plot);pointer-events:none;}.track-gridline.svelte-18b1ucv {stroke:var(--separator);stroke-width:0.75;opacity:0.7;pointer-events:none;}.track-event-header.svelte-18b1ucv {fill:var(--muted);font-size:var(--text-xs);pointer-events:none;}.track-event-header.svelte-18b1ucv text:where(.svelte-18b1ucv):first-child {fill:var(--text);font-weight:750;}.track-event-lane.svelte-18b1ucv {pointer-events:all;}.track-event-lane.svelte-18b1ucv > rect:where(.svelte-18b1ucv) {fill:none;stroke:none;pointer-events:none;}.track-event-trigger.svelte-18b1ucv {cursor:pointer;pointer-events:all;outline:none;}.event-hit.svelte-18b1ucv {fill:transparent;stroke:transparent;stroke-width:2;pointer-events:all;}.event-count-badge.svelte-18b1ucv {stroke-width:1.25;fill:var(--action);stroke:var(--text);}.event-count.svelte-18b1ucv {fill:var(--active-text);font-size:var(--text-xs);font-weight:750;pointer-events:none;}.track-event-trigger.svelte-18b1ucv:focus-visible .event-hit:where(.svelte-18b1ucv) {fill:var(--action);fill-opacity:0.35;stroke:var(--selection);stroke-width:2.5;}.track-y-label.svelte-18b1ucv {fill:var(--text);font-size:9px;pointer-events:none;}.economics-mark.svelte-18b1ucv {cursor:pointer;outline:none;}.cache-segment.svelte-18b1ucv {stroke:var(--plot);stroke-width:0.6;}.cache-segment.cacheRead.svelte-18b1ucv {fill:var(--cache-read);}.cache-segment.cacheWrite.svelte-18b1ucv {fill:url(#economics-write-pattern);}.cache-segment.fresh.svelte-18b1ucv,\n  .cache-segment.uncached.svelte-18b1ucv {fill:url(#economics-fresh-pattern);}.cache-segment.nonRead.svelte-18b1ucv {fill:url(#economics-nonread-pattern);}.economics-mark.zero.svelte-18b1ucv .zero-mark:where(.svelte-18b1ucv) {fill:var(--plot);stroke:var(--text);stroke-width:1.5;}.uncertain-mark.svelte-18b1ucv {fill:var(--surface-raised);stroke:var(--warning);stroke-width:1.5;}.economics-mark.partial.svelte-18b1ucv .uncertain-mark:where(.svelte-18b1ucv) {fill:var(--surface-raised);stroke:var(--warning);}.economics-mark.unsupported.svelte-18b1ucv .uncertain-mark:where(.svelte-18b1ucv) {fill:var(--error-surface);stroke:var(--error);stroke-dasharray:2 1;}.missing-mark.svelte-18b1ucv {fill:none;stroke:var(--cache-nonread-mark);stroke-dasharray:2 1;stroke-width:1.5;}.cost-stem.svelte-18b1ucv {stroke:var(--cost);stroke-width:1.5;}.cost-stem.partial.svelte-18b1ucv {stroke:var(--warning);stroke-dasharray:3 2;}.cost-dot.svelte-18b1ucv {fill:var(--cost);stroke:var(--plot);stroke-width:1;}.cost-dot.partial.svelte-18b1ucv {stroke:var(--warning);stroke-width:2;}.cost-zero.svelte-18b1ucv {fill:var(--plot);stroke:var(--cost);stroke-width:1.5;}.cost-zero.partial.svelte-18b1ucv {stroke:var(--warning);stroke-dasharray:2 1;}\n  /* API-equivalent costs are not charges: hollow marks in a separate colour. */.api-equivalent.svelte-18b1ucv .cost-stem:where(.svelte-18b1ucv) {stroke:var(--api-cost);stroke-dasharray:3 2;}.api-equivalent.svelte-18b1ucv .cost-dot:where(.svelte-18b1ucv) {fill:var(--plot);stroke:var(--api-cost);stroke-width:1.5;}.api-equivalent.svelte-18b1ucv .cost-zero:where(.svelte-18b1ucv) {stroke:var(--api-cost);}.cost-range.svelte-18b1ucv {stroke:var(--cost);stroke-width:4;stroke-linecap:round;opacity:0.45;}.api-equivalent.svelte-18b1ucv .cost-range:where(.svelte-18b1ucv) {stroke:var(--api-cost);}.track-pin.svelte-18b1ucv {stroke:var(--selection);stroke-width:1.5;pointer-events:none;}.track-hover.svelte-18b1ucv {stroke:var(--secondary);stroke-width:1;stroke-dasharray:3 3;pointer-events:none;}.economics-mark.svelte-18b1ucv:focus-visible .cache-segment:where(.svelte-18b1ucv),\n  .economics-mark.svelte-18b1ucv:focus-visible .cost-dot:where(.svelte-18b1ucv),\n  .economics-mark.svelte-18b1ucv:focus-visible .cost-zero:where(.svelte-18b1ucv),\n  .economics-mark.svelte-18b1ucv:focus-visible .zero-mark:where(.svelte-18b1ucv),\n  .economics-mark.svelte-18b1ucv:focus-visible .uncertain-mark:where(.svelte-18b1ucv) {stroke:var(--selection);stroke-width:2.5;}.compaction-span.svelte-18b1ucv {stroke:var(--compaction);stroke-width:2;stroke-dasharray:4 3;stroke-linecap:round;}"
};
function Im(e, t) {
	Ve(t, !0), li(e, Fm);
	let n, r = X(t, "cacheView", 3, "tokens"), i = X(t, "onReadoutChange", 3, () => {}), a = X(t, "onEventBreakdownChange", 3, () => {}), o = Fp();
	Tn(() => o.observeIdentity(t.indexed)), Bi(() => o.dispose());
	let s = /* @__PURE__ */ N(() => t.mode === "cost" ? 190 : 262), c = /* @__PURE__ */ N(() => t.mode === "cost" ? 116 : 188), l = /* @__PURE__ */ N(() => H(c) + 16 + 2), u = /* @__PURE__ */ N(() => Math.max(44, H(s) - H(l) - 10)), d = /* @__PURE__ */ N(() => H(l) + H(u) / 2), f = {
		top: 14,
		right: 24,
		bottom: 62,
		left: 42
	}, p = /* @__PURE__ */ N(() => t.mode === "cache" ? 180 : 108), m = /* @__PURE__ */ N(() => H(p) - f.top), h = /* @__PURE__ */ F(null), g = "", _ = "", v = /* @__PURE__ */ N(() => Vl(t.indexed.analysis.session.source)), y = /* @__PURE__ */ N(() => t.mode === "cache" ? Tu(t.indexed.analysis) : null), b = /* @__PURE__ */ N(() => t.mode === "cost" ? Ou(t.indexed.analysis) : null), x = /* @__PURE__ */ N(() => new Map(H(y)?.points.map((e) => [e.callIndex, e]) ?? [])), S = /* @__PURE__ */ N(() => H(y)?.maximum ?? H(b)?.maximum ?? 0), ee = /* @__PURE__ */ N(() => t.mode === "cost" ? H(S) > 0 ? H(S) : 1 : r() === "share" ? 100 : Math.max(1, H(S))), C = /* @__PURE__ */ N(() => new Map(t.columns.map((e) => [e.callIndex, e]))), te = /* @__PURE__ */ N(() => fe(t.indexed.analysis.compactions, t.columns, t.width)), w = /* @__PURE__ */ N(() => de(t.indexed.analysis.compactions, t.columns, H(te))), T = /* @__PURE__ */ N(() => pe(t.indexed.analysis.modelCalls, t.columns)), E = /* @__PURE__ */ N(() => new Map(H(T).map((e) => [e.callIndex, e]))), D = /* @__PURE__ */ N(() => t.columns.length < 2 ? 14 : t.columns.reduce((e, n, r) => r === 0 ? e : Math.min(e, n.x - t.columns[r - 1].x), Infinity)), O = /* @__PURE__ */ N(() => Math.max(1.5, Math.min(12, H(D) * .68))), ne = /* @__PURE__ */ N(() => Zp(t.mode === "cache" && r() === "share" ? 100 : H(S), 3, .25)), re = /* @__PURE__ */ N(() => H(ne).map((e) => ({
		value: e,
		y: f.top + H(m) * (1 - e / H(ee))
	}))), ie = /* @__PURE__ */ N(() => H(y) ? A(H(y), H(C), {
		cacheView: r(),
		domainMaximum: H(ee),
		baseline: H(p),
		innerHeight: H(m),
		targetChangesByCall: H(E),
		usageMappingLabel: H(v)
	}) : []), ae = /* @__PURE__ */ N(() => H(b) ? be(H(b), H(C), {
		domainMaximum: H(ee),
		baseline: H(p),
		innerHeight: H(m),
		targetChangesByCall: H(E)
	}) : []), oe = /* @__PURE__ */ N(() => me(H(te), H(T), H(y), H(C))), se = /* @__PURE__ */ N(() => vm(H(oe), {
		chartWidth: t.width,
		left: f.left,
		right: f.right,
		markerSize: 22,
		collisionGap: 6
	})), ce = /* @__PURE__ */ N(() => H(se).find((e) => e.id === H(h)) ?? null);
	Tn(() => {
		if (H(ce)) {
			let e = JSON.stringify({
				id: H(ce).id,
				x: H(ce).x,
				events: H(ce).events.map((e) => ({
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
				id: H(ce).id,
				events: H(ce).events,
				callIndices: [...new Set(H(ce).events.map((e) => e.callIndex))].sort((e, t) => e - t),
				anchorX: H(ce).x,
				anchorY: H(d),
				laneTop: H(l),
				laneHeight: H(u)
			};
			yr(() => a()(t));
		} else _ !== "" && (_ = "", yr(() => a()(null)));
	});
	let le = /* @__PURE__ */ N(() => t.hoveredCallIndex ?? t.pinnedCallIndex), ue = /* @__PURE__ */ N(() => H(le) === null ? "" : ye(H(le)));
	Tn(() => {
		if (H(ue) === g) return;
		g = H(ue);
		let e = H(ue);
		yr(() => i()(e));
	});
	function de(e, t, n) {
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
	function fe(e, t, n) {
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
	function pe(e, t) {
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
	function me(e, t, n, r) {
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
				label: wu(t, e.callIndex)
			});
		}
		return i.sort((e, t) => e.x - t.x || e.id.localeCompare(t.id));
	}
	function he(e) {
		return `${e.label} · call ${e.callIndex}`;
	}
	Cn(() => {
		if (H(h) !== null && !H(se).some((e) => e.id === H(h))) {
			let e = H(h);
			I(h, null), o.focusAfterUpdate(() => ve(e), () => H(h) === null);
		}
	});
	function ge(e) {
		let t = e.id;
		I(h, t, !0), o.focusAfterUpdate(() => Vi(n).getElementById(`${t}-close`), () => H(h) === t);
	}
	function _e(e = !0) {
		let t = H(h);
		I(h, null), o.cancel(), e && t && o.focusAfterUpdate(() => ve(t), () => H(h) === null);
	}
	function ve(e) {
		return Vi(n).getElementById(e) ?? Vi(n).querySelector(".economics-track-header button");
	}
	function k(e, t) {
		(e.key === "Enter" || e.key === " ") && (e.preventDefault(), ge(t));
	}
	function ye(e) {
		let n = t.indexed.callByIndex.get(e);
		if (!n) return "";
		if (t.mode === "cache") {
			let i = H(x).get(e);
			if (!i || i.status !== "complete" && i.status !== "zero") return `Call ${e} · ${i?.note ?? "Cache data unavailable"}`;
			let a = i.segments.map((e) => `${e.label} ${Q(e.value)}`).join(" · "), o = i.shareStatus === "complete" ? `${Ee(i)} · ${H(v)} denominator of ${Q(i.shareDenominator ?? 0)} prompt tokens` : Ee(i), s = n.economics.promptTokens, c = n.economics.cacheReadRatio, l = s === null || s <= 0 ? "cache-read share unavailable; prompt-token denominator is zero or unavailable" : c === null ? `cache-read share unavailable of ${Q(s)} prompt tokens` : `cache-read share ${Ha(c)} of ${Q(s)} prompt tokens`, u = n.costAssessment.amount === null ? "" : ` · ${Yl(n.costAssessment, t.indexed.analysis.session.source)} cost ${Zl(n.costAssessment)} USD`;
			return `Call ${e}${t.pinnedCallIndex === e && t.hoveredCallIndex !== e ? " · pinned" : ""} · ${a} · ${t.mode === "cache" && r() === "share" ? `${o} · ` : ""}${l}${u}`;
		}
		return n.costAssessment.amount === null ? `Call ${e} · cost unavailable` : `Call ${e} · ${Yl(n.costAssessment, t.indexed.analysis.session.source)} cost ${Zl(n.costAssessment)} USD`;
	}
	function A(e, t, n) {
		return e.points.flatMap((e) => {
			let r = t.get(e.callIndex)?.x;
			return r === void 0 ? [] : [xe(e, r, n)];
		});
	}
	function be(e, t, n) {
		return e.points.flatMap((e) => {
			let r = t.get(e.callIndex)?.x;
			return r === void 0 ? [] : [Ce(e, r, n)];
		});
	}
	function xe(e, n, { cacheView: r, domainMaximum: i, baseline: a, innerHeight: o, targetChangesByCall: s, usageMappingLabel: c }) {
		let l = a, u = (r === "share" ? e.shareSegments : e.segments).map((e) => {
			let t = r === "share" && "percentage" in e ? e.percentage : e.value, n = t / i * o, a = l - n;
			return l = a, {
				...e,
				displayValue: t,
				y: a,
				height: n
			};
		}), d = t.indexed.callByIndex.get(e.callIndex), f = e.segments.map((e) => `${e.label} ${Q(e.value)}`).join(" · "), p = Ee(e), m = d ? Va(d.economics.cacheReadRatio) : "Unknown", h = d?.economics.promptTokens === null || d?.economics.promptTokens === void 0 ? `${c} prompt-token denominator unavailable` : `${c} denominator of ${Q(d.economics.promptTokens)} prompt tokens`, g = e.discontinuity, _ = s.get(e.callIndex)?.label, v = _ ? ` · ${_}.` : "", y = g ? ` · ${wu(g, e.callIndex)} (${(g.delta * 100).toFixed(1)} percentage points, ${g.magnitude})` : "", b = r === "share" ? ` · ${p} · ${h}` : "", x = e.status === "complete" || e.status === "zero";
		return {
			point: e,
			x: n,
			segments: u,
			labelDetail: x ? ` · prompt ${Q(e.promptTokens ?? 0)} tokens · ${f}${b} · cache-read share ${m} ${h}${e.note ? ` · ${e.note}` : ""}${v}${y}` : ` · ${e.note}`,
			showsPin: x
		};
	}
	function Se(e, t, n) {
		let r = e.point.callIndex;
		return `Call ${r}${e.showsPin && t === r && n !== r ? " · pinned" : ""}${e.labelDetail}`;
	}
	function Ce(e, n, { domainMaximum: r, baseline: i, innerHeight: a, targetChangesByCall: o }) {
		let s = (e) => e === null ? i : i - e / r * a, c = s(e.total), l = e.high === null ? null : s(e.high), u = o.get(e.callIndex)?.label, d = u ? ` · ${u}.` : "", f = t.indexed.callByIndex.get(e.callIndex)?.costAssessment, p = e.kind === "recorded" ? ` · cost components ${e.componentStatus}` : "";
		return {
			point: e,
			x: n,
			y: c,
			yHigh: l,
			ariaLabel: (e.status === "known" || e.status === "zero") && f ? `Call ${e.callIndex} · ${Yl(f, t.indexed.analysis.session.source)} cost ${Zl(f)} USD${p}${d}` : e.status === "partial" ? `Call ${e.callIndex} · cost unavailable · some recorded cost components are present` : `Call ${e.callIndex} · cost unavailable`
		};
	}
	function we(e) {
		return r() === "share" ? `${e.toFixed(0)}%` : tm(e);
	}
	function Te(e) {
		return Ra(e);
	}
	function Ee(e) {
		return e.shareStatus === "complete" ? e.shareSegments.map((e) => `${e.label} ${Ha(e.percentage / 100)}`).join(" · ") : e.shareStatus === "zeroPrompt" ? "share undefined: zero prompt tokens" : "share unavailable: incomplete or unsupported usage";
	}
	function De(e) {
		Vi(n).getElementById(`economics-call-${e}`)?.focus();
	}
	function Oe(e, n) {
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
		o && (I(ke, o.index), t.onHoverCall(o.index), De(o.index));
	}
	let ke = /* @__PURE__ */ N(() => t.pinnedCallIndex ?? t.indexed.analysis.modelCalls[0]?.index ?? null);
	var Ae = { closeEventBreakdown: _e }, je = Pm(), Me = L(je), Ne = B(L(Me)), Pe = B(Ne), Fe = B(Pe);
	J(Fe, 17, () => H(re), $r, (e, n) => {
		var r = ym(), i = R(r), a = B(i), o = z(a, !0);
		V((e) => {
			Y(i, "x1", f.left), Y(i, "x2", t.width - f.right), Y(i, "y1", H(n).y), Y(i, "y2", H(n).y), Y(a, "x", f.left - 5), Y(a, "y", H(n).y + 3), K(o, e);
		}, [() => t.mode === "cache" ? we(H(n).value) : Te(H(n).value)]), G(e, r);
	});
	var Ie = B(Fe), M = z(Ie), Le = B(Ie), Re = L(Le), ze = B(Re);
	J(ze, 17, () => H(w), (e) => e.callIndex, (e, t) => {
		var n = bm(), r = z(L(n), !0);
		j(n), V(() => {
			Y(n, "x1", H(t).startX), Y(n, "x2", H(t).endX), Y(n, "y1", H(d)), Y(n, "y2", H(d)), K(r, H(t).label);
		}), G(e, n);
	}), J(B(ze), 17, () => H(se), (e) => e.id, (e, t) => {
		let n = /* @__PURE__ */ N(() => H(t).events[0]);
		var r = Sm();
		let i;
		var a = L(r), o = z(a), s = B(a), c = B(s), f = (e) => {
			{
				let r = /* @__PURE__ */ N(() => H(t).x - 11), i = /* @__PURE__ */ N(() => H(d) - 11), a = /* @__PURE__ */ N(() => H(n).kind === "compaction" ? "Compaction" : H(n).kind === "targetChange" ? "Model / provider change" : `Cache-share ${H(n).direction === "drop" ? "drop" : "rise"}`);
				dm(e, {
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
			var n = xm(), r = R(n);
			Y(r, "height", 22);
			var i = B(r), a = z(i, !0);
			V(() => {
				Y(r, "x", H(t).x - H(t).badgeWidth / 2), Y(r, "y", H(d) - 11), Y(r, "width", H(t).badgeWidth), Y(i, "x", H(t).x), Y(i, "y", H(d) + 4), K(a, H(t).badgeLabel);
			}), G(e, n);
		};
		q(c, (e) => {
			H(t).events.length === 1 ? e(f) : e(p, -1);
		}), j(r), V((e, a) => {
			Y(r, "id", H(t).id), i = gi(r, 0, `track-event-trigger ${H(t).events.length === 1 ? "track-event-singleton" : "track-event-cluster"} track-${H(n)?.kind ?? "cluster"} ${H(n)?.kind === "compaction" ? "track-compaction-marker" : H(n)?.kind === "targetChange" ? "track-target-change" : H(n)?.kind === "ratioChange" ? "track-ratioChange ratio-change-marker" : ""}`, "svelte-18b1ucv", i, {
				rise: H(n)?.direction === "rise",
				large: H(n)?.magnitude === "large"
			}), Y(r, "aria-label", e), K(o, `${H(t).compositionLabel ?? ""} at calls ${H(t).callRanges ?? ""} ·
            ${a ?? ""}`), Y(s, "x", H(t).x - H(t).hitWidth / 2), Y(s, "y", H(l) + 6), Y(s, "width", H(t).hitWidth), Y(s, "height", H(u) - 12);
		}, [() => H(t).events.length === 1 ? `${he(H(n))}; activate for details` : `${H(t).compositionLabel} at calls ${H(t).callRanges}; activate for breakdown`, () => H(t).events.map((e) => he(e)).join("; ")]), U("click", r, (e) => {
			e.stopPropagation(), ge(H(t));
		}), U("keydown", r, (e) => k(e, H(t))), G(e, r);
	}), j(Le);
	var Be = B(Le), Ue = (e) => {
		var n = Br();
		J(R(n), 17, () => H(ie), (e) => e.point.callIndex, (e, n) => {
			var r = km();
			let i;
			var a = L(r), o = z(a, !0), s = B(a), c = (e) => {
				var t = Br();
				J(R(t), 19, () => H(n).segments, (e, t) => `${e.kind}-${t}`, (e, t) => {
					var r = Br(), i = R(r), a = (e) => {
						var r = Cm();
						V(() => {
							gi(r, 0, `cache-segment ${H(t).kind}`, "svelte-18b1ucv"), Y(r, "x", H(n).x - H(O) / 2), Y(r, "y", H(t).y), Y(r, "width", H(O)), Y(r, "height", H(t).height);
						}), G(e, r);
					};
					q(i, (e) => {
						H(t).height > 0 && e(a);
					}), G(e, r);
				}), G(e, t);
			}, l = (e) => {
				var t = wm();
				V(() => {
					Y(t, "cx", H(n).x), Y(t, "cy", H(p) - 2);
				}), G(e, t);
			}, u = (e) => {
				var t = Tm();
				V(() => {
					Y(t, "x", H(n).x - 4), Y(t, "y", H(p) - 7);
				}), G(e, t);
			}, d = (e) => {
				var t = Em();
				V(() => Y(t, "d", `M ${H(n).x} ${H(p) - 8} l 5 5 l -5 5 l -5 -5 Z`)), G(e, t);
			};
			q(s, (e) => {
				H(n).point.status === "complete" ? e(c) : H(n).point.status === "zero" ? e(l, 1) : H(n).point.status === "missing" ? e(u, 2) : e(d, -1);
			});
			var m = B(s), h = (e) => {
				var t = Dm();
				V(() => {
					Y(t, "x1", H(n).x), Y(t, "x2", H(n).x), Y(t, "y1", f.top), Y(t, "y2", H(p));
				}), G(e, t);
			};
			q(m, (e) => {
				t.pinnedCallIndex === H(n).point.callIndex && e(h);
			});
			var g = B(m), _ = (e) => {
				var t = Om();
				V(() => {
					Y(t, "x1", H(n).x), Y(t, "x2", H(n).x), Y(t, "y1", f.top), Y(t, "y2", H(p));
				}), G(e, t);
			};
			q(g, (e) => {
				t.hoveredCallIndex === H(n).point.callIndex && e(_);
			}), j(r), V((e, a) => {
				Y(r, "id", `economics-call-${H(n).point.callIndex}`), i = gi(r, 0, "economics-mark cache-mark svelte-18b1ucv", null, i, {
					partial: H(n).point.status === "partial",
					missing: H(n).point.status === "missing",
					unsupported: H(n).point.status === "unsupported",
					zero: H(n).point.status === "zero",
					pinned: t.pinnedCallIndex === H(n).point.callIndex,
					hovered: t.hoveredCallIndex === H(n).point.callIndex
				}), Y(r, "tabindex", H(ke) === H(n).point.callIndex ? 0 : -1), Y(r, "aria-label", e), Y(r, "aria-current", t.pinnedCallIndex === H(n).point.callIndex ? "true" : void 0), K(o, a);
			}, [() => Se(H(n), t.pinnedCallIndex, t.hoveredCallIndex), () => Se(H(n), t.pinnedCallIndex, t.hoveredCallIndex)]), Or("pointerenter", r, () => t.onHoverCall(H(n).point.callIndex)), Or("pointerleave", r, () => t.onHoverCall(null)), Or("focus", r, () => t.onHoverCall(H(n).point.callIndex)), U("keydown", r, (e) => Oe(e, H(n).point.callIndex)), U("click", r, (e) => t.onMarkClick(e, H(n).point.callIndex)), G(e, r);
		}), G(e, n);
	}, We = (e) => {
		var n = Br();
		J(R(n), 17, () => H(ae), (e) => e.point.callIndex, (e, n) => {
			var r = Nm();
			let i;
			var a = L(r), o = z(a, !0), s = B(a), c = (e) => {
				var t = Am();
				V(() => {
					Y(t, "x1", H(n).x), Y(t, "x2", H(n).x), Y(t, "y1", H(n).y), Y(t, "y2", H(n).yHigh);
				}), G(e, t);
			};
			q(s, (e) => {
				H(n).point.status === "known" && H(n).yHigh !== null && e(c);
			});
			var l = B(s), u = (e) => {
				var t = jm(), r = R(t);
				let i;
				var a = B(r);
				let o;
				V(() => {
					i = gi(r, 0, "cost-stem svelte-18b1ucv", null, i, { partial: H(n).point.componentStatus === "partial" }), Y(r, "x1", H(n).x), Y(r, "x2", H(n).x), Y(r, "y1", H(p)), Y(r, "y2", H(n).y), o = gi(a, 0, "cost-dot svelte-18b1ucv", null, o, { partial: H(n).point.componentStatus === "partial" }), Y(a, "cx", H(n).x), Y(a, "cy", H(n).y);
				}), G(e, t);
			}, d = (e) => {
				var t = Mm();
				let r;
				V(() => {
					r = gi(t, 0, "cost-zero svelte-18b1ucv", null, r, { partial: H(n).point.componentStatus === "partial" }), Y(t, "cx", H(n).x), Y(t, "cy", H(p) - 2);
				}), G(e, t);
			}, m = (e) => {
				var t = Em();
				V(() => Y(t, "d", `M ${H(n).x} ${H(p) - 8} l 5 5 l -5 5 l -5 -5 Z`)), G(e, t);
			}, h = (e) => {
				var t = Tm();
				V(() => {
					Y(t, "x", H(n).x - 4), Y(t, "y", H(p) - 7);
				}), G(e, t);
			};
			q(l, (e) => {
				H(n).point.status === "known" ? e(u) : H(n).point.status === "zero" ? e(d, 1) : H(n).point.status === "partial" ? e(m, 2) : e(h, -1);
			});
			var g = B(l), _ = (e) => {
				var t = Dm();
				V(() => {
					Y(t, "x1", H(n).x), Y(t, "x2", H(n).x), Y(t, "y1", f.top), Y(t, "y2", H(p));
				}), G(e, t);
			};
			q(g, (e) => {
				t.pinnedCallIndex === H(n).point.callIndex && e(_);
			});
			var v = B(g), y = (e) => {
				var t = Om();
				V(() => {
					Y(t, "x1", H(n).x), Y(t, "x2", H(n).x), Y(t, "y1", f.top), Y(t, "y2", H(p));
				}), G(e, t);
			};
			q(v, (e) => {
				t.hoveredCallIndex === H(n).point.callIndex && e(y);
			}), j(r), V(() => {
				Y(r, "id", `economics-call-${H(n).point.callIndex}`), i = gi(r, 0, "economics-mark cost-mark svelte-18b1ucv", null, i, {
					partial: H(n).point.status === "partial" || H(n).point.componentStatus === "partial",
					missing: H(n).point.status === "missing",
					zero: H(n).point.status === "zero",
					"api-equivalent": H(n).point.kind === "apiEquivalent",
					pinned: t.pinnedCallIndex === H(n).point.callIndex,
					hovered: t.hoveredCallIndex === H(n).point.callIndex
				}), Y(r, "tabindex", H(ke) === H(n).point.callIndex ? 0 : -1), Y(r, "aria-label", H(n).ariaLabel), Y(r, "aria-current", t.pinnedCallIndex === H(n).point.callIndex ? "true" : void 0), K(o, H(n).ariaLabel);
			}), Or("pointerenter", r, () => t.onHoverCall(H(n).point.callIndex)), Or("focus", r, () => t.onHoverCall(H(n).point.callIndex)), U("keydown", r, (e) => Oe(e, H(n).point.callIndex)), U("click", r, (e) => t.onMarkClick(e, H(n).point.callIndex)), G(e, r);
		}), G(e, n);
	};
	return q(Be, (e) => {
		t.mode === "cache" ? e(Ue) : e(We, -1);
	}), j(Me), j(je), Li(je, (e) => n = e, () => n), V((e, n) => {
		vi(je, `width:${t.width}px`), Y(Me, "viewBox", `0 0 ${t.width} ${H(s)}`), Y(Me, "width", t.width), Y(Me, "height", H(s)), Y(Me, "aria-label", t.mode === "cache" ? "Cache usage track. One keyboard stop; use left and right arrows to inspect calls." : "Cost track. One keyboard stop; use left and right arrows to inspect calls."), Y(Ne, "width", t.width), Y(Ne, "height", H(s)), Y(Pe, "x", f.left), Y(Pe, "y", f.top), Y(Pe, "width", e), Y(Pe, "height", H(m)), Y(M, "x", f.left + 4), Y(M, "y", H(c) + 12), Y(Re, "x", f.left), Y(Re, "y", H(l)), Y(Re, "width", n), Y(Re, "height", H(u));
	}, [() => Math.max(0, t.width - f.left - f.right), () => Math.max(0, t.width - f.left - f.right)]), Or("pointerleave", je, () => t.onHoverCall(null)), G(e, je), He(Ae);
}
kr(["click", "keydown"]);
//#endregion
//#region src/lib/context-river/EconomicsBreakdown.svelte
var Lm = /* @__PURE__ */ W("<button type=\"button\" class=\"svelte-51gj1f\">Compaction details</button>"), Rm = /* @__PURE__ */ W("<li class=\"svelte-51gj1f\"><span class=\"event-list-label svelte-51gj1f\"><!> </span> <span class=\"event-actions svelte-51gj1f\"><!> <button type=\"button\" class=\"svelte-51gj1f\"> </button></span></li>"), zm = /* @__PURE__ */ W("<div class=\"event-breakdown svelte-51gj1f\" role=\"dialog\" tabindex=\"-1\" aria-label=\"Economics event breakdown\"><div class=\"event-breakdown-header svelte-51gj1f\"><strong> </strong> <button type=\"button\" aria-label=\"Close event breakdown\" class=\"svelte-51gj1f\">×</button></div> <button type=\"button\" class=\"zoom-events-button\">Zoom to these calls</button> <ul class=\"svelte-51gj1f\"></ul></div>"), Bm = {
	hash: "svelte-51gj1f",
	code: ".event-breakdown.svelte-51gj1f {position:fixed;z-index:6;width:min(300px, calc(100vw - 16px));max-height:min(220px, calc(100vh - 16px));overflow:auto;padding:8px;color:var(--text);background:var(--surface);border:1px solid var(--control-border);border-radius:var(--control-radius);box-shadow:0 8px 24px var(--shadow);}.event-breakdown-header.svelte-51gj1f,\n  li.svelte-51gj1f {display:flex;align-items:start;justify-content:space-between;gap:8px;}.event-breakdown-header.svelte-51gj1f {color:var(--text-strong);font-size:var(--text-sm);}.event-breakdown-header.svelte-51gj1f button:where(.svelte-51gj1f) {padding:1px 6px;font-size:var(--text-lg);line-height:1.1;}ul.svelte-51gj1f {display:grid;gap:7px;margin:7px 0 0;padding:0;list-style:none;font-size:var(--text-xs);}li.svelte-51gj1f > span:where(.svelte-51gj1f) {min-width:0;overflow-wrap:anywhere;}.event-list-label.svelte-51gj1f {display:inline-flex;align-items:center;gap:4px;}li.svelte-51gj1f button:where(.svelte-51gj1f) {flex:0 0 auto;padding:3px 6px;font-size:10px;white-space:nowrap;}\n  @container highwater (max-width: 620px) {.event-breakdown.svelte-51gj1f {position:static;width:100%;max-height:180px;margin:8px 0 0;}\n  }.event-actions.svelte-51gj1f {display:flex;flex-wrap:wrap;justify-content:flex-end;gap:4px;}"
};
function Vm(e, t) {
	Ve(t, !0), li(e, Bm);
	let n = X(t, "element", 15, null), r = X(t, "positionStyle", 3, ""), i = X(t, "onInspectCompaction", 3, () => {});
	function a(e) {
		e.key === "Escape" && (e.preventDefault(), e.stopPropagation(), t.onClose());
	}
	var o = zm(), s = L(o), c = L(s), l = z(c), u = B(c, 2);
	j(s);
	var d = B(s, 2), f = B(d, 2);
	J(f, 21, () => t.breakdown.events, (e) => e.id, (e, n) => {
		var r = Rm(), a = L(r), o = L(a);
		dm(o, {
			get kind() {
				return H(n).kind;
			},
			get direction() {
				return H(n).direction;
			},
			size: 18
		});
		var s = B(o);
		j(a);
		var c = B(a, 2), l = L(c), u = (e) => {
			var t = Lm();
			U("click", t, () => i()(H(n).callIndex)), G(e, t);
		};
		q(l, (e) => {
			H(n).kind === "compaction" && e(u);
		});
		var d = B(l, 2), f = z(d);
		j(c), j(r), V(() => {
			K(s, `${H(n).label ?? ""} · call
          ${H(n).callIndex ?? ""}`), K(f, `Inspect call ${H(n).callIndex ?? ""}`);
		}), U("click", d, () => t.onInspect(H(n).callIndex)), G(e, r);
	}), j(f), j(o), Li(o, (e) => n(e), () => n()), V((e) => {
		vi(o, r()), K(l, `${t.breakdown.events.length ?? ""}
      ${t.breakdown.events.length === 1 ? "event" : "events"} · calls ${e ?? ""}`), Y(u, "id", `${t.breakdown.id}-close`), d.disabled = !t.canZoomIn || t.breakdown.callIndices.length === 0;
	}, [() => t.breakdown.callIndices.join(", ")]), U("keydown", o, a), U("click", u, function(...e) {
		t.onClose?.apply(this, e);
	}), U("click", d, function(...e) {
		t.onZoom?.apply(this, e);
	}), G(e, o), He();
}
kr(["keydown", "click"]);
//#endregion
//#region src/lib/context-river/GroupBreakdown.svelte
var Hm = /* @__PURE__ */ W("<li> </li>"), Um = /* @__PURE__ */ W("<p class=\"svelte-17hzezc\">Showing the first 12 members.</p>"), Wm = /* @__PURE__ */ W("<div class=\"group-breakdown svelte-17hzezc\" role=\"dialog\" tabindex=\"-1\"><div class=\"event-breakdown-header svelte-17hzezc\"><strong> </strong> <button id=\"group-breakdown-close\" type=\"button\" aria-label=\"Close item type breakdown\" class=\"svelte-17hzezc\">×</button></div> <p class=\"svelte-17hzezc\"> </p> <ul class=\"svelte-17hzezc\"></ul> <!> <button type=\"button\">Show items here</button></div>"), Gm = {
	hash: "svelte-17hzezc",
	code: ".group-breakdown.svelte-17hzezc {position:fixed;box-sizing:border-box;z-index:6;width:min(340px, calc(100vw - 16px));max-height:min(220px, calc(100vh - 16px));overflow:auto;padding:9px;color:var(--text);background:var(--surface);border:1px solid var(--control-border);border-radius:var(--control-radius);box-shadow:0 8px 24px var(--shadow);}.event-breakdown-header.svelte-17hzezc {display:flex;align-items:start;justify-content:space-between;gap:8px;color:var(--text-strong);font-size:var(--text-sm);}.event-breakdown-header.svelte-17hzezc button:where(.svelte-17hzezc) {padding:1px 6px;font-size:var(--text-lg);line-height:1.1;}p.svelte-17hzezc {margin:7px 0;color:var(--text);font-size:var(--text-xs);}ul.svelte-17hzezc {max-height:150px;overflow:auto;margin:7px 0;padding-left:18px;color:var(--text);font-size:var(--text-xs);}"
};
function Km(e, t) {
	Ve(t, !0), li(e, Gm);
	let n, r = /* @__PURE__ */ F(340), i = /* @__PURE__ */ F(220), a = /* @__PURE__ */ F(1280), o = /* @__PURE__ */ F(800), s = /* @__PURE__ */ N(() => Math.max(8, Math.min(t.anchor.x + 8, H(a) - H(r) - 8))), c = /* @__PURE__ */ N(() => Math.max(8, Math.min(t.anchor.y + 8, H(o) - H(i) - 8)));
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
	var u = Wm();
	let d;
	var f = L(u), p = L(f), m = z(p), h = B(p, 2);
	j(f);
	var g = B(f, 2), _ = z(g), v = B(g, 2);
	J(v, 21, () => t.memberLabels, $r, (e, t, n, r) => {
		var i = Hm(), a = z(i, !0);
		V(() => K(a, H(t))), G(e, i);
	}), j(v);
	var y = B(v, 2), b = (e) => {
		G(e, Um());
	};
	q(y, (e) => {
		t.memberCount > 12 && e(b);
	});
	var x = B(y, 2);
	j(u), Li(u, (e) => n = e, () => n), V(() => {
		Y(u, "aria-label", `Item type ${t.label} breakdown`), d = vi(u, "", d, {
			left: `${H(s)}px`,
			top: `${H(c)}px`
		}), K(m, `Item type: ${t.label ?? ""}`), K(_, `${t.memberCount ?? ""}
    ${t.memberCount === 1 ? "member" : "members"}${t.callIndex === null ? "" : ` at call ${t.callIndex}`}.`);
	}), U("keydown", u, l), U("click", h, function(...e) {
		t.onClose?.apply(this, e);
	}), U("click", x, function(...e) {
		t.onShowItems?.apply(this, e);
	}), G(e, u), He();
}
kr(["keydown", "click"]);
//#endregion
//#region src/lib/context-river/overlay-position.ts
function qm(e) {
	return e.querySelector(".economics-track-svg");
}
function Jm(e, t) {
	let n = qm(e);
	if (!n) return null;
	let r = n.getBoundingClientRect(), i = Number(n.getAttribute("width")) || n.viewBox.baseVal.width, a = i > 0 ? r.width / i : 1, o = n.viewBox.baseVal.height > 0 ? r.height / n.viewBox.baseVal.height : 1;
	return {
		x: r.left + t.anchorX * a,
		y: r.top + t.anchorY * o
	};
}
function Ym(e, t) {
	let n = Jm(e, t);
	if (!n) return !1;
	let r = e.getBoundingClientRect(), i = e.parentElement?.getBoundingClientRect(), a = Math.max(0, r.left, i?.left ?? -Infinity), o = Math.min(window.innerWidth, r.right, i?.right ?? Infinity), s = Math.max(0, r.top, i?.top ?? -Infinity), c = Math.min(window.innerHeight, r.bottom, i?.bottom ?? Infinity);
	return o >= a && c >= s && n.x >= a && n.x <= o && n.y >= s && n.y <= c;
}
function Xm(e, t, n) {
	if (!n || !t || window.innerWidth <= 620) return "";
	let r = Jm(e, n), i = qm(e);
	if (!r || !i) return "";
	let a = i.getBoundingClientRect(), o = t.getBoundingClientRect(), s = e.getBoundingClientRect(), c = Math.min(300, Math.max(120, o.width || 300)), l = o.height || 160, u = Math.max(8, s.left + 8), d = Math.max(u, Math.min(window.innerWidth - c - 8, s.right - c - 8)), f = Math.max(u, Math.min(d, r.x - c / 2)), p = i.viewBox.baseVal.height > 0 ? a.height / i.viewBox.baseVal.height : 1, m = a.top + n.laneTop * p, h = a.top + (n.laneTop + n.laneHeight) * p + 8, g = m - l - 8;
	return `left:${f}px;top:${h + l <= window.innerHeight - 8 ? h : g >= 8 ? g : Math.max(8, Math.min(window.innerHeight - l - 8, h))}px;width:${c}px`;
}
//#endregion
//#region src/lib/context-river/EconomicsControls.svelte
var Zm = /* @__PURE__ */ W("<div class=\"toggle-group cache-view-toggle\" role=\"group\" aria-label=\"Cache view\"><span class=\"toggle-label\">Cache view</span> <button type=\"button\">Tokens</button> <button type=\"button\">Share (%)</button><!></div>"), Qm = /* @__PURE__ */ W("<div class=\"economics-track-controls svelte-1x8cxwu\"><div class=\"toggle-group\" role=\"group\" aria-label=\"Economics track\"><span class=\"toggle-label\">Economics</span> <button type=\"button\">Cache</button> <button type=\"button\">Cost</button> <button type=\"button\">Off</button></div> <!> <span class=\"track-title svelte-1x8cxwu\"> </span></div>"), $m = /* @__PURE__ */ W("<span class=\"svelte-1x8cxwu\"><i></i> </span>"), eh = /* @__PURE__ */ W("<span class=\"legend-muted svelte-1x8cxwu\">No supported numeric cache categories</span>"), th = /* @__PURE__ */ W("<span class=\"inline-availability svelte-1x8cxwu\"> </span>"), nh = /* @__PURE__ */ W("<div class=\"track-legend-group svelte-1x8cxwu\" aria-label=\"Token categories\"><span class=\"legend-group-title svelte-1x8cxwu\">Token categories</span> <div class=\"track-legend svelte-1x8cxwu\"></div></div> <!>", 1), rh = /* @__PURE__ */ W("<span class=\"svelte-1x8cxwu\"><i class=\"swatch api-equivalent svelte-1x8cxwu\"></i>API-equivalent (subscription) · USD</span>"), ih = /* @__PURE__ */ W("<div class=\"track-legend-group svelte-1x8cxwu\" aria-label=\"Cost values\"><span class=\"legend-group-title svelte-1x8cxwu\">Cost values</span> <div class=\"track-legend svelte-1x8cxwu\"><span class=\"svelte-1x8cxwu\"><i class=\"swatch cost svelte-1x8cxwu\"></i>Billed · USD</span> <!></div></div>"), ah = /* @__PURE__ */ W("<span class=\"svelte-1x8cxwu\"><!>Share rise/drop</span>"), oh = /* @__PURE__ */ W("<p class=\"availability-summary svelte-1x8cxwu\"> </p>"), sh = /* @__PURE__ */ W("<div class=\"track-legend-groups essential-legend svelte-1x8cxwu\"><!></div> <details class=\"economics-legend svelte-1x8cxwu\"><summary class=\"disclosure svelte-1x8cxwu\">Key</summary> <div class=\"track-legend-group svelte-1x8cxwu\" aria-label=\"Events\"><span class=\"legend-group-title svelte-1x8cxwu\">Events</span> <div class=\"track-legend svelte-1x8cxwu\"><!> <span class=\"svelte-1x8cxwu\"><!>Compaction</span> <span class=\"svelte-1x8cxwu\"><!>Model / provider change</span></div></div> <div class=\"track-legend-group svelte-1x8cxwu\" aria-label=\"Data quality\"><span class=\"legend-group-title svelte-1x8cxwu\">Data quality</span> <div class=\"track-legend svelte-1x8cxwu\"><span class=\"svelte-1x8cxwu\"><i class=\"swatch uncertain svelte-1x8cxwu\"></i>Partial / unsupported</span> <span class=\"svelte-1x8cxwu\"><i class=\"swatch missing svelte-1x8cxwu\"></i>Missing</span> <span class=\"svelte-1x8cxwu\"><i class=\"swatch zero svelte-1x8cxwu\"></i>Measured zero</span></div></div> <!></details>", 1), ch = /* @__PURE__ */ W("<div class=\"economics-track-header svelte-1x8cxwu\" role=\"group\" aria-label=\"Economics track controls and legend\"><button class=\"economics-disclosure disclosure svelte-1x8cxwu\" type=\"button\" aria-controls=\"economics-expanded\"><span>Cache &amp; cost</span></button> <div id=\"economics-expanded\"><!> <!></div></div>"), lh = {
	hash: "svelte-1x8cxwu",
	code: ".economics-disclosure.svelte-1x8cxwu {justify-self:start;display:inline-flex;align-items:center;gap:6px;min-height:28px;padding:4px 0;border:0;border-radius:0;background:transparent;color:var(--secondary);font:inherit;font-size:var(--text-md);}.economics-disclosure.svelte-1x8cxwu:hover {background:transparent;color:var(--text);}.economics-track-header.svelte-1x8cxwu {position:sticky;left:0;z-index:3;display:grid;width:100%;gap:6px;margin:0 0 8px;padding:8px 0;border:0;border-top:1px solid var(--separator);border-radius:0;background:var(--surface);}.economics-track-controls.svelte-1x8cxwu {display:flex;flex-wrap:wrap;align-items:center;gap:7px 14px;color:var(--text);font-size:var(--text-sm);}.economics-legend.svelte-1x8cxwu {min-width:0;color:var(--text);font-size:var(--text-xs);}.economics-legend[open].svelte-1x8cxwu {padding-top:2px;}.economics-legend.svelte-1x8cxwu summary:where(.svelte-1x8cxwu) {width:fit-content;color:var(--secondary);cursor:pointer;}\n  /* Matches the River's legend: 12px text, with each group's title leading its items. */.track-legend-groups.svelte-1x8cxwu {display:flex;flex-wrap:wrap;align-items:start;gap:8px 18px;padding-top:6px;color:var(--text);font-size:var(--text-sm);}.essential-legend.svelte-1x8cxwu {padding:2px 0 0;}.legend-muted.svelte-1x8cxwu,\n  .availability-summary.svelte-1x8cxwu {color:var(--secondary);}.inline-availability.svelte-1x8cxwu {align-self:center;max-width:38rem;color:var(--warning);line-height:1.35;}.availability-summary.svelte-1x8cxwu {margin:6px 0;line-height:1.4;}.track-title.svelte-1x8cxwu {min-width:0;color:var(--text);font-weight:650;overflow-wrap:anywhere;}.track-legend-group.svelte-1x8cxwu {display:flex;flex-wrap:wrap;align-items:center;gap:5px 12px;min-width:0;}.legend-group-title.svelte-1x8cxwu {color:var(--text-strong);font-weight:650;}.track-legend.svelte-1x8cxwu {display:flex;flex-wrap:wrap;gap:5px 12px;align-items:center;}.track-legend.svelte-1x8cxwu span:where(.svelte-1x8cxwu) {display:inline-flex;align-items:center;gap:4px;max-width:100%;overflow-wrap:anywhere;}.swatch.svelte-1x8cxwu {display:inline-block;width:10px;height:10px;border:1px solid var(--text);border-radius:var(--radius-small);flex:0 0 auto;}.swatch.read.svelte-1x8cxwu,\n  .swatch.cacheRead.svelte-1x8cxwu {background:var(--cache-read);}.swatch.write.svelte-1x8cxwu,\n  .swatch.cacheWrite.svelte-1x8cxwu {background:repeating-linear-gradient(\n      135deg,\n      var(--cache-write) 0 3px,\n      var(--cache-write-mark) 3px 4px\n    );}.swatch.fresh.svelte-1x8cxwu {background:radial-gradient(circle, var(--cache-fresh-mark) 1px, var(--cache-fresh) 1.5px);}.swatch.nonread.svelte-1x8cxwu,\n  .swatch.nonRead.svelte-1x8cxwu {background:repeating-linear-gradient(\n      135deg,\n      var(--cache-nonread) 0 3px,\n      var(--cache-nonread-mark) 3px 4px\n    );}.swatch.uncached.svelte-1x8cxwu {background:radial-gradient(circle, var(--cache-fresh-mark) 1px, var(--cache-fresh) 1.5px);}.swatch.uncertain.svelte-1x8cxwu {background:transparent;border-color:var(--warning);transform:rotate(45deg) scale(0.78);}.swatch.change-rise.svelte-1x8cxwu,\n  .swatch.change-drop.svelte-1x8cxwu {display:inline-flex;align-items:center;justify-content:center;width:14px;border:0;color:var(--event-warning-text);background:var(--event-warning);font-size:10px;font-style:normal;font-weight:800;line-height:1;}.swatch.change-drop.svelte-1x8cxwu {margin-left:-4px;}.swatch.compaction.svelte-1x8cxwu,\n  .swatch.target.svelte-1x8cxwu {display:inline-flex;width:16px;justify-content:center;border-color:var(--accent);background:var(--action);color:var(--active-text);font-size:7px;font-style:normal;font-weight:750;}.swatch.target.svelte-1x8cxwu {border-radius:0;transform:rotate(45deg) scale(0.8);}.swatch.missing.svelte-1x8cxwu {background:transparent;border-style:dashed;}.swatch.zero.svelte-1x8cxwu {border-radius:50%;background:transparent;}.swatch.cost.svelte-1x8cxwu {border-radius:50%;background:var(--cost);}.swatch.api-equivalent.svelte-1x8cxwu {border-radius:50%;background:transparent;border-color:var(--api-cost);}\n  @container highwater (max-width: 620px) {.economics-track-controls.svelte-1x8cxwu {align-items:start;}.track-legend.svelte-1x8cxwu {gap:5px 9px;}\n  }"
};
function uh(e, t) {
	Ve(t, !0), li(e, lh);
	let n = X(t, "hasApiEquivalentCost", 3, !1), r = X(t, "headerElement", 15), i = X(t, "triggerElement", 15);
	var a = ch(), o = L(a);
	Li(o, (e) => i(e), () => i());
	var s = B(o, 2), c = L(s), l = (e) => {
		var n = Qm(), r = L(n), i = B(L(r), 2), a = B(i, 2), o = B(a, 2);
		Y(o, "aria-pressed", !1), j(r);
		var s = B(r, 2), c = (e) => {
			var n = Zm(), r = B(L(n), 2), i = B(r, 2);
			_a(B(i), {
				id: "cache-share-note",
				label: "About Share (%)",
				children: (e, t) => {
					Se(), G(e, zr("Shows cache reads, cache writes and fresh input as shares of each call's input\n              tokens. Calls with missing, partial or zero input are marked, not drawn as zero."));
				},
				$$slots: { default: !0 }
			}), j(n), V(() => {
				Y(r, "aria-pressed", t.cacheView === "tokens"), Y(i, "aria-pressed", t.cacheView === "share");
			}), U("click", r, () => t.onCacheViewChange("tokens")), U("click", i, () => t.onCacheViewChange("share")), G(e, n);
		};
		q(s, (e) => {
			t.mode === "cache" && e(c);
		});
		var l = z(B(s, 2), !0);
		j(n), V(() => {
			Y(i, "aria-pressed", t.mode === "cache"), Y(a, "aria-pressed", t.mode === "cost"), K(l, t.mode === "cache" ? t.cacheView === "share" ? "Cache share per call · share of each call's input · fixed 0–100% axis" : "Prompt tokens per call · session-wide scale" : t.mode === "cost" ? "Cost per call · USD · session-wide scale · recorded or estimated, not invoices" : "Economics off · details remain available in the inspector");
		}), U("click", i, () => t.onModeChange("cache")), U("click", a, () => t.onModeChange("cost")), U("click", o, () => t.onModeChange("off")), G(e, n);
	};
	q(c, (e) => {
		t.mode !== "off" && e(l);
	});
	var u = B(c, 2), d = (e) => {
		var r = sh(), i = R(r), a = L(i), o = (e) => {
			var n = nh(), r = R(n), i = B(L(r), 2);
			J(i, 21, () => t.cachePresentation.categories, (e) => e.kind, (e, t) => {
				var n = $m(), r = L(n), i = B(r);
				j(n), V(() => {
					gi(r, 1, `swatch ${H(t).kind}`, "svelte-1x8cxwu"), K(i, `${H(t).label ?? ""}${H(t).availability === "measuredZero" ? " · 0 in this session" : ""}`);
				}), G(e, n);
			}, (e) => {
				G(e, eh());
			}), j(i), j(r), J(B(r, 2), 17, () => t.cachePresentation.notes, $r, (e, t) => {
				var n = th(), r = z(n, !0);
				V(() => K(r, H(t))), G(e, n);
			}), G(e, n);
		}, s = (e) => {
			var t = ih(), r = B(L(t), 2), i = B(L(r), 2), a = (e) => {
				G(e, rh());
			};
			q(i, (e) => {
				n() && e(a);
			}), j(r), j(t), G(e, t);
		};
		q(a, (e) => {
			t.mode === "cache" ? e(o) : e(s, -1);
		}), j(i);
		var c = B(i, 2), l = B(L(c), 2), u = B(L(l), 2), d = L(u), f = (e) => {
			var t = ah();
			dm(L(t), {
				kind: "ratioChange",
				direction: "rise",
				size: 16
			}), Se(), j(t), G(e, t);
		};
		q(d, (e) => {
			t.mode === "cache" && e(f);
		});
		var p = B(d, 2);
		dm(L(p), {
			kind: "compaction",
			size: 16
		}), Se(), j(p);
		var m = B(p, 2);
		dm(L(m), {
			kind: "targetChange",
			size: 16
		}), Se(), j(m), j(u), j(l);
		var h = B(l, 4), g = (e) => {
			var n = oh(), r = z(n);
			V(() => K(r, `Billed calls show the cost the harness recorded, or an estimate at the provider's rate
            when it recorded none. Subscription calls show what they would have cost at the lab's
            API rate; that is not a charge. A shaded bar marks a range. ${t.costCopy.note ?? ""}
            Unavailable values are not zero.`)), G(e, n);
		};
		q(h, (e) => {
			t.mode === "cost" && e(g);
		}), j(c), G(e, r);
	};
	q(u, (e) => {
		t.mode !== "off" && e(d);
	}), j(s), j(a), Li(a, (e) => r(e), () => r()), V(() => {
		Y(o, "aria-expanded", t.mode !== "off"), Y(s, "hidden", t.mode === "off");
	}), U("pointerdown", a, (e) => e.stopPropagation()), U("click", a, (e) => e.stopPropagation()), U("click", o, () => t.onModeChange(t.mode === "off" ? t.lastMode : "off")), G(e, a), He();
}
kr(["pointerdown", "click"]);
//#endregion
//#region src/lib/context-river/hit-testing.ts
function dh(e, t) {
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
function fh(e, t, n, r) {
	return n <= 0 ? 0 : (e - t) / n * r;
}
//#endregion
//#region src/lib/context-river/axis-labels.ts
function ph(e) {
	return String(e).length * 7;
}
function mh(e, t) {
	return (ph(e.callIndex) + ph(t.callIndex)) / 2 + 8;
}
function hh(e, t) {
	return Math.abs(e.x - t.x) < mh(e, t);
}
function gh(e, t, n) {
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
			return r !== void 0 && !hh(n, r);
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
		r && hh(n, r) || i && hh(n, i) || (f.add(t), p = t);
	}
	return f;
}
//#endregion
//#region node_modules/d3-scale/src/init.js
function _h(e, t) {
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
function vh(e, t, n) {
	e.prototype = t.prototype = n, n.constructor = e;
}
function yh(e, t) {
	var n = Object.create(e.prototype);
	for (var r in t) n[r] = t[r];
	return n;
}
//#endregion
//#region node_modules/d3-color/src/color.js
function bh() {}
var xh = .7, Sh = 1 / xh, Ch = "\\s*([+-]?\\d+)\\s*", wh = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*", Th = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*", Eh = /^#([0-9a-f]{3,8})$/, Dh = RegExp(`^rgb\\(${Ch},${Ch},${Ch}\\)$`), Oh = RegExp(`^rgb\\(${Th},${Th},${Th}\\)$`), kh = RegExp(`^rgba\\(${Ch},${Ch},${Ch},${wh}\\)$`), Ah = RegExp(`^rgba\\(${Th},${Th},${Th},${wh}\\)$`), jh = RegExp(`^hsl\\(${wh},${Th},${Th}\\)$`), Mh = RegExp(`^hsla\\(${wh},${Th},${Th},${wh}\\)$`), Nh = {
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
vh(bh, Rh, {
	copy(e) {
		return Object.assign(new this.constructor(), this, e);
	},
	displayable() {
		return this.rgb().displayable();
	},
	hex: Ph,
	formatHex: Ph,
	formatHex8: Fh,
	formatHsl: Ih,
	formatRgb: Lh,
	toString: Lh
});
function Ph() {
	return this.rgb().formatHex();
}
function Fh() {
	return this.rgb().formatHex8();
}
function Ih() {
	return Zh(this).formatHsl();
}
function Lh() {
	return this.rgb().formatRgb();
}
function Rh(e) {
	var t, n;
	return e = (e + "").trim().toLowerCase(), (t = Eh.exec(e)) ? (n = t[1].length, t = parseInt(t[1], 16), n === 6 ? zh(t) : n === 3 ? new Uh(t >> 8 & 15 | t >> 4 & 240, t >> 4 & 15 | t & 240, (t & 15) << 4 | t & 15, 1) : n === 8 ? Bh(t >> 24 & 255, t >> 16 & 255, t >> 8 & 255, (t & 255) / 255) : n === 4 ? Bh(t >> 12 & 15 | t >> 8 & 240, t >> 8 & 15 | t >> 4 & 240, t >> 4 & 15 | t & 240, ((t & 15) << 4 | t & 15) / 255) : null) : (t = Dh.exec(e)) ? new Uh(t[1], t[2], t[3], 1) : (t = Oh.exec(e)) ? new Uh(t[1] * 255 / 100, t[2] * 255 / 100, t[3] * 255 / 100, 1) : (t = kh.exec(e)) ? Bh(t[1], t[2], t[3], t[4]) : (t = Ah.exec(e)) ? Bh(t[1] * 255 / 100, t[2] * 255 / 100, t[3] * 255 / 100, t[4]) : (t = jh.exec(e)) ? Xh(t[1], t[2] / 100, t[3] / 100, 1) : (t = Mh.exec(e)) ? Xh(t[1], t[2] / 100, t[3] / 100, t[4]) : Nh.hasOwnProperty(e) ? zh(Nh[e]) : e === "transparent" ? new Uh(NaN, NaN, NaN, 0) : null;
}
function zh(e) {
	return new Uh(e >> 16 & 255, e >> 8 & 255, e & 255, 1);
}
function Bh(e, t, n, r) {
	return r <= 0 && (e = t = n = NaN), new Uh(e, t, n, r);
}
function Vh(e) {
	return e instanceof bh || (e = Rh(e)), e ? (e = e.rgb(), new Uh(e.r, e.g, e.b, e.opacity)) : new Uh();
}
function Hh(e, t, n, r) {
	return arguments.length === 1 ? Vh(e) : new Uh(e, t, n, r ?? 1);
}
function Uh(e, t, n, r) {
	this.r = +e, this.g = +t, this.b = +n, this.opacity = +r;
}
vh(Uh, Hh, yh(bh, {
	brighter(e) {
		return e = e == null ? Sh : Sh ** +e, new Uh(this.r * e, this.g * e, this.b * e, this.opacity);
	},
	darker(e) {
		return e = e == null ? xh : xh ** +e, new Uh(this.r * e, this.g * e, this.b * e, this.opacity);
	},
	rgb() {
		return this;
	},
	clamp() {
		return new Uh(Jh(this.r), Jh(this.g), Jh(this.b), qh(this.opacity));
	},
	displayable() {
		return -.5 <= this.r && this.r < 255.5 && -.5 <= this.g && this.g < 255.5 && -.5 <= this.b && this.b < 255.5 && 0 <= this.opacity && this.opacity <= 1;
	},
	hex: Wh,
	formatHex: Wh,
	formatHex8: Gh,
	formatRgb: Kh,
	toString: Kh
}));
function Wh() {
	return `#${Yh(this.r)}${Yh(this.g)}${Yh(this.b)}`;
}
function Gh() {
	return `#${Yh(this.r)}${Yh(this.g)}${Yh(this.b)}${Yh((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
}
function Kh() {
	let e = qh(this.opacity);
	return `${e === 1 ? "rgb(" : "rgba("}${Jh(this.r)}, ${Jh(this.g)}, ${Jh(this.b)}${e === 1 ? ")" : `, ${e})`}`;
}
function qh(e) {
	return isNaN(e) ? 1 : Math.max(0, Math.min(1, e));
}
function Jh(e) {
	return Math.max(0, Math.min(255, Math.round(e) || 0));
}
function Yh(e) {
	return e = Jh(e), (e < 16 ? "0" : "") + e.toString(16);
}
function Xh(e, t, n, r) {
	return r <= 0 ? e = t = n = NaN : n <= 0 || n >= 1 ? e = t = NaN : t <= 0 && (e = NaN), new $h(e, t, n, r);
}
function Zh(e) {
	if (e instanceof $h) return new $h(e.h, e.s, e.l, e.opacity);
	if (e instanceof bh || (e = Rh(e)), !e) return new $h();
	if (e instanceof $h) return e;
	e = e.rgb();
	var t = e.r / 255, n = e.g / 255, r = e.b / 255, i = Math.min(t, n, r), a = Math.max(t, n, r), o = NaN, s = a - i, c = (a + i) / 2;
	return s ? (o = t === a ? (n - r) / s + (n < r) * 6 : n === a ? (r - t) / s + 2 : (t - n) / s + 4, s /= c < .5 ? a + i : 2 - a - i, o *= 60) : s = c > 0 && c < 1 ? 0 : o, new $h(o, s, c, e.opacity);
}
function Qh(e, t, n, r) {
	return arguments.length === 1 ? Zh(e) : new $h(e, t, n, r ?? 1);
}
function $h(e, t, n, r) {
	this.h = +e, this.s = +t, this.l = +n, this.opacity = +r;
}
vh($h, Qh, yh(bh, {
	brighter(e) {
		return e = e == null ? Sh : Sh ** +e, new $h(this.h, this.s, this.l * e, this.opacity);
	},
	darker(e) {
		return e = e == null ? xh : xh ** +e, new $h(this.h, this.s, this.l * e, this.opacity);
	},
	rgb() {
		var e = this.h % 360 + (this.h < 0) * 360, t = isNaN(e) || isNaN(this.s) ? 0 : this.s, n = this.l, r = n + (n < .5 ? n : 1 - n) * t, i = 2 * n - r;
		return new Uh(ng(e >= 240 ? e - 240 : e + 120, i, r), ng(e, i, r), ng(e < 120 ? e + 240 : e - 120, i, r), this.opacity);
	},
	clamp() {
		return new $h(eg(this.h), tg(this.s), tg(this.l), qh(this.opacity));
	},
	displayable() {
		return (0 <= this.s && this.s <= 1 || isNaN(this.s)) && 0 <= this.l && this.l <= 1 && 0 <= this.opacity && this.opacity <= 1;
	},
	formatHsl() {
		let e = qh(this.opacity);
		return `${e === 1 ? "hsl(" : "hsla("}${eg(this.h)}, ${tg(this.s) * 100}%, ${tg(this.l) * 100}%${e === 1 ? ")" : `, ${e})`}`;
	}
}));
function eg(e) {
	return e = (e || 0) % 360, e < 0 ? e + 360 : e;
}
function tg(e) {
	return Math.max(0, Math.min(1, e || 0));
}
function ng(e, t, n) {
	return (e < 60 ? t + (n - t) * e / 60 : e < 180 ? n : e < 240 ? t + (n - t) * (240 - e) / 60 : t) * 255;
}
//#endregion
//#region node_modules/d3-interpolate/src/constant.js
var rg = (e) => () => e;
//#endregion
//#region node_modules/d3-interpolate/src/color.js
function ig(e, t) {
	return function(n) {
		return e + n * t;
	};
}
function ag(e, t, n) {
	return e **= +n, t = t ** +n - e, n = 1 / n, function(r) {
		return (e + r * t) ** +n;
	};
}
function og(e) {
	return (e = +e) == 1 ? sg : function(t, n) {
		return n - t ? ag(t, n, e) : rg(isNaN(t) ? n : t);
	};
}
function sg(e, t) {
	var n = t - e;
	return n ? ig(e, n) : rg(isNaN(e) ? t : e);
}
//#endregion
//#region node_modules/d3-interpolate/src/rgb.js
var cg = (function e(t) {
	var n = og(t);
	function r(e, t) {
		var r = n((e = Hh(e)).r, (t = Hh(t)).r), i = n(e.g, t.g), a = n(e.b, t.b), o = sg(e.opacity, t.opacity);
		return function(t) {
			return e.r = r(t), e.g = i(t), e.b = a(t), e.opacity = o(t), e + "";
		};
	}
	return r.gamma = e, r;
})(1);
//#endregion
//#region node_modules/d3-interpolate/src/numberArray.js
function lg(e, t) {
	t ||= [];
	var n = e ? Math.min(t.length, e.length) : 0, r = t.slice(), i;
	return function(a) {
		for (i = 0; i < n; ++i) r[i] = e[i] * (1 - a) + t[i] * a;
		return r;
	};
}
function ug(e) {
	return ArrayBuffer.isView(e) && !(e instanceof DataView);
}
//#endregion
//#region node_modules/d3-interpolate/src/array.js
function dg(e, t) {
	for (var n = t ? t.length : 0, r = e ? Math.min(n, e.length) : 0, i = Array(r), a = Array(n), o = 0; o < r; ++o) i[o] = bg(e[o], t[o]);
	for (; o < n; ++o) a[o] = t[o];
	return function(e) {
		for (o = 0; o < r; ++o) a[o] = i[o](e);
		return a;
	};
}
//#endregion
//#region node_modules/d3-interpolate/src/date.js
function fg(e, t) {
	var n = /* @__PURE__ */ new Date();
	return e = +e, t = +t, function(r) {
		return n.setTime(e * (1 - r) + t * r), n;
	};
}
//#endregion
//#region node_modules/d3-interpolate/src/number.js
function pg(e, t) {
	return e = +e, t = +t, function(n) {
		return e * (1 - n) + t * n;
	};
}
//#endregion
//#region node_modules/d3-interpolate/src/object.js
function mg(e, t) {
	var n = {}, r = {}, i;
	for (i in (typeof e != "object" || !e) && (e = {}), (typeof t != "object" || !t) && (t = {}), t) i in e ? n[i] = bg(e[i], t[i]) : r[i] = t[i];
	return function(e) {
		for (i in n) r[i] = n[i](e);
		return r;
	};
}
//#endregion
//#region node_modules/d3-interpolate/src/string.js
var hg = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g, gg = new RegExp(hg.source, "g");
function _g(e) {
	return function() {
		return e;
	};
}
function vg(e) {
	return function(t) {
		return e(t) + "";
	};
}
function yg(e, t) {
	var n = hg.lastIndex = gg.lastIndex = 0, r, i, a, o = -1, s = [], c = [];
	for (e += "", t += ""; (r = hg.exec(e)) && (i = gg.exec(t));) (a = i.index) > n && (a = t.slice(n, a), s[o] ? s[o] += a : s[++o] = a), (r = r[0]) === (i = i[0]) ? s[o] ? s[o] += i : s[++o] = i : (s[++o] = null, c.push({
		i: o,
		x: pg(r, i)
	})), n = gg.lastIndex;
	return n < t.length && (a = t.slice(n), s[o] ? s[o] += a : s[++o] = a), s.length < 2 ? c[0] ? vg(c[0].x) : _g(t) : (t = c.length, function(e) {
		for (var n = 0, r; n < t; ++n) s[(r = c[n]).i] = r.x(e);
		return s.join("");
	});
}
//#endregion
//#region node_modules/d3-interpolate/src/value.js
function bg(e, t) {
	var n = typeof t, r;
	return t == null || n === "boolean" ? rg(t) : (n === "number" ? pg : n === "string" ? (r = Rh(t)) ? (t = r, cg) : yg : t instanceof Rh ? cg : t instanceof Date ? fg : ug(t) ? lg : Array.isArray(t) ? dg : typeof t.valueOf != "function" && typeof t.toString != "function" || isNaN(t) ? mg : pg)(e, t);
}
//#endregion
//#region node_modules/d3-interpolate/src/round.js
function xg(e, t) {
	return e = +e, t = +t, function(n) {
		return Math.round(e * (1 - n) + t * n);
	};
}
//#endregion
//#region node_modules/d3-scale/src/constant.js
function Sg(e) {
	return function() {
		return e;
	};
}
//#endregion
//#region node_modules/d3-scale/src/number.js
function Cg(e) {
	return +e;
}
//#endregion
//#region node_modules/d3-scale/src/continuous.js
var wg = [0, 1];
function Tg(e) {
	return e;
}
function Eg(e, t) {
	return (t -= e = +e) ? function(n) {
		return (n - e) / t;
	} : Sg(isNaN(t) ? NaN : .5);
}
function Dg(e, t) {
	var n;
	return e > t && (n = e, e = t, t = n), function(n) {
		return Math.max(e, Math.min(t, n));
	};
}
function Og(e, t, n) {
	var r = e[0], i = e[1], a = t[0], o = t[1];
	return i < r ? (r = Eg(i, r), a = n(o, a)) : (r = Eg(r, i), a = n(a, o)), function(e) {
		return a(r(e));
	};
}
function kg(e, t, n) {
	var r = Math.min(e.length, t.length) - 1, i = Array(r), a = Array(r), o = -1;
	for (e[r] < e[0] && (e = e.slice().reverse(), t = t.slice().reverse()); ++o < r;) i[o] = Eg(e[o], e[o + 1]), a[o] = n(t[o], t[o + 1]);
	return function(t) {
		var n = Hp(e, t, 1, r) - 1;
		return a[n](i[n](t));
	};
}
function Ag(e, t) {
	return t.domain(e.domain()).range(e.range()).interpolate(e.interpolate()).clamp(e.clamp()).unknown(e.unknown());
}
function jg() {
	var e = wg, t = wg, n = bg, r, i, a, o = Tg, s, c, l;
	function u() {
		var n = Math.min(e.length, t.length);
		return o !== Tg && (o = Dg(e[0], e[n - 1])), s = n > 2 ? kg : Og, c = l = null, d;
	}
	function d(i) {
		return i == null || isNaN(i = +i) ? a : (c ||= s(e.map(r), t, n))(r(o(i)));
	}
	return d.invert = function(n) {
		return o(i((l ||= s(t, e.map(r), pg))(n)));
	}, d.domain = function(t) {
		return arguments.length ? (e = Array.from(t, Cg), u()) : e.slice();
	}, d.range = function(e) {
		return arguments.length ? (t = Array.from(e), u()) : t.slice();
	}, d.rangeRound = function(e) {
		return t = Array.from(e), n = xg, u();
	}, d.clamp = function(e) {
		return arguments.length ? (o = e ? !0 : Tg, u()) : o !== Tg;
	}, d.interpolate = function(e) {
		return arguments.length ? (n = e, u()) : n;
	}, d.unknown = function(e) {
		return arguments.length ? (a = e, d) : a;
	}, function(e, t) {
		return r = e, i = t, u();
	};
}
function Mg() {
	return jg()(Tg, Tg);
}
//#endregion
//#region node_modules/d3-format/src/formatDecimal.js
function Ng(e) {
	return Math.abs(e = Math.round(e)) >= 1e21 ? e.toLocaleString("en").replace(/,/g, "") : e.toString(10);
}
function Pg(e, t) {
	if (!isFinite(e) || e === 0) return null;
	var n = (e = t ? e.toExponential(t - 1) : e.toExponential()).indexOf("e"), r = e.slice(0, n);
	return [r.length > 1 ? r[0] + r.slice(2) : r, +e.slice(n + 1)];
}
//#endregion
//#region node_modules/d3-format/src/exponent.js
function Fg(e) {
	return e = Pg(Math.abs(e)), e ? e[1] : NaN;
}
//#endregion
//#region node_modules/d3-format/src/formatGroup.js
function Ig(e, t) {
	return function(n, r) {
		for (var i = n.length, a = [], o = 0, s = e[0], c = 0; i > 0 && s > 0 && (c + s + 1 > r && (s = Math.max(1, r - c)), a.push(n.substring(i -= s, i + s)), !((c += s + 1) > r));) s = e[o = (o + 1) % e.length];
		return a.reverse().join(t);
	};
}
//#endregion
//#region node_modules/d3-format/src/formatNumerals.js
function Lg(e) {
	return function(t) {
		return t.replace(/[0-9]/g, function(t) {
			return e[+t];
		});
	};
}
//#endregion
//#region node_modules/d3-format/src/formatSpecifier.js
var Rg = /^(?:(.)?([<>=^]))?([+\-( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?(~)?([a-z%])?$/i;
function zg(e) {
	if (!(t = Rg.exec(e))) throw Error("invalid format: " + e);
	var t;
	return new Bg({
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
zg.prototype = Bg.prototype;
function Bg(e) {
	this.fill = e.fill === void 0 ? " " : e.fill + "", this.align = e.align === void 0 ? ">" : e.align + "", this.sign = e.sign === void 0 ? "-" : e.sign + "", this.symbol = e.symbol === void 0 ? "" : e.symbol + "", this.zero = !!e.zero, this.width = e.width === void 0 ? void 0 : +e.width, this.comma = !!e.comma, this.precision = e.precision === void 0 ? void 0 : +e.precision, this.trim = !!e.trim, this.type = e.type === void 0 ? "" : e.type + "";
}
Bg.prototype.toString = function() {
	return this.fill + this.align + this.sign + this.symbol + (this.zero ? "0" : "") + (this.width === void 0 ? "" : Math.max(1, this.width | 0)) + (this.comma ? "," : "") + (this.precision === void 0 ? "" : "." + Math.max(0, this.precision | 0)) + (this.trim ? "~" : "") + this.type;
};
//#endregion
//#region node_modules/d3-format/src/formatTrim.js
function Vg(e) {
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
var Hg;
function Ug(e, t) {
	var n = Pg(e, t);
	if (!n) return Hg = void 0, e.toPrecision(t);
	var r = n[0], i = n[1], a = i - (Hg = Math.max(-8, Math.min(8, Math.floor(i / 3))) * 3) + 1, o = r.length;
	return a === o ? r : a > o ? r + Array(a - o + 1).join("0") : a > 0 ? r.slice(0, a) + "." + r.slice(a) : "0." + Array(1 - a).join("0") + Pg(e, Math.max(0, t + a - 1))[0];
}
//#endregion
//#region node_modules/d3-format/src/formatRounded.js
function Wg(e, t) {
	var n = Pg(e, t);
	if (!n) return e + "";
	var r = n[0], i = n[1];
	return i < 0 ? "0." + Array(-i).join("0") + r : r.length > i + 1 ? r.slice(0, i + 1) + "." + r.slice(i + 1) : r + Array(i - r.length + 2).join("0");
}
//#endregion
//#region node_modules/d3-format/src/formatTypes.js
var Gg = {
	"%": (e, t) => (e * 100).toFixed(t),
	b: (e) => Math.round(e).toString(2),
	c: (e) => e + "",
	d: Ng,
	e: (e, t) => e.toExponential(t),
	f: (e, t) => e.toFixed(t),
	g: (e, t) => e.toPrecision(t),
	o: (e) => Math.round(e).toString(8),
	p: (e, t) => Wg(e * 100, t),
	r: Wg,
	s: Ug,
	X: (e) => Math.round(e).toString(16).toUpperCase(),
	x: (e) => Math.round(e).toString(16)
};
//#endregion
//#region node_modules/d3-format/src/identity.js
function Kg(e) {
	return e;
}
//#endregion
//#region node_modules/d3-format/src/locale.js
var qg = Array.prototype.map, Jg = [
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
function Yg(e) {
	var t = e.grouping === void 0 || e.thousands === void 0 ? Kg : Ig(qg.call(e.grouping, Number), e.thousands + ""), n = e.currency === void 0 ? "" : e.currency[0] + "", r = e.currency === void 0 ? "" : e.currency[1] + "", i = e.decimal === void 0 ? "." : e.decimal + "", a = e.numerals === void 0 ? Kg : Lg(qg.call(e.numerals, String)), o = e.percent === void 0 ? "%" : e.percent + "", s = e.minus === void 0 ? "−" : e.minus + "", c = e.nan === void 0 ? "NaN" : e.nan + "";
	function l(e, l) {
		e = zg(e);
		var u = e.fill, d = e.align, f = e.sign, p = e.symbol, m = e.zero, h = e.width, g = e.comma, _ = e.precision, v = e.trim, y = e.type;
		y === "n" ? (g = !0, y = "g") : Gg[y] || (_ === void 0 && (_ = 12), v = !0, y = "g"), (m || u === "0" && d === "=") && (m = !0, u = "0", d = "=");
		var b = (l && l.prefix !== void 0 ? l.prefix : "") + (p === "$" ? n : p === "#" && /[boxX]/.test(y) ? "0" + y.toLowerCase() : ""), x = (p === "$" ? r : /[%p]/.test(y) ? o : "") + (l && l.suffix !== void 0 ? l.suffix : ""), S = Gg[y], ee = /[defgprs%]/.test(y);
		_ = _ === void 0 ? 6 : /[gprs]/.test(y) ? Math.max(1, Math.min(21, _)) : Math.max(0, Math.min(20, _));
		function C(e) {
			var n = b, r = x, o, l, p;
			if (y === "c") r = S(e) + r, e = "";
			else {
				e = +e;
				var C = e < 0 || 1 / e < 0;
				if (e = isNaN(e) ? c : S(Math.abs(e), _), v && (e = Vg(e)), C && +e == 0 && f !== "+" && (C = !1), n = (C ? f === "(" ? f : s : f === "-" || f === "(" ? "" : f) + n, r = (y === "s" && !isNaN(e) && Hg !== void 0 ? Jg[8 + Hg / 3] : "") + r + (C && f === "(" ? ")" : ""), ee) {
					for (o = -1, l = e.length; ++o < l;) if (p = e.charCodeAt(o), 48 > p || p > 57) {
						r = (p === 46 ? i + e.slice(o + 1) : e.slice(o)) + r, e = e.slice(0, o);
						break;
					}
				}
			}
			g && !m && (e = t(e, Infinity));
			var te = n.length + e.length + r.length, w = te < h ? Array(h - te + 1).join(u) : "";
			switch (g && m && (e = t(w + e, w.length ? h - r.length : Infinity), w = ""), d) {
				case "<":
					e = n + e + r + w;
					break;
				case "=":
					e = n + w + e + r;
					break;
				case "^":
					e = w.slice(0, te = w.length >> 1) + n + e + r + w.slice(te);
					break;
				default: e = w + n + e + r;
			}
			return a(e);
		}
		return C.toString = function() {
			return e + "";
		}, C;
	}
	function u(e, t) {
		var n = Math.max(-8, Math.min(8, Math.floor(Fg(t) / 3))) * 3, r = 10 ** -n, i = l((e = zg(e), e.type = "f", e), { suffix: Jg[8 + n / 3] });
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
var Xg, Zg, Qg;
$g({
	thousands: ",",
	grouping: [3],
	currency: ["$", ""]
});
function $g(e) {
	return Xg = Yg(e), Zg = Xg.format, Qg = Xg.formatPrefix, Xg;
}
//#endregion
//#region node_modules/d3-format/src/precisionFixed.js
function e_(e) {
	return Math.max(0, -Fg(Math.abs(e)));
}
//#endregion
//#region node_modules/d3-format/src/precisionPrefix.js
function t_(e, t) {
	return Math.max(0, Math.max(-8, Math.min(8, Math.floor(Fg(t) / 3))) * 3 - Fg(Math.abs(e)));
}
//#endregion
//#region node_modules/d3-format/src/precisionRound.js
function n_(e, t) {
	return e = Math.abs(e), t = Math.abs(t) - e, Math.max(0, Fg(t) - Fg(e)) + 1;
}
//#endregion
//#region node_modules/d3-scale/src/tickFormat.js
function r_(e, t, n, r) {
	var i = Yp(e, t, n), a;
	switch (r = zg(r ?? ",f"), r.type) {
		case "s":
			var o = Math.max(Math.abs(e), Math.abs(t));
			return r.precision == null && !isNaN(a = t_(i, o)) && (r.precision = a), Qg(r, o);
		case "":
		case "e":
		case "g":
		case "p":
		case "r":
			r.precision == null && !isNaN(a = n_(i, Math.max(Math.abs(e), Math.abs(t)))) && (r.precision = a - (r.type === "e"));
			break;
		case "f":
		case "%": r.precision == null && !isNaN(a = e_(i)) && (r.precision = a - (r.type === "%") * 2);
	}
	return Zg(r);
}
//#endregion
//#region node_modules/d3-scale/src/linear.js
function i_(e) {
	var t = e.domain;
	return e.ticks = function(e) {
		var n = t();
		return qp(n[0], n[n.length - 1], e ?? 10);
	}, e.tickFormat = function(e, n) {
		var r = t();
		return r_(r[0], r[r.length - 1], e ?? 10, n);
	}, e.nice = function(n) {
		n ??= 10;
		var r = t(), i = 0, a = r.length - 1, o = r[i], s = r[a], c, l, u = 10;
		for (s < o && (l = o, o = s, s = l, l = i, i = a, a = l); u-- > 0;) {
			if (l = Jp(o, s, n), l === c) return r[i] = o, r[a] = s, t(r);
			if (l > 0) o = Math.floor(o / l) * l, s = Math.ceil(s / l) * l;
			else if (l < 0) o = Math.ceil(o * l) / l, s = Math.floor(s * l) / l;
			else break;
			c = l;
		}
		return e;
	}, e;
}
function a_() {
	var e = Mg();
	return e.copy = function() {
		return Ag(e, a_());
	}, _h.apply(e, arguments), i_(e);
}
//#endregion
//#region src/lib/context-river/compaction-merge.ts
function o_(e, t, n, r, i, a, o) {
	let s = Math.max(0, Math.min(o, (r - e) / 2)), c = e + s, l = r - s, u = (t + n) / 2, d = (i + a) / 2;
	return {
		path: `M ${e} ${u} C ${c} ${u}, ${l} ${d}, ${r} ${d}`,
		mergePath: n > t && a > i ? `M ${e} ${t} C ${c} ${t}, ${l} ${i}, ${r} ${i} L ${r} ${a} C ${l} ${a}, ${c} ${n}, ${e} ${n} Z` : ""
	};
}
//#endregion
//#region src/lib/context-river/layout.ts
function s_(e, t) {
	return ll().x((e) => e.x).y0((e) => e.y0).y1((e) => e.y1).curve(t ? al : hl)(c_(e)) ?? "";
}
function c_(e) {
	if (e.length < 3) return e;
	let t = [e[0]];
	for (let n = 1; n < e.length - 1; n += 1) {
		let r = e[n - 1], i = e[n], a = e[n + 1];
		(r.y0 !== i.y0 || i.y0 !== a.y0 || r.y1 !== i.y1 || i.y1 !== a.y1) && t.push(i);
	}
	return t.push(e[e.length - 1]), t;
}
function l_(e) {
	return (e.y0 + e.y1) / 2;
}
function u_(e) {
	let t = [...new Set(e)].sort((e, t) => e - t), n = [];
	for (let e of t) {
		let t = n[n.length - 1];
		t && e === t[t.length - 1] + 1 ? t.push(e) : n.push([e]);
	}
	return n;
}
function d_(e, t, n) {
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
function f_(e, t, n) {
	return e.itemById.has(n) ? e.analysis.displayWeightUnit === "calculatedTokens" || e.analysis.displayWeightUnit === "estimatedTokens" ? e.itemEstimateByProfile.get(n)?.get(t.tokenizationProfileId ?? "")?.tokens ?? 0 : 1 : 0;
}
function p_(e, t, n) {
	let r = e.analysis.modelCalls, i = Math.max(0, t - n.left - n.right);
	if (r.length === 0 || i === 0) return [];
	let a = r.length > 1 ? i / (r.length - 1) : i;
	return r.map((t, o) => ({
		callIndex: t.index,
		x: r.length > 1 ? n.left + o * a : n.left + i / 2,
		totalDisplayWeight: t.contextItemIds.reduce((n, r) => n + f_(e, t, r), 0)
	}));
}
function m_(e) {
	return e.reduce((e, t) => t.y1 > t.y0 ? Math.min(e, t.y1 - t.y0) : e, Infinity);
}
function h_(e, t, n) {
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
	let u = n ? [...n] : p_(e, t.width, t.margin), d = s > 1 ? a / (s - 1) : a, f = new Map(u.map((e) => [e.callIndex, e.x])), p = Math.max(0, ...u.map((e) => e.totalDisplayWeight)), m = t.verticalDomainMax ?? p, h = Number.isFinite(m) && m >= 0 ? m : p, g = a_().domain([0, Math.max(1, h)]).range([t.margin.top + o, t.margin.top]), _ = /* @__PURE__ */ new Map(), v = /* @__PURE__ */ new Map();
	for (let n of r.modelCalls) {
		let r = 0, i = c ? [...l.entries()].map(([e, t]) => ({
			key: `kind:${e}`,
			memberItemIds: t
		})) : (e.orderedItemIdsByCall.get(n.index) ?? []).map((e) => ({
			key: e,
			memberItemIds: [e]
		}));
		for (let a of i) {
			let i = a.memberItemIds.reduce((t, r) => t + (e.contextSetByCall.get(n.index)?.has(r) ? f_(e, n, r) : 0), 0);
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
		let a = u_(r.modelCalls.filter((t) => i.some((n) => e.contextSetByCall.get(t.index)?.has(n))).map((e) => e.index));
		for (let [e, r] of a.entries()) {
			let a = r.flatMap((e) => {
				let t = _.get(`kind:${n}`)?.get(e);
				return t ? [t] : [];
			});
			if (a.length === 0) continue;
			let o = d_(a, d, t), s = m_(o), c = s < t.minimumVisibleThickness, l = s_(o, !1);
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
			let e = o[o.length - 1], t = l_(e);
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
		})), o = o.length === 1 && l ? [d_(o, d, t)[0], o[0]] : d_(o, d, t);
		let m = m_(o), h = m < t.minimumVisibleThickness, g = s_(o, s);
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
		let r = l_(n), i = y(t.beforeModelCall);
		return (e.incomingLineage.get(t.summaryItemId) ?? []).filter((e) => e.kind === "frameworkCompaction" && t.sourceItemIds.includes(e.from)).flatMap((e) => {
			let a = _.get(e.from)?.get(t.beforeModelCall - 1);
			if (!a) return [];
			let o = l_(a), s = Math.max(8, Math.min(d * .25, 24));
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
				...o_(a.x, a.y0, a.y1, i, n.y0, n.y1, s)
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
function g_(e, t, n, r) {
	let i = t - r.left - r.right, a = Math.max(0, n - r.left - r.right);
	if (a === 0 || i <= 0) return [];
	let o = a / i;
	return e.map((e) => ({
		...e,
		x: r.left + (e.x - r.left) * o
	}));
}
function __(e, t, n, r) {
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
	let c = g_(e.columns, t, n, r), l = new Map(c.map((e) => [e.callIndex, e.x])), u = c.length > 1 ? i / (c.length - 1) : i, d = (e) => {
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
		let i = s_(r, e.linear === !0);
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
			...o_(e.sourceX, e.sourceY0, e.sourceY1, t, e.summaryY0, e.summaryY1, h)
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
function v_(e, t, n) {
	return !Number.isFinite(n.left) || !Number.isFinite(n.right) || n.right < n.left ? !1 : t.some((t) => {
		if (t.itemId !== e || t.points.length === 0) return !1;
		let r = Infinity, i = -Infinity;
		for (let e of t.points) Number.isFinite(e.x) && (r = Math.min(r, e.x), i = Math.max(i, e.x));
		return i >= n.left && r <= n.right;
	});
}
function y_(e, t) {
	return e.some((e) => e.startCall <= t && t <= e.endCall);
}
function b_(e, t, n, r = null) {
	if (r !== null && y_(e, r)) return t.some((e) => e.callIndex === r) ? r : null;
	if (e.length === 0 || t.length === 0) return null;
	let i = Number.isFinite(n) ? n : r === null ? NaN : t.find((e) => e.callIndex === r)?.x ?? NaN;
	if (!Number.isFinite(i)) return null;
	let a = null;
	for (let n of t) {
		if (!y_(e, n.callIndex) || !Number.isFinite(n.x)) continue;
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
function x_() {
	return {
		pointers: [],
		gesture: null,
		suppressClick: !1
	};
}
function S_(e, t) {
	return M_(e, t);
}
function C_(e, t) {
	return e.filter((e) => e.pointerId !== t);
}
function w_(e, t) {
	let n = t ? t.map((t) => e.find((e) => e.pointerId === t)) : e.slice(0, 2);
	if (n.length < 2 || n.some((e) => e === void 0)) return null;
	let r = n[0], i = n[1];
	return {
		x: (r.x + i.x) / 2,
		y: (r.y + i.y) / 2
	};
}
function T_(e, t, n) {
	if (t.pointerType === "mouse" && t.button !== 0 && t.button !== 1) return {
		state: e,
		effects: []
	};
	let r = M_(e.pointers, t), i = {
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
			startDistance: Math.max(1, N_(e, t)),
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
function E_(e, t, n) {
	if (!e.pointers.some((e) => e.pointerId === t.pointerId)) return {
		state: e,
		effects: []
	};
	let r = M_(e.pointers, t), i = {
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
		let o = w_(r, a.pointerIds);
		return o ? {
			state: i,
			effects: [{
				kind: "pinch-zoom",
				centerX: o.x,
				distance: Math.max(1, N_(e, n)),
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
function D_(e, t, n) {
	if (!e.pointers.some((e) => e.pointerId === t)) return {
		state: e,
		effects: []
	};
	let r = C_(e.pointers, t), i = [{ kind: "clear-selection" }], a = e.gesture, o = a, s = e.suppressClick;
	if (a?.kind === "pinch") {
		if (s = !0, i.push({ kind: "suppress-click" }), a.pointerIds.includes(t)) {
			let e = w_(r);
			o = r.length >= 2 && e && n.pinchAnchor ? {
				kind: "pinch",
				pointerIds: [r[0].pointerId, r[1].pointerId],
				startDistance: Math.max(1, N_(r[0], r[1])),
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
function O_(e, t) {
	return e.pointers.some((e) => e.pointerId === t) ? {
		state: x_(),
		effects: [{ kind: "clear-selection" }, {
			kind: "release",
			pointerIds: e.pointers.map((e) => e.pointerId)
		}]
	} : {
		state: e,
		effects: []
	};
}
function k_(e) {
	return e.pointers.length === 0 && e.gesture === null ? {
		state: x_(),
		effects: []
	} : {
		state: x_(),
		effects: [{ kind: "clear-selection" }, {
			kind: "release",
			pointerIds: e.pointers.map((e) => e.pointerId)
		}]
	};
}
function A_(e) {
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
function j_(e) {
	return e.suppressClick ? {
		...e,
		suppressClick: !1
	} : e;
}
function M_(e, t) {
	let n = e.findIndex((e) => e.pointerId === t.pointerId);
	return n < 0 ? [...e, t] : e.map((e, r) => r === n ? t : e);
}
function N_(e, t) {
	return Math.hypot(t.x - e.x, t.y - e.y);
}
//#endregion
//#region src/lib/context-river/ContextRiver.svelte
var P_ = 0, F_ = /* @__PURE__ */ W("<div class=\"toggle-group\" role=\"group\" aria-label=\"Vertical scale\"><span class=\"toggle-label\">Vertical scale</span> <button type=\"button\">Session scale</button> <button type=\"button\">Visible calls</button></div> <div class=\"toggle-group\" role=\"group\" aria-label=\"River display\"><span class=\"toggle-label\">Display</span> <button type=\"button\">Items</button> <button type=\"button\">Item types</button></div>", 1), I_ = /* @__PURE__ */ W("<div class=\"vertical-scale-controls compact svelte-13ao2q1\"><!></div>"), L_ = /* @__PURE__ */ W("<div class=\"vertical-scale-controls svelte-13ao2q1\"><!></div>"), R_ = /* @__PURE__ */ W("<span> </span>"), z_ = /* @__PURE__ */ Rr("<path fill=\"black\" vector-effect=\"non-scaling-stroke\"></path>"), B_ = /* @__PURE__ */ Rr("<path fill=\"black\"></path>"), V_ = /* @__PURE__ */ Rr("<pattern width=\"8\" height=\"8\" patternUnits=\"userSpaceOnUse\"><rect width=\"8\" height=\"8\" fill=\"var(--input-gap-base)\" opacity=\".08\"></rect><path d=\"M-2 2L2-2M0 8L8 0M6 10L10 6\" stroke=\"var(--input-gap)\" stroke-width=\"1\" opacity=\".45\"></path></pattern><mask maskUnits=\"userSpaceOnUse\" style=\"mask-type:luminance\"><rect fill=\"white\"></rect><g><!><!></g></mask>", 1), H_ = /* @__PURE__ */ Rr("<linearGradient gradientUnits=\"userSpaceOnUse\"><stop offset=\"0%\"></stop><stop offset=\"100%\"></stop></linearGradient>"), U_ = /* @__PURE__ */ Rr("<line class=\"weight-gridline svelte-13ao2q1\"></line>"), W_ = /* @__PURE__ */ Rr("<line class=\"column-guide svelte-13ao2q1\"></line>"), G_ = /* @__PURE__ */ Rr("<g class=\"compaction-marker svelte-13ao2q1\"><title> </title><line class=\"svelte-13ao2q1\"></line><text class=\"svelte-13ao2q1\"> </text></g>"), K_ = /* @__PURE__ */ Rr("<path class=\"compaction-merge svelte-13ao2q1\" aria-hidden=\"true\"></path>"), q_ = /* @__PURE__ */ Rr("<title> </title>"), J_ = /* @__PURE__ */ Rr("<g><path vector-effect=\"non-scaling-stroke\"></path><path class=\"ribbon-hit svelte-13ao2q1\" vector-effect=\"non-scaling-stroke\" pointer-events=\"fill\" role=\"button\"><!></path></g>"), Y_ = /* @__PURE__ */ Rr("<path class=\"unreconciled-input\"></path>"), X_ = /* @__PURE__ */ Rr("<!><path class=\"reported-input-line svelte-13ao2q1\"></path>", 1), Z_ = /* @__PURE__ */ Rr("<g class=\"reported-input-overlay svelte-13ao2q1\" aria-hidden=\"true\" data-testid=\"reported-input-overlay\"></g>"), Q_ = /* @__PURE__ */ Rr("<g role=\"button\"><rect width=\"44\" height=\"38\" class=\"svelte-13ao2q1\"></rect><text text-anchor=\"middle\" class=\"svelte-13ao2q1\"> </text></g>"), $_ = /* @__PURE__ */ Rr("<path class=\"lineage-connector visible svelte-13ao2q1\" vector-effect=\"non-scaling-stroke\"></path>"), ev = /* @__PURE__ */ Rr("<path></path><!>", 1), tv = /* @__PURE__ */ Rr("<path class=\"ribbon-emphasis hovered svelte-13ao2q1\" vector-effect=\"non-scaling-stroke\"></path>"), nv = /* @__PURE__ */ Rr("<path class=\"ribbon-emphasis selected svelte-13ao2q1\" vector-effect=\"non-scaling-stroke\"></path>"), rv = /* @__PURE__ */ Rr("<line class=\"version-mark svelte-13ao2q1\" vector-effect=\"non-scaling-stroke\"></line>"), iv = /* @__PURE__ */ Rr("<rect class=\"zoom-selection svelte-13ao2q1\"></rect>"), av = /* @__PURE__ */ Rr("<line class=\"crosshair svelte-13ao2q1\"></line>"), ov = /* @__PURE__ */ Rr("<line class=\"pin-line svelte-13ao2q1\"></line>"), sv = /* @__PURE__ */ W("<div role=\"status\"><strong class=\"svelte-13ao2q1\"> </strong> <span> </span> <span> </span></div>"), cv = /* @__PURE__ */ W("<span class=\"svelte-13ao2q1\"><i class=\"svelte-13ao2q1\"></i> </span>"), lv = /* @__PURE__ */ W("<div class=\"group-type-legend svelte-13ao2q1\" role=\"group\" aria-label=\"Item type legend\"><strong class=\"svelte-13ao2q1\">Item types</strong> <!></div>"), uv = /* @__PURE__ */ W("<span class=\"svelte-13ao2q1\"><i class=\"input-gap-key svelte-13ao2q1\"></i>Unreconciled input<!></span>"), dv = /* @__PURE__ */ W("<span class=\"input-comparison-readout svelte-13ao2q1\"> <!> tokens</span>"), fv = /* @__PURE__ */ W("<span class=\"input-comparison-readout svelte-13ao2q1\"> </span>"), pv = /* @__PURE__ */ W("<span class=\"input-comparison-readout svelte-13ao2q1\">Hover or pin a call to compare its estimated and reported input.</span>"), mv = /* @__PURE__ */ W("<div class=\"input-reference-legend svelte-13ao2q1\" role=\"group\" aria-label=\"Input reference legend\"><span class=\"svelte-13ao2q1\"><i class=\"input-reference-key svelte-13ao2q1\"></i>Reported input</span> <!> <!></div>"), hv = /* @__PURE__ */ W("<div class=\"economics-readout svelte-13ao2q1\" aria-label=\"Economics call readout\"> </div>"), gv = /* @__PURE__ */ W("<!> <div class=\"chart-frame svelte-13ao2q1\"><div class=\"chart-plot svelte-13ao2q1\"><div class=\"vertical-axis-overlay svelte-13ao2q1\" role=\"img\"></div> <div class=\"river-scroll svelte-13ao2q1\" data-testid=\"river-host\" role=\"application\" tabindex=\"0\" aria-label=\"Context River\" aria-describedby=\"context-river-description\"><span id=\"context-river-description\" class=\"sr-only\"> </span>  <div class=\"river-canvas svelte-13ao2q1\"><svg class=\"river-plot svelte-13ao2q1\"><defs><!><!><pattern id=\"unknown-geometry\" width=\"8\" height=\"8\" patternUnits=\"userSpaceOnUse\"><rect width=\"8\" height=\"8\" fill=\"var(--unknown-fill)\"></rect><path d=\"M0 0V8\" stroke=\"var(--unknown-mark)\" stroke-width=\"2\" opacity=\".65\"></path></pattern></defs><rect class=\"plot-background svelte-13ao2q1\"></rect><!><!><!><g data-testid=\"river-ribbon-geometry\"><!><!></g><!></svg> <svg class=\"river-overlay svelte-13ao2q1\"><!><g aria-hidden=\"true\"><!><!><!><!></g><!><!><!></svg></div> <!> <!> <!> <!> <!></div></div> <!> <!> <!></div>", 1), _v = {
	hash: "svelte-13ao2q1",
	code: ".vertical-scale-controls.compact.svelte-13ao2q1 {display:flex;justify-content:flex-end;margin:-6px 0 6px;}.vertical-scale-controls.svelte-13ao2q1 {display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;margin:6px 0 10px;color:var(--secondary);font-size:var(--text-md);}.chart-frame.svelte-13ao2q1 {position:relative;max-width:100%;}\n  /* The legends sit in the chart's horizontal scroller; sticky, like the Cache & cost header,\n     they stay in view while a zoomed chart is scrolled, starting where the plot does. */.group-type-legend.svelte-13ao2q1 {position:sticky;left:0;display:flex;flex-wrap:wrap;align-items:center;gap:5px 12px;width:100%;margin:6px 0 0;padding-left:var(--plot-left);color:var(--text);font-size:var(--text-sm);}.group-type-legend.svelte-13ao2q1 strong:where(.svelte-13ao2q1) {color:var(--text-strong);}.group-type-legend.svelte-13ao2q1 span:where(.svelte-13ao2q1) {display:inline-flex;align-items:center;gap:4px;}.group-type-legend.svelte-13ao2q1 i:where(.svelte-13ao2q1) {width:10px;height:10px;border-radius:var(--radius-small);border:1px solid var(--swatch-border);}.group-hover-card.svelte-13ao2q1 {position:absolute;z-index:4;display:grid;gap:2px;width:max-content;max-width:240px;padding:6px 9px;border:1px solid var(--separator);border-left:3px solid var(--group-color);border-radius:var(--control-radius);background:var(--plot);color:var(--text);font-size:var(--text-sm);box-shadow:0 6px 18px var(--shadow);pointer-events:none;transform:translate(14px, 14px);}.group-hover-card.flip.svelte-13ao2q1 {transform:translate(calc(-100% - 14px), 14px);}.group-hover-card.svelte-13ao2q1 strong:where(.svelte-13ao2q1) {color:var(--text-strong);}.chart-plot.svelte-13ao2q1 {position:relative;min-width:0;max-width:100%;}.economics-readout.svelte-13ao2q1 {min-height:28px;padding:0.45rem 0 0 var(--plot-left);color:var(--secondary);font-size:var(--text-sm);font-variant-numeric:tabular-nums;overflow-wrap:anywhere;}.vertical-axis-overlay.svelte-13ao2q1 {position:absolute;z-index:2;left:0;width:var(--plot-left);border-right:1px solid var(--control-border);background:var(--plot);pointer-events:none;}.vertical-axis-tick.svelte-13ao2q1 {position:absolute;right:5px;color:var(--text);font-size:10px;line-height:1;white-space:nowrap;transform:translateY(-50%);}.vertical-axis-tick.top.svelte-13ao2q1 {transform:none;}.vertical-axis-tick.bottom.svelte-13ao2q1 {transform:translateY(-100%);}.river-scroll.svelte-13ao2q1 {overflow-x:auto;max-width:100%;overscroll-behavior-x:contain;scrollbar-color:var(--control-border) var(--plot);scrollbar-width:thin;outline:none;user-select:none;-webkit-user-select:none;}.river-scroll.svelte-13ao2q1:focus-visible {outline:2px solid var(--accent);outline-offset:2px;}.river-scroll.svelte-13ao2q1::-webkit-scrollbar {height:9px;}.river-scroll.svelte-13ao2q1::-webkit-scrollbar-track {background:var(--plot);border-radius:var(--control-radius);}.river-scroll.svelte-13ao2q1::-webkit-scrollbar-thumb {background:var(--control-border);border:2px solid var(--plot);border-radius:var(--control-radius);}svg.svelte-13ao2q1 {display:block;background:var(--plot);border-radius:var(--radius);touch-action:pan-y;}.plot-background.svelte-13ao2q1 {fill:var(--plot);}.weight-gridline.svelte-13ao2q1 {stroke:var(--separator);stroke-width:0.75;opacity:0.72;pointer-events:none;}.column-guide.svelte-13ao2q1 {stroke:var(--chart-guide);stroke-width:1;pointer-events:none;}.river-overlay.svelte-13ao2q1 .call-target:where(.svelte-13ao2q1) {pointer-events:all;}.call-target.svelte-13ao2q1 {cursor:pointer;color:var(--secondary);}.call-target.svelte-13ao2q1 rect:where(.svelte-13ao2q1) {fill:transparent;}.call-target.svelte-13ao2q1 text:where(.svelte-13ao2q1) {fill:currentColor;font-size:var(--text-sm);}.call-target.svelte-13ao2q1:hover,\n  .call-target.svelte-13ao2q1:focus-visible,\n  .call-target.pinned.svelte-13ao2q1 {color:var(--text-strong);outline:none;}.call-target.svelte-13ao2q1:focus-visible rect:where(.svelte-13ao2q1) {stroke:var(--selection);stroke-width:2;}.call-target.condensed.svelte-13ao2q1 {pointer-events:none;}.call-target.condensed.svelte-13ao2q1:focus-visible {pointer-events:all;}.compaction-marker.svelte-13ao2q1 {pointer-events:none;}.compaction-marker.svelte-13ao2q1 line:where(.svelte-13ao2q1) {stroke:var(--compaction);stroke-width:1.5;stroke-dasharray:6 5;}.compaction-marker.svelte-13ao2q1 text:where(.svelte-13ao2q1) {fill:var(--compaction-text);font-size:10px;font-weight:700;letter-spacing:0.08em;}.reported-input-overlay.svelte-13ao2q1 {pointer-events:none;}.reported-input-line.svelte-13ao2q1 {fill:none;stroke:var(--secondary);stroke-width:1.5;stroke-dasharray:5 4;pointer-events:none;}.input-reference-legend.svelte-13ao2q1 {position:sticky;left:0;width:100%;display:flex;flex-wrap:wrap;align-items:center;gap:0.35rem 1rem;padding:0.45rem 0 0.45rem var(--plot-left);color:var(--secondary);font-size:var(--text-sm);}.input-reference-legend.svelte-13ao2q1 span:where(.svelte-13ao2q1) {display:inline-flex;align-items:center;gap:0.4rem;}.input-reference-legend.svelte-13ao2q1 i:where(.svelte-13ao2q1) {display:inline-block;width:18px;height:10px;flex-shrink:0;}.input-reference-key.svelte-13ao2q1 {border-top:2px dashed var(--secondary);margin-top:8px;}.input-gap-key.svelte-13ao2q1 {background:repeating-linear-gradient(\n      135deg,\n      transparent 0 4px,\n      color-mix(in srgb, var(--input-gap) 46%, transparent) 4px 5px\n    );border:1px solid color-mix(in srgb, var(--input-gap-base) 34%, transparent);}.input-comparison-readout.svelte-13ao2q1 {flex-basis:100%;}\n\n  /* Hover and selection never restyle ribbons: that would re-rasterise every\n     ribbon. Emphasis is drawn in .river-overlay instead. */.river-canvas.svelte-13ao2q1 {position:relative;}\n  /* Composite the overlay, not the ribbon SVG: promoting the ribbon SVG changes\n     how Chrome hit-tests sub-pixel ribbons. */.river-overlay.svelte-13ao2q1 {position:absolute;top:0;left:0;background:none;pointer-events:none;will-change:transform;}.ribbon.svelte-13ao2q1 {pointer-events:none;fill-opacity:0.88;stroke-opacity:0.88;}.ribbon-group.unknown.svelte-13ao2q1 .ribbon:where(.svelte-13ao2q1) {fill-opacity:0.92;}.ribbon-emphasis.svelte-13ao2q1 {fill-opacity:1;}.ribbon-emphasis.hovered.svelte-13ao2q1 {stroke:var(--selection-soft);stroke-width:1.5;}.ribbon-emphasis.selected.svelte-13ao2q1 {stroke:var(--selection);stroke-width:2.5;}.ribbon.subpixel.svelte-13ao2q1 {paint-order:stroke;}.ribbon-hit.svelte-13ao2q1 {fill:transparent;stroke:transparent;stroke-width:0;cursor:pointer;pointer-events:fill;}.ribbon-hit.svelte-13ao2q1:focus-visible {stroke:var(--selection-focus);stroke-width:3;outline:none;}.compaction-merge.svelte-13ao2q1 {opacity:0.4;pointer-events:none;}\n  /* Drawn over the 0.4 base merge: about 0.5 combined when the summary is\n     focused, about 0.8 when the focused item is one of its sources. */.compaction-merge-emphasis.svelte-13ao2q1 {opacity:0.15;}.compaction-merge-emphasis.emphasized.svelte-13ao2q1 {opacity:0.65;}.version-mark.svelte-13ao2q1 {stroke:var(--selection);stroke-width:1.5;opacity:0.8;}.lineage-connector.svelte-13ao2q1 {fill:none;stroke:var(--selection);stroke-width:1.5;stroke-dasharray:4 4;opacity:0.88;}.crosshair.svelte-13ao2q1 {stroke:var(--secondary);stroke-width:1;stroke-dasharray:4 4;pointer-events:none;}.pin-line.svelte-13ao2q1 {stroke:var(--selection);stroke-width:2;pointer-events:none;}.zoom-selection.svelte-13ao2q1 {fill:color-mix(in srgb, var(--accent) 20%, transparent);stroke:var(--accent);stroke-width:1.5;stroke-dasharray:4 3;pointer-events:none;}\n  @container highwater (max-width: 620px) {.vertical-scale-controls.svelte-13ao2q1 {display:block;}\n  }"
};
function vv(e, t) {
	Ve(t, !0), li(e, _v);
	let n = () => st(Ma, "$activePalette", r), [r, i] = ct(), a = (e) => {
		var t = F_(), n = R(t), r = B(L(n), 2), i = B(r, 2);
		j(n);
		var a = B(n, 2), o = B(L(a), 2), s = B(o, 2);
		j(a), V(() => {
			Y(r, "aria-pressed", H(ce) === "session"), Y(i, "aria-pressed", H(ce) === "visible"), Y(o, "aria-pressed", H(le) === "items"), Y(s, "aria-pressed", H(le) === "itemTypes");
		}), U("click", r, () => T("session")), U("click", i, () => T("visible")), U("click", o, () => w("items")), U("click", s, () => w("itemTypes")), G(e, t);
	}, o = `compaction-merge-${P_++}`, s = 0, c = X(t, "pinnedCallIndex", 3, null), l = X(t, "hoveredCallIndex", 3, null), u = X(t, "selectedItemId", 3, null), d = X(t, "hoveredItemId", 3, null), f = X(t, "navigationCommand", 3, null), p = X(t, "isVisible", 3, !0), m = X(t, "onViewportChange", 3, () => {}), h = X(t, "onNavigationSettled", 3, () => {}), g = X(t, "onSelectionVisibility", 3, () => {}), _ = X(t, "consumeUnhandledEscape", 3, !0), v = X(t, "compact", 3, !1), y = X(t, "preferences", 23, Gi), b = X(t, "onPreferencesChange", 3, () => {}), x = null, S = /* @__PURE__ */ F(void 0), ee = /* @__PURE__ */ F(void 0);
	function C(e) {
		y(e), b()(e);
	}
	function te(e) {
		on(e.river.verticalScale), H(le) !== e.river.display && Un(!1), I(le, e.river.display, !0);
		let t = e.economics.expanded ? e.economics.lastMode : "off";
		if (t === "off" && H(de) !== "off") {
			let e = Vi(D).activeElement, t = e instanceof Node && (H(ee)?.contains(e) || D?.querySelector(".economics-track-svg")?.contains(e) || H(A)?.contains(e));
			Jn(!1), _e.cancel(), I(fe, ""), I(pe, null), I(ye, ""), t && H(S)?.focus();
		}
		I(ue, e.economics.cacheView, !0), I(de, t, !0);
	}
	function w(e) {
		C({
			...y(),
			river: {
				...y().river,
				display: e
			}
		});
	}
	function T(e) {
		C({
			...y(),
			river: {
				...y().river,
				verticalScale: e
			}
		});
	}
	function E(e) {
		C({
			...y(),
			economics: {
				...y().economics,
				cacheView: e
			}
		});
	}
	let D, O, ne, re = /* @__PURE__ */ F(960), ie = /* @__PURE__ */ F(!1), ae = /* @__PURE__ */ F(0), oe = /* @__PURE__ */ F(0), se = /* @__PURE__ */ F(0), ce = /* @__PURE__ */ F("session"), le = /* @__PURE__ */ F("items"), ue = /* @__PURE__ */ F("tokens"), de = /* @__PURE__ */ F("off"), fe = /* @__PURE__ */ F(""), pe = /* @__PURE__ */ F(null), me = /* @__PURE__ */ F(null), he = null, ge = Fp(), _e = Fp(), ve = /* @__PURE__ */ F(null), k, ye = /* @__PURE__ */ F(""), A = /* @__PURE__ */ F(null), be = /* @__PURE__ */ F(null), xe = /* @__PURE__ */ F(null), Ce = /* @__PURE__ */ F(null), we = /* @__PURE__ */ F(null), Te = "", Ee = 960, De = null, Oe = "", ke = "", Ae = [], je = /* @__PURE__ */ F(null), Me = /* @__PURE__ */ F(null), Ne = x_(), Pe = null, Fe = !1, Ie = !0, M = {
		top: 36,
		right: 24,
		bottom: 54,
		left: 42
	}, Le = 1.5, Re = {
		maxWeight: 0,
		visibleCallCount: 0,
		usesInterpolatedEdge: !1
	};
	function ze() {
		p() ? D && D.clientWidth > 0 && (I(re, D.clientWidth, !0), I(ie, !0), an()) : (ge.cancel(), _e.cancel(), Fn(), t.onHoverCall(null), t.onHoverItem(null), H(pe) && Jn(!1));
	}
	let Be = /* @__PURE__ */ F(null), Ue = /* @__PURE__ */ N(() => zl(t.indexed.analysis.economics.costBasis, t.indexed.analysis.session.source)), We = /* @__PURE__ */ N(() => H(me) ? H(me).memberIds.slice(0, 12).map((e) => Ao(t.indexed.itemById.get(e), e)) : []), Ge = /* @__PURE__ */ N(() => JSON.stringify(t.indexed.analysis.modelCalls.map((e) => [e.index, e.sourceRecordId]))), Ke = /* @__PURE__ */ N(() => t.indexed.analysis.modelCalls.length), qe = /* @__PURE__ */ N(() => Math.max(1, H(re) - M.left - M.right)), Je = /* @__PURE__ */ N(() => H(Ke) > 1 ? H(qe) / (H(Ke) - 1) : 0), Ye = /* @__PURE__ */ N(() => Math.max(H(xe) ?? H(Je), H(Je))), Xe = /* @__PURE__ */ N(() => H(Ke) > 1 && H(xe) !== null ? Math.max(H(re), M.left + M.right + (H(Ke) - 1) * H(xe)) : Math.max(1, H(re))), Ze = /* @__PURE__ */ N(() => p_(t.indexed, 960, M)), Qe = /* @__PURE__ */ N(() => _l(t.indexed, H(Ze))), $e = /* @__PURE__ */ N(() => yl(H(Ze), H(Qe))), et = /* @__PURE__ */ N(() => Math.max(0, ...H($e).map((e) => e.totalDisplayWeight))), tt = /* @__PURE__ */ N(() => g_(H($e), 960, H(Xe), M)), nt = /* @__PURE__ */ N(() => Math.max(M.left, H(ae) - H(se))), rt = /* @__PURE__ */ N(() => Math.min(H(Xe) - M.right, H(ae) - H(se) + H(re))), it = /* @__PURE__ */ N(() => Math.max(M.left, H(oe) - H(se))), at = /* @__PURE__ */ N(() => Math.min(H(Xe) - M.right, H(oe) - H(se) + H(re))), ot = /* @__PURE__ */ N(() => h_(t.indexed, {
		width: 960,
		height: 500,
		margin: M,
		minimumVisibleThickness: 1,
		verticalDomainMax: H(Qe).size > 0 ? H(et) : void 0,
		groupByKind: H(le) === "itemTypes"
	}, H(Ze))), lt = /* @__PURE__ */ N(() => __(H(ot), 960, H(Xe), M)), ut = /* @__PURE__ */ N(() => H(lt).layout), dt = /* @__PURE__ */ N(() => u() === null || !H(ie) || !p() ? null : {
		itemId: u(),
		visible: ur(u(), H(le), H(ut).ribbons, {
			left: (H(it) - H(lt).offset) / (H(lt).scale || 1),
			right: (H(at) - H(lt).offset) / (H(lt).scale || 1)
		})
	}), ft = /* @__PURE__ */ N(() => JSON.stringify(H(dt))), pt = /* @__PURE__ */ N(() => H(ce) === "visible" ? Xp(H(tt), H(nt), H(rt)) : Re), mt = /* @__PURE__ */ N(() => Math.max(1, H(Qe).size > 0 ? H(et) : H(ot).maxTotalDisplayWeight)), ht = /* @__PURE__ */ N(() => H(ce) === "visible" ? H(mt) / Math.max(1, H(pt).maxWeight) : 1), gt = /* @__PURE__ */ N(() => (500 - M.bottom) * (1 - H(ht))), _t = /* @__PURE__ */ N(() => H(ht) === 1 ? H(lt).transform : `${H(lt).transform} matrix(1 0 0 ${H(ht)} 0 ${H(gt)})`), vt = /* @__PURE__ */ N(() => Eu(t.indexed.analysis)), yt = /* @__PURE__ */ N(() => H(ce) === "visible" ? H(pt).maxWeight : H(et)), bt = /* @__PURE__ */ N(() => Math.max(1, H(yt))), xt = /* @__PURE__ */ N(() => bl(H(ut).columns, H(Qe), {
		width: H(Xe),
		height: 500,
		margin: M,
		minimumVisibleThickness: 1
	}, H(bt))), St = /* @__PURE__ */ N(() => [...H(Qe).values()].some((e) => e.gap > 0)), Ct = /* @__PURE__ */ N(() => H(Qe).get(c() ?? l() ?? -1)), wt = /* @__PURE__ */ N(() => Zp(H(yt))), Tt = /* @__PURE__ */ N(() => H(wt).map((e, t) => ({
		value: e,
		position: t,
		y: M.top + H(ut).innerHeight * (1 - e / H(bt)),
		percent: Math.max(0, Math.min(100, 100 * (1 - e / H(bt))))
	}))), Et = /* @__PURE__ */ N(() => t.indexed.analysis.displayWeightUnit === "unavailable" ? "structural placeholder stack weight (token geometry unavailable)" : Wa(t.indexed.analysis.displayWeightUnit)), Dt = /* @__PURE__ */ N(() => H(ce) === "session" ? `Session-wide scale in ${H(Et)}. Ribbon heights remain comparable across the session.` : `${H(pt).visibleCallCount} visible call markers in ${H(Et)}. Viewport edges are interpolated where needed; ribbon heights change as you pan or zoom.`), P = /* @__PURE__ */ N(() => `Vertical axis. ${H(Dt)} Tick values: ${H(wt).map(tm).join(", ")}.`), Ot = /* @__PURE__ */ N(() => new Map(H(ut).columns.map((e) => [e.callIndex, e]))), kt = /* @__PURE__ */ N(() => new Map(H(ut).ribbons.filter((e) => e.groupKind === void 0).map((e) => [e.itemId, e]))), At = /* @__PURE__ */ N(() => d() === null ? null : H(kt).get(d()) ?? null), jt = /* @__PURE__ */ N(() => u() === null ? null : H(kt).get(u()) ?? null), Mt = /* @__PURE__ */ N(() => u() ?? d()), Nt = /* @__PURE__ */ N(() => new Map(H(ut).ribbons.map((e) => [e.key, e]))), Pt = /* @__PURE__ */ N(() => H(ut).ribbons.reduce((e, t) => {
		let n = e.get(t.itemId);
		return n ? n.push(t) : e.set(t.itemId, [t]), e;
	}, /* @__PURE__ */ new Map())), Ft = /* @__PURE__ */ N(() => H(Be) !== null && H(Nt).has(H(Be)) ? H(Be) : H(jt)?.key ?? H(ut).ribbons[0]?.key ?? null), It = /* @__PURE__ */ N(() => gh(H(ut).columns, 52, c())), Lt = /* @__PURE__ */ N(() => [...H(It)].map((e) => H(ut).columns[e]?.callIndex)), Rt = /* @__PURE__ */ N(() => c() !== null && H(Lt).includes(c()) ? c() : H(Lt)[0] ?? null), zt = /* @__PURE__ */ N(() => H(Mt) === null ? [] : H(ut).lineageConnectors.map((e, t) => ({
		connector: e,
		index: t
	})).filter(({ connector: e }) => e.fromItemId === H(Mt) || e.toItemId === H(Mt))), Bt = /* @__PURE__ */ N(() => H(ut).columns.map((e) => ({
		callIndex: e.callIndex,
		x: e.x,
		sourceRecordId: t.indexed.callByIndex.get(e.callIndex)?.sourceRecordId ?? null
	}))), Vt = /* @__PURE__ */ N(() => H(Bt).length < 2 ? Infinity : H(Bt).reduce((e, t, n) => n === 0 ? e : Math.min(e, t.x - H(Bt)[n - 1].x), Infinity)), Ht = /* @__PURE__ */ N(() => H(Vt) < 52 ? Math.ceil(52 / Math.max(1, H(Vt))) : 1), Ut = /* @__PURE__ */ N(() => gh(H(ut).columns, 52, null)), Wt = /* @__PURE__ */ N(() => H(Je) > 0 ? Math.max(1, H(Ye) / H(Je)) : 1), Gt = /* @__PURE__ */ N(() => H(xe) === null || H(Xe) <= H(re) + 1), Kt = /* @__PURE__ */ N(() => H(Je) * Math.min(256, Math.max(1, H(Ke) - 1))), qt = /* @__PURE__ */ N(() => H(Ke) > 1 && H(Ye) < H(Kt) - .5), Jt = /* @__PURE__ */ N(() => H(Ke) > 1 && !H(Gt) && H(Wt) > 1.01), Yt = /* @__PURE__ */ N(() => H(Me) ? {
		x: Math.min(Sn(H(Me).startClientX), Sn(H(Me).currentClientX)),
		width: Math.abs(Sn(H(Me).currentClientX) - Sn(H(Me).startClientX))
	} : null);
	Tn(() => {
		let e = y();
		e !== x && (x = e, yr(() => te(e)));
	}), Tn(() => ge.observeIdentity(t.indexed)), Tn(() => _e.observeIdentity(t.indexed)), Tn(() => {
		if (H(ft) === ke) return;
		ke = H(ft);
		let e = H(dt);
		yr(() => g()(e));
	}), Tn(() => {
		Ie !== p() && (Ie = p(), yr(ze));
	}), Tn(() => {
		H(Ge), H(re), H(xe), H(Ce), yr(Xt);
	}), Cn(() => {
		f(), p(), H(Xe), H(ut), H(Ge), H(re), H(ie), H(xe), H(je), H(we), H(pe), H(A), yr(Zt);
	});
	function Xt() {
		if (D) {
			if (H(Ce) && H(xe) !== null && H(re) !== Ee) {
				I(we, H(Ce), !0);
				return;
			}
			if (!H(je) && H(xe) !== null && (H(Ge) !== Te || H(re) !== Ee)) {
				let e = H(re) === Ee ? sa(Ae, D.scrollLeft, en(), rn()) : Op(Ae, D.scrollLeft + Ee / 2 - H(se), H(re) / 2);
				e && I(je, {
					kind: "anchor",
					anchor: e
				}, !0);
			}
		}
	}
	function Zt() {
		if (D) {
			if (he && !he.isConnected && (he = null), un(), f() && f().id !== De && nn() && (De = f().id, xn(f())), H(we)) {
				let e = H(we);
				if (I(we, null), H(Ce) === e && H(xe) !== null) {
					let t = fn(e.startCallIndex, e.endCallIndex, en() / 2);
					if (t) {
						let e = kp(t.intervalCount, H(qe), H(Ke));
						mn(Math.min(H(Kt), e), t.anchor);
					} else I(Ce, null);
				}
			}
			if (an(), Te = H(Ge), Ee = H(re), Ae = H(Bt), cn(), H(pe) && H(A)) {
				let e = qn();
				e !== H(ye) && I(ye, e, !0);
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
		let e = jp(D, {
			onScroll: $t,
			onDocumentScroll: Kn,
			onWheel: (e) => {
				if (!(e.metaKey || e.ctrlKey) || H(Ke) < 2) return;
				e.preventDefault();
				let t = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 16 : e.deltaMode === WheelEvent.DOM_DELTA_PAGE ? e.deltaY * Math.max(1, D.clientHeight) : e.deltaY;
				hn(e.clientX, Math.exp(-t * .0035));
			},
			onPointerMove: Mn,
			onPointerUp: Nn,
			onPointerCancel: Pn,
			onKeyUp: (e) => {
				e.code === "Space" && (Fe = !1);
			},
			onBlur: () => {
				Fe = !1, Fn();
			},
			onResize: (e, t) => {
				if (H(re) !== e) {
					let t = Ne.pointers.length > 0;
					Fn(), t && (Ne = {
						...Ne,
						suppressClick: !0
					}), I(re, e, !0);
				}
				I(ie, !0), an(), t === "element" && (cn(), Kn());
			}
		});
		return () => {
			ge.dispose(), _e.dispose(), Fn(), Pe !== null && window.clearTimeout(Pe), Qt !== null && cancelAnimationFrame(Qt), e();
		};
	});
	function en() {
		return D?.clientWidth > 0 ? D.clientWidth : H(ie) ? H(re) : 0;
	}
	function tn() {
		return Math.max(D?.scrollWidth ?? 0, H(Xe));
	}
	function nn() {
		return !p() || !D || D.clientWidth <= 0 ? !1 : Math.abs(D.clientWidth - H(re)) > .5 ? (I(re, D.clientWidth, !0), I(ie, !0), !1) : !0;
	}
	function rn() {
		if (!D || !O) return 0;
		let e = D.getBoundingClientRect(), t = O.getBoundingClientRect();
		return !Number.isFinite(e.left) || !Number.isFinite(t.left) ? 0 : t.left - e.left + D.scrollLeft - D.clientLeft;
	}
	function an() {
		if (!D) return;
		H(oe) !== D.scrollLeft && I(oe, D.scrollLeft, !0);
		let e = rn();
		Math.abs(H(se) - e) > .01 && I(se, e, !0), H(ce) === "visible" && H(ae) !== D.scrollLeft && I(ae, D.scrollLeft, !0);
	}
	function on(e) {
		I(ce, e, !0), e === "visible" && D && (I(ae, D.scrollLeft, !0), I(se, rn(), !0));
	}
	function sn() {
		let e = en(), t = tn(), n = H(ie) || e > 0, r = H(se), i = n ? aa(H(Bt), D.scrollLeft, e, r) : {
			firstVisibleCallIndex: null,
			lastVisibleCallIndex: null
		};
		return {
			ready: n,
			isFitAll: H(Gt),
			zoomFactor: H(Wt),
			canZoomIn: H(qt),
			canZoomOut: H(Jt),
			totalCallCount: H(Ke),
			hasOverflow: n && t > e + 1,
			centerCallIndex: n ? dh(D.scrollLeft + e / 2 - r, H(ut).columns) : null,
			...i
		};
	}
	function cn() {
		if (!D) return;
		let e = sn(), t = JSON.stringify(e);
		t !== Oe && (Oe = t, m()(e)), e.ready && De !== null && !H(je) && !H(we) && De !== s && (s = De, h()(De));
	}
	function ln(e) {
		D.scrollLeft = ia(e, tn(), en()), an(), cn();
	}
	function un() {
		if (!H(je)) return;
		let e = H(je);
		if (I(je, null), e === "fit") {
			D.scrollLeft = 0, an();
			return;
		}
		let t = ca(e.anchor, H(Bt), en(), tn(), rn());
		D.scrollLeft = t ?? ia(D.scrollLeft, tn(), en()), an();
	}
	function dn(e, t) {
		return Ep(H(Bt), e, t);
	}
	function fn(e, t, n) {
		return Dp(H(Bt), e, t, n);
	}
	function pn(e) {
		let t = Math.min(H(Xe) - M.right, Math.max(M.left, Sn(e))), n = D.getBoundingClientRect();
		return Op(H(Bt), t, e - n.left - D.clientLeft);
	}
	function mn(e, t = null) {
		let n = H(xe), r = Ap(H(xe), e, H(Je), H(Kt), t);
		if (I(xe, r.spacing, !0), r.adjustment && (I(je, r.adjustment, !0), H(xe) === n && un()), r.immediateAnchor) {
			let e = ca(r.immediateAnchor, H(Bt), en(), tn(), rn());
			e !== null && ln(e);
		}
	}
	function hn(e, t) {
		if (H(Ke) < 2 || !Number.isFinite(t) || t <= 0) return;
		I(Ce, null);
		let n = pn(e);
		mn(Math.min(H(Kt), Math.max(H(Je), H(Ye) * t)), n);
	}
	function gn(e) {
		hn(D.getBoundingClientRect().left + en() / 2, e === "in" ? Le : 1 / Le);
	}
	function _n(e, t = !1) {
		if (t || I(Ce, null), H(Ke) < 2) return;
		let n = H(Ye);
		if (H(xe) === null) {
			let e = Math.min(15, H(Ke));
			e > 1 && (n = H(qe) / (e - 1));
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
			if (I(Ce, {
				startCallIndex: e,
				endCallIndex: t
			}, !0), n.intervalCount === 0) {
				_n(e, !0);
				return;
			}
			mn(Math.min(H(Kt), H(qe) / n.intervalCount), n.anchor);
		}
	}
	function bn(e, n) {
		let r = t.indexed.itemById.get(e);
		if (!r || r.presence.length === 0) return;
		w("items"), I(le, "items");
		let i = H(at) > H(it) ? (H(it) + H(at)) / 2 : NaN, a = n === null ? NaN : H(Ot).get(n)?.x ?? NaN, o = b_(r.presence, H(ut).columns, Number.isFinite(i) ? i : a, c());
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
			I(Ce, null), mn(null);
			return;
		}
		if (e.kind === "zoom-in" || e.kind === "zoom-out") {
			gn(e.kind === "zoom-in" ? "in" : "out");
			return;
		}
		if (e.kind === "latest") {
			I(Ce, null), ln(oa(tn(), en()));
			return;
		}
		if (e.kind === "ensure-call") {
			let t = H(Bt).find((t) => t.callIndex === e.callIndex);
			if (!t) return;
			let n = ra(t.x + rn(), D.scrollLeft, en(), tn());
			Math.abs(n - D.scrollLeft) > .5 && I(Ce, null), ln(n);
			return;
		}
		if (e.kind === "range") {
			yn(e.startCallIndex, e.endCallIndex);
			return;
		}
		if (e.kind === "recent") {
			let n = t.indexed.analysis.modelCalls, r = Math.max(2, Math.floor(H(qe) / e.minCallSpacing) + 1);
			if (n.length <= r) {
				I(Ce, null), mn(null);
				return;
			}
			yn(n[n.length - r].index, n[n.length - 1].index);
			return;
		}
	}
	function Sn(e) {
		let t = O.getBoundingClientRect();
		return fh(e, t.left, t.width, H(Xe));
	}
	function wn(e, t = !1) {
		let n = Sn(e);
		if (t) n = Math.min(H(Xe) - M.right, Math.max(M.left, n));
		else if (n < M.left || n > H(Xe) - M.right) return null;
		return dh(n, H(ut).columns);
	}
	function En(e) {
		return wn(e.clientX);
	}
	function Dn(e) {
		let t = A_(Ne);
		return Ne = t.state, t.suppressed ? (Pe !== null && window.clearTimeout(Pe), Pe = null, e.preventDefault(), e.stopPropagation(), !0) : !1;
	}
	function On() {
		Pe !== null && window.clearTimeout(Pe), Pe = window.setTimeout(() => {
			Ne = j_(Ne), Pe = null;
		}, 0);
	}
	function kn(e) {
		for (let t of e) switch (t.kind) {
			case "capture":
				t.pointerIds.forEach((e) => Np(D, e));
				break;
			case "release":
				t.pointerIds.forEach((e) => Pp(D, e));
				break;
			case "clear-selection":
				I(Me, null);
				break;
			case "clear-requested-range":
				I(Ce, null);
				break;
			case "selection":
				I(Me, {
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
		return e.target instanceof Node && ne !== void 0 && ne.contains(e.target);
	}
	function jn(e) {
		if (!An(e)) return;
		let t = Mp(e), n = w_(S_(Ne.pointers, t)), r = n ? pn(n.x) : null, i = T_(Ne, t, {
			spaceHeld: Fe,
			scrollLeft: D.scrollLeft,
			callSpacing: H(Ye),
			pinchAnchor: r
		});
		Ne = i.state, i.effects.some((e) => e.kind === "prevent-default") && e.preventDefault(), kn(i.effects);
	}
	function Mn(e) {
		if (!Ne.pointers.some((t) => t.pointerId === e.pointerId)) return;
		let t = E_(Ne, Mp(e), { dragThreshold: 7 });
		Ne = t.state, kn(t.effects);
	}
	function Nn(e) {
		let t = w_(C_(Ne.pointers, e.pointerId)), n = t ? pn(t.x) : null, r = D_(Ne, e.pointerId, {
			clientX: e.clientX,
			callSpacing: H(Ye),
			pinchAnchor: n
		});
		Ne = r.state, kn(r.effects);
	}
	function Pn(e) {
		let t = O_(Ne, e.pointerId);
		Ne = t.state, kn(t.effects);
	}
	function Fn() {
		let e = k_(Ne);
		Ne = e.state, kn(e.effects), Pe !== null && window.clearTimeout(Pe), Pe = null;
	}
	function In(e) {
		An(e) && t.onHoverCall(En(e));
	}
	function Ln(e) {
		C({
			...y(),
			economics: {
				...y().economics,
				expanded: e !== "off",
				lastMode: e === "off" ? y().economics.lastMode : e
			}
		});
	}
	function Rn() {
		return !p() || H(de) === "off" ? !1 : H(pe) ? (Jn(), !0) : (Ln("off"), H(S)?.focus({ preventScroll: !0 }), !0);
	}
	function zn(e) {
		I(fe, e, !0);
	}
	function Bn(e) {
		I(pe, e, !0), e === null && I(ye, "");
	}
	function Vn() {
		let e = H(pe)?.callIndices ?? [];
		if (e.length === 0) return;
		let t = Math.min(...e), n = Math.max(...e);
		t === n ? _n(t) : yn(t, n);
	}
	function Hn(e, t, n, r = null, i) {
		H(me) === null && (he = r ?? (Vi(D).activeElement instanceof HTMLElement ? Vi(D).activeElement : null));
		let a = r?.getBoundingClientRect(), o = {
			kind: e,
			memberIds: t,
			callIndex: n,
			anchor: i ?? {
				x: a ? (Math.max(8, a.left) + Math.min(window.innerWidth - 8, a.right)) / 2 : 8,
				y: a ? (Math.max(8, a.top) + Math.min(window.innerHeight - 8, a.bottom)) / 2 : 8
			}
		};
		I(me, o), ge.focusAfterUpdate(() => Vi(D).getElementById("group-breakdown-close"), () => H(me) !== null && p(), { preventScroll: !0 });
	}
	function Un(e = !0) {
		let t = he;
		I(me, null), he = null, ge.cancel(), e && t?.isConnected && ge.focusAfterUpdate(() => t, () => H(me) === null && p(), { preventScroll: !0 });
	}
	function Wn(e, t, n, r) {
		let i = wn(r.clientX, !0), a = k.getBoundingClientRect(), o = r.clientX - a.left;
		I(ve, {
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
		w("items"), Un(!1);
	}
	function Kn() {
		H(pe) && (I(ye, qn(), !0), D && !Ym(D, H(pe)) && Jn(!1));
	}
	function qn() {
		return D ? Xm(D, H(A), H(pe)) : "";
	}
	function Jn(e = !0) {
		H(be)?.closeEventBreakdown(e);
	}
	function Yn(e) {
		let n = t.indexed.analysis.compactions.find((t) => t.beforeModelCall === e);
		n && (Jn(!1), t.onSelectItem(n.summaryItemId), t.indexed.callByIndex.has(e) && t.onPinCall(e));
	}
	function Xn(e) {
		Jn(!1), t.onPinCall(e), _e.focusAfterUpdate(() => Vi(D).getElementById(`economics-call-${e}`), () => p() && t.indexed.callByIndex.has(e));
	}
	function Zn(e, n) {
		Dn(e) || (e.stopPropagation(), t.onPinCall(n));
	}
	function Qn(e) {
		if (Dn(e) || !An(e)) return;
		let n = En(e);
		n !== null && t.onEmptyClick(n);
	}
	function $n(e, t) {
		Dn(e) || (e.stopPropagation(), er(t));
	}
	function er(e) {
		t.onSelectItem(e);
		let n = t.indexed.itemById.get(e)?.presence[0]?.startCall;
		n !== void 0 && t.indexed.callByIndex.has(n) && t.onPinCall(n);
	}
	function tr(e, n, r) {
		if (Dn(e)) return;
		e.stopPropagation();
		let i = wn(e.clientX, !0);
		Hn(n, i === null ? r : r.filter((e) => t.indexed.contextSetByCall.get(i)?.has(e)), i, e.currentTarget instanceof SVGElement ? e.currentTarget : null, {
			x: e.clientX,
			y: e.clientY
		});
	}
	function nr(e, n, r) {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			let i = c();
			Hn(n, i === null ? r : r.filter((e) => t.indexed.contextSetByCall.get(i)?.has(e)), i, e.currentTarget instanceof SVGElement ? e.currentTarget : null);
		} else e.key === "Escape" && rr(e);
	}
	function rr(e) {
		(t.onEscape() !== !1 || _()) && (e.preventDefault(), e.stopPropagation());
	}
	function ir(e) {
		e.key === "Escape" ? rr(e) : e.code === "Space" && (e.target === D || e.target === O) && (Fe = !0, e.preventDefault());
	}
	function ar(e, n) {
		if (![
			"ArrowUp",
			"ArrowDown",
			"Home",
			"End"
		].includes(e.key)) return !1;
		e.preventDefault();
		let r;
		if (n.groupKind !== void 0) r = H(ut).ribbons;
		else {
			let e = c() !== null && c() >= n.startCall && c() <= n.endCall ? c() : n.startCall;
			r = (t.indexed.orderedItemIdsByCall.get(e) ?? []).flatMap((t) => H(Pt).get(t)?.filter((t) => t.startCall <= e && e <= t.endCall) ?? []);
		}
		let i = r.findIndex((e) => e.key === n.key), a = e.key === "Home" ? r[0] : e.key === "End" ? r[r.length - 1] : r[i + (e.key === "ArrowUp" ? 1 : -1)];
		return !a || (I(Be, a.key, !0), D?.querySelector(`[data-ribbon-key="${CSS.escape(a.key)}"]`)?.focus({ preventScroll: !0 }), !0);
	}
	function or(e, t) {
		e.key === "Enter" || e.key === " " ? (e.preventDefault(), er(t)) : e.key === "Escape" && rr(e);
	}
	function sr(e, n) {
		e.key === "Enter" || e.key === " " ? (e.preventDefault(), t.onPinCall(n)) : e.key === "Escape" && rr(e);
	}
	function cr(e) {
		return e.thinnest * H(ht) < 1;
	}
	function lr(e) {
		return Ao(t.indexed.itemById.get(e), e);
	}
	function ur(e, n, r, i) {
		if (n === "items") return v_(e, r, i);
		let a = t.indexed.itemById.get(e);
		return a ? r.some((t) => t.memberItemIds?.includes(e) && t.points.some((e) => y_(a.presence, e.callIndex) && e.x >= i.left && e.x <= i.right)) : !1;
	}
	var dr = { dismissEconomics: Rn }, fr = gv(), pr = R(fr), mr = (e) => {
		var t = I_();
		Ws(L(t), {
			label: "View",
			children: (e, t) => {
				a(e);
			},
			$$slots: { default: !0 }
		}), j(t), G(e, t);
	}, hr = (e) => {
		var t = L_(), n = L(t);
		a(n), j(t), G(e, t);
	};
	q(pr, (e) => {
		v() ? e(mr) : e(hr, -1);
	});
	var gr = B(pr, 2);
	let _r;
	var vr = L(gr), br = L(vr);
	J(br, 21, () => H(Tt), (e) => e.value, (e, t) => {
		var n = R_();
		let r, i;
		var a = z(n, !0);
		V((e) => {
			r = gi(n, 1, "vertical-axis-tick svelte-13ao2q1", null, r, {
				top: H(t).position === H(Tt).length - 1,
				bottom: H(t).position === 0
			}), i = vi(n, "", i, { top: `${H(t).percent}%` }), K(a, e);
		}, [() => tm(H(t).value)]), G(e, n);
	}), j(br);
	var xr = B(br, 2), Sr = L(xr), Cr = z(Sr), wr = B(Sr, 2);
	let Tr;
	var Er = L(wr);
	Y(Er, "height", 500);
	var Dr = L(Er), kr = L(Dr), Ar = (e) => {
		var t = V_(), n = R(t), r = B(n), i = L(r), a = B(i), s = L(a);
		J(s, 17, () => H(ut).ribbons, (e) => e.key, (e, t) => {
			var n = z_();
			V((e, r) => {
				Y(n, "d", H(t).path), Y(n, "stroke", e), Y(n, "stroke-width", r);
			}, [() => cr(H(t)) ? "black" : "none", () => cr(H(t)) ? 1.25 : 0]), G(e, n);
		}), J(B(s), 17, () => H(ut).lineageConnectors, (e) => e.key, (e, t) => {
			var n = B_();
			V(() => Y(n, "d", H(t).mergePath)), G(e, n);
		}), j(a), j(r), V(() => {
			Y(n, "id", `${o}-input-hatch`), Y(r, "id", `${o}-input-mask`), Y(r, "x", M.left), Y(r, "y", M.top), Y(r, "width", H(ut).innerWidth), Y(r, "height", H(ut).innerHeight), Y(i, "x", M.left), Y(i, "y", M.top), Y(i, "width", H(ut).innerWidth), Y(i, "height", H(ut).innerHeight), Y(a, "transform", H(_t));
		}), G(e, t);
	};
	q(kr, (e) => {
		H(St) && e(Ar);
	});
	var jr = B(kr);
	J(jr, 19, () => H(ut).lineageConnectors, (e) => e.key, (e, r, i) => {
		var a = H_(), s = L(a), c = B(s);
		j(a), V((e, t) => {
			Y(a, "id", `${o}-${H(i)}`), Y(a, "x1", H(r).sourceX), Y(a, "y1", H(r).sourceY), Y(a, "x2", H(r).targetX), Y(a, "y2", H(r).sourceY), Y(s, "stop-color", e), Y(c, "stop-color", t);
		}, [() => wa(t.indexed, H(r).fromItemId, n()), () => wa(t.indexed, H(r).toItemId, n())]), G(e, a);
	});
	var Mr = B(jr);
	j(Dr);
	var Nr = B(Dr), Pr = B(Nr);
	J(Pr, 17, () => H(Tt), (e) => e.value, (e, t) => {
		var n = U_();
		V(() => {
			Y(n, "x1", M.left), Y(n, "x2", H(Xe) - M.right), Y(n, "y1", H(t).y), Y(n, "y2", H(t).y);
		}), G(e, n);
	});
	var Fr = B(Pr);
	J(Fr, 19, () => H(ut).columns, (e) => e.callIndex, (e, t, n) => {
		var r = Br(), i = R(r), a = (e) => {
			var n = W_();
			V(() => {
				Y(n, "x1", H(t).x), Y(n, "x2", H(t).x), Y(n, "y1", M.top), Y(n, "y2", 500 - M.bottom);
			}), G(e, n);
		}, o = /* @__PURE__ */ N(() => H(Ut).has(H(n)));
		q(i, (e) => {
			H(o) && e(a);
		}), G(e, r);
	});
	var Ir = B(Fr);
	J(Ir, 17, () => H(ut).compactions, (e) => e.compactionId, (e, t) => {
		var n = G_(), r = L(n), i = z(r), a = B(r), o = B(a), s = z(o, !0);
		j(n), V(() => {
			Y(n, "aria-label", `Compaction before call ${H(t).beforeModelCall}`), K(i, `Compaction before call ${H(t).beforeModelCall ?? ""}`), Y(a, "x1", H(t).x), Y(a, "x2", H(t).x), Y(a, "y1", M.top - 8), Y(a, "y2", 500 - M.bottom), Y(o, "x", H(t).x + 5), Y(o, "y", M.top - 13), K(s, H(Vt) < 64 ? "C" : "COMPACT");
		}), G(e, n);
	});
	var W = B(Ir), Lr = L(W);
	J(Lr, 19, () => H(ut).lineageConnectors, (e) => e.key, (e, t, n) => {
		var r = K_();
		V(() => {
			Y(r, "d", H(t).mergePath), Y(r, "fill", `url(#${o}-${H(n)})`);
		}), G(e, r);
	}), J(B(Lr), 17, () => H(ut).ribbons, (e) => e.key, (e, r) => {
		let i = /* @__PURE__ */ N(() => H(r).groupKind !== void 0), a = /* @__PURE__ */ N(() => H(r).groupKind ? Ca(H(r).groupKind, n()) : wa(t.indexed, H(r).itemId, n())), o = /* @__PURE__ */ N(() => H(i) ? `Item type ${Io(H(r).groupKind)} · ${H(r).memberItemIds?.length ?? 0} items` : lr(H(r).itemId));
		var s = J_();
		let c;
		var l = L(s);
		let d;
		var f = B(l), p = L(f), m = (e) => {
			var t = q_(), n = z(t, !0);
			V(() => K(n, H(o))), G(e, t);
		};
		q(p, (e) => {
			H(i) || e(m);
		}), j(f), j(s), V((e, n, p) => {
			c = gi(s, 0, "ribbon-group svelte-13ao2q1", null, c, {
				"group-ribbon": H(i),
				selected: !H(i) && u() === H(r).itemId,
				unknown: t.indexed.analysis.displayWeightUnit === "unavailable"
			}), d = gi(l, 0, "ribbon svelte-13ao2q1", null, d, { subpixel: e }), Y(l, "d", H(r).path), Y(l, "fill", t.indexed.analysis.displayWeightUnit === "unavailable" ? "url(#unknown-geometry)" : H(a)), Y(l, "stroke", n), Y(l, "stroke-width", p), Y(f, "d", H(r).hitPath), Y(f, "tabindex", H(r).key === H(Ft) ? 0 : -1), Y(f, "data-ribbon-key", H(r).key), Y(f, "aria-label", H(o)), Y(f, "aria-pressed", !H(i) && u() === H(r).itemId);
		}, [
			() => cr(H(r)),
			() => cr(H(r)) ? H(a) : "none",
			() => cr(H(r)) ? 1.25 : 0
		]), Or("pointerenter", f, (e) => H(i) ? Wn(H(r).groupKind, H(r).valueByCall, H(r).memberItemIds?.length ?? 0, e) : t.onHoverItem(H(r).itemId, e)), U("pointermove", f, (e) => H(i) ? Wn(H(r).groupKind, H(r).valueByCall, H(r).memberItemIds?.length ?? 0, e) : t.onHoverItem(H(r).itemId, e)), Or("pointerleave", f, () => {
			H(i) ? I(ve, null) : t.onHoverItem(null);
		}), U("mousedown", f, (e) => {
			H(i) && e.preventDefault();
		}), U("click", f, (e) => H(i) ? tr(e, H(r).groupKind, H(r).memberItemIds ?? []) : $n(e, H(r).itemId)), Or("focus", f, () => I(Be, H(r).key, !0)), U("keydown", f, (e) => {
			ar(e, H(r)) || (H(i) ? nr(e, H(r).groupKind, H(r).memberItemIds ?? []) : or(e, H(r).itemId));
		}), G(e, s);
	}), j(W);
	var Rr = B(W), Vr = (e) => {
		var t = Z_();
		J(t, 21, () => H(xt), $r, (e, t) => {
			var n = X_(), r = R(n), i = (e) => {
				var n = Y_();
				V(() => {
					Y(n, "d", H(t).fill), Y(n, "fill", `url(#${o}-input-hatch)`), Y(n, "mask", `url(#${o}-input-mask)`);
				}), G(e, n);
			};
			q(r, (e) => {
				H(St) && H(t).fill && e(i);
			});
			var a = B(r);
			V(() => Y(a, "d", H(t).line)), G(e, n);
		}), j(t), G(e, t);
	};
	q(Rr, (e) => {
		H(Qe).size > 0 && e(Vr);
	}), j(Er), Li(Er, (e) => O = e, () => O);
	var Hr = B(Er, 2);
	Y(Hr, "height", 500);
	var Ur = L(Hr);
	J(Ur, 19, () => H(ut).columns, (e) => e.callIndex, (e, n, r) => {
		var i = Br(), a = R(i), o = (e) => {
			var r = Q_();
			let i;
			var a = L(r), o = B(a);
			Y(o, "y", 483);
			var s = z(o, !0);
			j(r), V(() => {
				i = gi(r, 0, "call-target svelte-13ao2q1", null, i, {
					condensed: H(Ht) > 1,
					pinned: c() === H(n).callIndex
				}), Y(r, "data-call-index", H(n).callIndex), Y(r, "tabindex", H(n).callIndex === H(Rt) ? 0 : -1), Y(r, "aria-label", `Pin model call ${H(n).callIndex}`), Y(a, "x", H(n).x - 22), Y(a, "y", 500 - M.bottom + 5), Y(o, "x", H(n).x), K(s, H(n).callIndex);
			}), U("keydown", r, (e) => sr(e, H(n).callIndex)), U("click", r, (e) => {
				Dn(e) || (e.stopPropagation(), t.onPinCall(H(n).callIndex));
			}), G(e, r);
		}, s = /* @__PURE__ */ N(() => H(It).has(H(r)));
		q(a, (e) => {
			H(s) && e(o);
		}), G(e, i);
	});
	var Wr = B(Ur), Gr = L(Wr);
	J(Gr, 17, () => H(zt), ({ connector: e, index: t }) => e.key, (e, t) => {
		let n = () => H(t).connector, r = () => H(t).index;
		var i = ev(), a = R(i);
		let s;
		var c = B(a), l = (e) => {
			var t = $_();
			V(() => Y(t, "d", n().path)), G(e, t);
		};
		q(c, (e) => {
			n().fromItemId === H(Mt) && e(l);
		}), V(() => {
			s = gi(a, 0, "compaction-merge-emphasis svelte-13ao2q1", null, s, { emphasized: n().fromItemId === H(Mt) }), Y(a, "d", n().mergePath), Y(a, "fill", `url(#${o}-${r()})`);
		}), G(e, i);
	});
	var Kr = B(Gr), qr = (e) => {
		var r = tv();
		V((e) => {
			Y(r, "d", H(At).path), Y(r, "fill", e);
		}, [() => wa(t.indexed, H(At).itemId, n())]), G(e, r);
	};
	q(Kr, (e) => {
		H(At) && H(At) !== H(jt) && e(qr);
	});
	var Jr = B(Kr), Yr = (e) => {
		var r = nv();
		V((e) => {
			Y(r, "d", H(jt).path), Y(r, "fill", e);
		}, [() => wa(t.indexed, H(jt).itemId, n())]), G(e, r);
	};
	q(Jr, (e) => {
		H(jt) && e(Yr);
	}), J(B(Jr), 17, () => H(ut).versionMarks, (e) => e.key, (e, t) => {
		var n = rv();
		V(() => {
			Y(n, "x1", H(t).x), Y(n, "x2", H(t).x), Y(n, "y1", H(t).y0), Y(n, "y2", H(t).y1);
		}), G(e, n);
	}), j(Wr);
	var Xr = B(Wr), Zr = (e) => {
		var t = iv();
		V(() => {
			Y(t, "x", H(Yt).x), Y(t, "y", M.top), Y(t, "width", H(Yt).width), Y(t, "height", H(ut).innerHeight);
		}), G(e, t);
	};
	q(Xr, (e) => {
		H(Yt) && H(Yt).width > 0 && e(Zr);
	});
	var Qr = B(Xr), ei = (e) => {
		let t = /* @__PURE__ */ N(() => H(Ot).get(l()));
		var n = Br(), r = R(n), i = (e) => {
			var n = av();
			V(() => {
				Y(n, "x1", H(t).x), Y(n, "x2", H(t).x), Y(n, "y1", M.top), Y(n, "y2", 500 - M.bottom);
			}), G(e, n);
		};
		q(r, (e) => {
			H(t) && e(i);
		}), G(e, n);
	};
	q(Qr, (e) => {
		l() !== null && e(ei);
	});
	var ti = B(Qr), ni = (e) => {
		let t = /* @__PURE__ */ N(() => H(Ot).get(c()));
		var n = Br(), r = R(n), i = (e) => {
			var n = ov();
			V(() => {
				Y(n, "x1", H(t).x), Y(n, "x2", H(t).x), Y(n, "y1", M.top), Y(n, "y2", 500 - M.bottom);
			}), G(e, n);
		};
		q(r, (e) => {
			H(t) && e(i);
		}), G(e, n);
	};
	q(ti, (e) => {
		c() !== null && e(ni);
	}), j(Hr), j(wr), Li(wr, (e) => ne = e, () => ne);
	var ri = B(wr, 2), ii = (e) => {
		var t = sv();
		let r, i;
		var a = L(t), o = z(a, !0), s = B(a, 2), c = z(s), l = z(B(s, 2));
		j(t), V((e, n, a, s) => {
			r = gi(t, 1, "group-hover-card svelte-13ao2q1", null, r, { flip: H(ve).flip }), i = vi(t, "", i, {
				left: `${H(ve).x}px`,
				top: `${H(ve).y}px`,
				"--group-color": e
			}), K(o, n), K(c, `${a ?? ""}
            ${H(Et) ?? ""} at call ${H(ve).callIndex ?? "—" ?? ""}`), K(l, `${s ?? ""} items`);
		}, [
			() => Ca(H(ve).kind, n()),
			() => Io(H(ve).kind),
			() => tm(H(ve).total),
			() => H(ve).itemCount.toLocaleString()
		]), G(e, t);
	};
	q(ri, (e) => {
		H(ve) && e(ii);
	});
	var ai = B(ri, 2), oi = (e) => {
		var t = lv();
		J(B(L(t), 2), 17, () => [...new Set(H(ut).ribbons.map((e) => e.groupKind).filter(Boolean))], $r, (e, t) => {
			var r = cv(), i = L(r), a = B(i, 1, !0);
			j(r), V((e, t) => {
				vi(i, e), K(a, t);
			}, [() => `background:${Ca(H(t), n())}`, () => Io(H(t))]), G(e, r);
		}), j(t), G(e, t);
	};
	q(ai, (e) => {
		H(le) === "itemTypes" && e(oi);
	});
	var si = B(ai, 2), ci = (e) => {
		var t = mv(), n = B(L(t), 2), r = (e) => {
			var t = uv();
			_a(B(L(t), 2), {
				id: "unreconciled-input-note",
				label: "About unreconciled input",
				children: (e, t) => {
					Se(), G(e, zr("The reported input minus the content estimated in the River. It can include request\n                framing and estimation differences. It is not lost content, and it is not attributed\n                to cost."));
				},
				$$slots: { default: !0 }
			}), j(t), G(e, t);
		};
		q(n, (e) => {
			H(St) && e(r);
		});
		var i = B(n, 2), a = (e) => {
			var t = dv(), n = L(t), r = B(n), i = (e) => {
				var t = zr();
				V((e) => K(t, `estimate
                exceeds reported by ~${e ?? ""}`), [() => tm(H(Ct).reconstructed - H(Ct).reported)]), G(e, t);
			}, a = (e) => {
				var t = zr();
				V((e) => K(t, `unreconciled ~${e ?? ""}`), [() => tm(H(Ct).gap)]), G(e, t);
			};
			q(r, (e) => {
				H(Ct).reconstructed > H(Ct).reported ? e(i) : e(a, -1);
			}), Se(), j(t), V((e, t) => K(n, `Call ${H(Ct).callIndex ?? ""}: reconstructed ${e ?? ""} · reported ${t ?? ""} · `), [() => tm(H(Ct).reconstructed), () => tm(H(Ct).reported)]), G(e, t);
		}, o = (e) => {
			var t = fv(), n = z(t);
			V(() => K(n, `Call ${c() ?? l() ?? ""}: input comparison unavailable`)), G(e, t);
		}, s = (e) => {
			G(e, pv());
		};
		q(i, (e) => {
			H(Ct) ? e(a) : c() !== null || l() !== null ? e(o, 1) : e(s, -1);
		}), j(t), G(e, t);
	};
	q(si, (e) => {
		H(Qe).size > 0 && e(ci);
	});
	var ui = B(si, 2);
	{
		let e = /* @__PURE__ */ N(() => t.indexed.analysis.session.costSummary.apiEquivalent.calls > 0);
		uh(ui, {
			get mode() {
				return H(de);
			},
			get lastMode() {
				return y().economics.lastMode;
			},
			get cacheView() {
				return H(ue);
			},
			get cachePresentation() {
				return H(vt);
			},
			get costCopy() {
				return H(Ue);
			},
			get hasApiEquivalentCost() {
				return H(e);
			},
			onModeChange: Ln,
			onCacheViewChange: E,
			get headerElement() {
				return H(ee);
			},
			set headerElement(e) {
				I(ee, e, !0);
			},
			get triggerElement() {
				return H(S);
			},
			set triggerElement(e) {
				I(S, e, !0);
			}
		});
	}
	var di = B(ui, 2), fi = (e) => {
		Li(Im(e, {
			get indexed() {
				return t.indexed;
			},
			get columns() {
				return H(ut).columns;
			},
			get width() {
				return H(Xe);
			},
			get mode() {
				return H(de);
			},
			get cacheView() {
				return H(ue);
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
			onMarkClick: Zn,
			onReadoutChange: zn,
			onEventBreakdownChange: Bn
		}), (e) => I(be, e, !0), () => H(be));
	};
	q(di, (e) => {
		H(de) !== "off" && e(fi);
	}), j(xr), Li(xr, (e) => D = e, () => D), j(vr), Li(vr, (e) => k = e, () => k);
	var pi = B(vr, 2), mi = (e) => {
		{
			let t = /* @__PURE__ */ N(() => Io(H(me).kind));
			Km(e, {
				get label() {
					return H(t);
				},
				get anchor() {
					return H(me).anchor;
				},
				get memberLabels() {
					return H(We);
				},
				get memberCount() {
					return H(me).memberIds.length;
				},
				get callIndex() {
					return H(me).callIndex;
				},
				onClose: () => Un(),
				onShowItems: Gn
			});
		}
	};
	q(pi, (e) => {
		H(me) && e(mi);
	});
	var hi = B(pi, 2), _i = (e) => {
		Vm(e, {
			get breakdown() {
				return H(pe);
			},
			get positionStyle() {
				return H(ye);
			},
			get canZoomIn() {
				return H(qt);
			},
			onClose: () => Jn(),
			onZoom: Vn,
			onInspect: Xn,
			onInspectCompaction: Yn,
			get element() {
				return H(A);
			},
			set element(e) {
				I(A, e, !0);
			}
		});
	};
	q(hi, (e) => {
		H(pe) && e(_i);
	});
	var yi = B(hi, 2), bi = (e) => {
		var t = hv(), n = z(t, !0);
		V(() => K(n, H(fe) || "Hover or focus a call for an exact readout.")), G(e, t);
	};
	q(yi, (e) => {
		H(de) !== "off" && e(bi);
	}), j(gr), V(() => {
		_r = vi(gr, "", _r, { "--plot-left": `${M.left}px` }), Y(br, "aria-label", H(P)), vi(br, `top:${M.top}px;height:${H(ut).innerHeight}px`), K(Cr, `Context items flow horizontally through model calls. Tab reaches one context item and one
        call label; Up and Down arrows move between items in the stack, Home and End move to its
        bottom and top, Left and Right arrows move between calls, and Enter selects. Dashed vertical
        markers indicate compaction. In individual-item view, colour-blended connections show lossy
        summarization, not conserved tokens or source contributions to the summary. ${H(Dt) ?? ""}.
        ${H(Qe).size > 0 ? "The dashed reported-input reference is recorded after each call. Hatched unreconciled input is its approximate excess over reconstructed content, not recovered items or cost attribution. Where a session does not record its system prompt or tools, an Unrecorded request context item is measured from the reported input at the first call and after each compaction or model change, so the hatching shows change since then. Scaling includes the reference. Missing comparisons break the line." : ""}
        ${t.indexed.analysis.displayWeightUnit === "unavailable" ? "Token geometry is unavailable; ribbon regions are structural placeholders, not measured token widths." : ""}`), Tr = vi(wr, "", Tr, { width: `${H(Xe)}px` }), Y(Er, "viewBox", `0 0 ${H(Xe)} 500`), Y(Er, "width", H(Xe)), Y(Mr, "patternTransform", `matrix(${1 / (H(lt).scale || 1)} 0 0 ${1 / H(ht)} ${-H(lt).offset / (H(lt).scale || 1)} ${-H(gt) / H(ht)}) rotate(35)`), Y(Nr, "x", M.left), Y(Nr, "y", M.top), Y(Nr, "width", H(ut).innerWidth), Y(Nr, "height", H(ut).innerHeight), Y(W, "transform", H(_t)), Y(Hr, "viewBox", `0 0 ${H(Xe)} 500`), Y(Hr, "width", H(Xe)), Y(Wr, "transform", H(_t));
	}), U("pointerdown", xr, jn), U("pointermove", xr, In), Or("selectstart", xr, (e) => e.preventDefault()), Or("pointerleave", xr, () => {
		t.onHoverCall(null), t.onHoverItem(null);
	}), U("keydown", xr, ir), U("click", xr, Qn), Or("pointerleave", wr, () => t.onHoverCall(null)), G(e, fr);
	var xi = He(dr);
	return i(), xi;
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
var yv = /* @__PURE__ */ W("<span class=\"model svelte-182syzp\"> </span> <button type=\"button\" class=\"svelte-182syzp\">View details</button>", 1), bv = /* @__PURE__ */ W("<p class=\"empty svelte-182syzp\"> </p>"), xv = /* @__PURE__ */ W("<small class=\"svelte-182syzp\"> </small>"), Sv = /* @__PURE__ */ W("<p class=\"empty svelte-182syzp\">No items added or dropped.</p>"), Cv = /* @__PURE__ */ W("<li class=\"svelte-182syzp\"><span class=\"change added svelte-182syzp\" aria-hidden=\"true\">+</span> <button type=\"button\" class=\"svelte-182syzp\"><span class=\"visually-hidden svelte-182syzp\">Added</span> </button> <span class=\"size svelte-182syzp\"> </span></li>"), wv = /* @__PURE__ */ W("<li class=\"more svelte-182syzp\"> </li>"), Tv = /* @__PURE__ */ W("<li class=\"svelte-182syzp\"><span class=\"change dropped svelte-182syzp\" aria-hidden=\"true\">−</span> <button type=\"button\" class=\"svelte-182syzp\"><span class=\"visually-hidden svelte-182syzp\">Dropped</span> </button> <span class=\"size svelte-182syzp\"> </span></li>"), Ev = /* @__PURE__ */ W("<ul role=\"list\" class=\"svelte-182syzp\"><!> <!> <!> <!></ul>"), Dv = /* @__PURE__ */ W("<p class=\"empty svelte-182syzp\">No item estimates at this call.</p>"), Ov = /* @__PURE__ */ W("<li class=\"svelte-182syzp\"><button type=\"button\" class=\"svelte-182syzp\"> </button> <span class=\"size svelte-182syzp\"> </span></li>"), kv = /* @__PURE__ */ W("<ol role=\"list\" class=\"svelte-182syzp\"></ol> <button type=\"button\" class=\"link svelte-182syzp\">Show all in Composition</button>", 1), Av = /* @__PURE__ */ W("<span> </span>"), jv = /* @__PURE__ */ W("<div class=\"tools svelte-182syzp\"><h3 class=\"svelte-182syzp\">Tools invoked after this response</h3> <div class=\"tool-list svelte-182syzp\"></div></div>"), Mv = /* @__PURE__ */ W("<dl class=\"figures svelte-182syzp\"><div><dt class=\"svelte-182syzp\">Call</dt> <dd class=\"svelte-182syzp\"> </dd></div> <div><dt class=\"svelte-182syzp\">Input</dt> <dd class=\"svelte-182syzp\"> <!></dd></div> <div><dt class=\"svelte-182syzp\">Cost</dt> <dd class=\"svelte-182syzp\"> </dd></div></dl> <div><div><h3 title=\"Highwater's token estimates; they need not match the reported change in input.\" class=\"svelte-182syzp\"> </h3> <!></div> <div><h3 class=\"svelte-182syzp\">Largest items in context</h3> <!></div></div> <!>", 1), Nv = /* @__PURE__ */ W("<section class=\"panel call-overview svelte-182syzp\" aria-labelledby=\"call-overview-heading\"><div class=\"heading svelte-182syzp\"><h2 id=\"call-overview-heading\" class=\"svelte-182syzp\"> </h2> <!></div> <!></section>"), Pv = {
	hash: "svelte-182syzp",
	code: ".panel.svelte-182syzp {background:var(--surface);border-radius:var(--radius);padding:var(--panel-padding);min-width:0;}.heading.svelte-182syzp {display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px;}h2.svelte-182syzp {margin:0;font-size:var(--text-lg);}.model.svelte-182syzp {color:var(--secondary);font-size:var(--text-sm);overflow-wrap:anywhere;}.heading.svelte-182syzp button:where(.svelte-182syzp) {margin-left:auto;}.figures.svelte-182syzp {display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:8px 16px;margin:12px 0 0;}.figures.svelte-182syzp dt:where(.svelte-182syzp) {color:var(--secondary);font-size:var(--text-sm);}.figures.svelte-182syzp dd:where(.svelte-182syzp) {margin:0;color:var(--text-strong);font-weight:600;font-variant-numeric:tabular-nums;}.figures.svelte-182syzp small:where(.svelte-182syzp) {margin-left:4px;color:var(--secondary);font-weight:400;}.lists.svelte-182syzp {display:grid;grid-template-columns:minmax(0, 1fr);gap:12px 24px;margin-top:14px;}.lists.two-columns.svelte-182syzp {grid-template-columns:repeat(2, minmax(0, 1fr));}h3.svelte-182syzp {margin:0 0 6px;color:var(--text-strong);font-size:var(--text-sm);}ul.svelte-182syzp,\n  ol.svelte-182syzp {margin:0;padding:0;list-style:none;}li.svelte-182syzp {display:flex;align-items:baseline;gap:6px;min-width:0;padding:2px 0;}li.svelte-182syzp button:where(.svelte-182syzp) {min-width:0;padding:0;overflow:hidden;border:0;background:transparent;color:var(--text);text-align:left;text-overflow:ellipsis;white-space:nowrap;}li.svelte-182syzp button:where(.svelte-182syzp):hover {color:var(--accent);text-decoration:underline;}.change.svelte-182syzp {flex:none;width:1ch;font-weight:700;}.added.svelte-182syzp {color:var(--accent);}.dropped.svelte-182syzp {color:var(--secondary);}.size.svelte-182syzp {flex:none;margin-left:auto;color:var(--secondary);font-size:var(--text-sm);font-variant-numeric:tabular-nums;}.more.svelte-182syzp,\n  .empty.svelte-182syzp {color:var(--secondary);font-size:var(--text-sm);}.empty.svelte-182syzp {margin:8px 0 0;}.link.svelte-182syzp {margin-top:6px;padding:0;border:0;background:transparent;color:var(--accent);font-size:var(--text-sm);}.tools.svelte-182syzp {margin-top:14px;}.tool-list.svelte-182syzp {display:flex;flex-wrap:wrap;gap:6px;}.tool-chip.svelte-182syzp {padding:2px 8px;border:1px solid var(--separator);border-radius:999px;font-size:var(--text-sm);}.tool-chip.failed.svelte-182syzp {border-color:var(--error);color:var(--error);}.visually-hidden.svelte-182syzp {position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;}"
};
function Fv(e, t) {
	Ve(t, !0), li(e, Pv);
	let n = X(t, "following", 3, !1), r = X(t, "twoColumns", 3, !1), i = X(t, "onSelectItem", 3, () => {}), a = X(t, "onViewDetails", 3, () => {}), o = X(t, "onShowComposition", 3, () => {}), s = /* @__PURE__ */ N(() => {
		if (!t.call) return null;
		let e = t.indexed.analysis.modelCalls.findIndex((e) => e.index === t.call.index);
		return e > 0 ? t.indexed.analysis.modelCalls[e - 1] : null;
	}), c = /* @__PURE__ */ N(() => t.call?.reportedPromptTokens != null && H(s)?.reportedPromptTokens != null ? t.call.reportedPromptTokens - H(s).reportedPromptTokens : null), l = /* @__PURE__ */ N(() => ju(t.indexed, t.call?.addedItemIds ?? [], t.call)), u = /* @__PURE__ */ N(() => ju(t.indexed, t.call?.droppedItemIds ?? [], H(s))), d = /* @__PURE__ */ N(() => Mu(t.call?.addedItemIds ?? [], H(l).items)), f = /* @__PURE__ */ N(() => Mu(t.call?.droppedItemIds ?? [], H(u).items)), p = /* @__PURE__ */ N(() => t.call ? Go(Zo(t.indexed, t.call.index)?.items ?? []).slice(0, 5) : []), m = /* @__PURE__ */ N(() => {
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
	var v = Nv(), y = L(v), b = L(y), x = z(b, !0), S = B(b, 2), ee = (e) => {
		var n = yv(), r = R(n), i = z(r), o = B(r, 2);
		V(() => K(i, `${t.call.provider ?? "Unknown provider" ?? ""} / ${t.call.model ?? "Unknown model" ?? ""}`)), U("click", o, function(...e) {
			a()?.apply(this, e);
		}), G(e, n);
	};
	q(S, (e) => {
		t.call && e(ee);
	}), j(y);
	var C = B(y, 2), te = (e) => {
		var n = bv(), r = z(n, !0);
		V(() => K(r, t.indexed.analysis.modelCalls.length === 0 ? "No model calls yet." : "Select a call in the chart to see it here.")), G(e, n);
	}, w = (e) => {
		var n = Mv(), a = R(n), v = L(a), y = z(B(L(v), 2));
		j(v);
		var b = B(v, 2), x = B(L(b), 2), S = L(x), ee = B(S), C = (e) => {
			var t = xv(), n = z(t, !0);
			V((e) => {
				Y(t, "title", `Change since call ${H(s)?.index}`), K(n, e);
			}, [() => _(H(c))]), G(e, t);
		};
		q(ee, (e) => {
			H(c) !== null && !t.call.usage.placeholder && e(C);
		}), j(x), j(b);
		var te = B(b, 2), w = z(B(L(te), 2), !0);
		j(te), j(a);
		var T = B(a, 2);
		let E;
		var D = L(T), O = L(D), ne = z(O), re = B(O, 2), ie = (e) => {
			G(e, Sv());
		}, ae = (e) => {
			var n = Ev(), r = L(n);
			J(r, 16, () => H(d).slice(0, 5), (e) => e, (e, t) => {
				let n = /* @__PURE__ */ N(() => H(l).items.get(t));
				var r = Cv(), a = B(L(r), 2), o = B(L(a), 1, !0);
				j(a);
				var s = B(a, 2), c = z(s, !0);
				j(r), V((e, t) => {
					K(o, e), Y(s, "title", H(n)?.partial ? "Partial or missing estimate" : void 0), K(c, t);
				}, [() => h(t), () => H(n)?.tokens == null ? "Unknown" : Z(H(n).tokens)]), U("click", a, () => i()(t)), G(e, r);
			});
			var a = B(r, 2), o = (e) => {
				var n = wv(), r = z(n);
				V((e) => K(r, `${e ?? ""} more added`), [() => Q(t.call.addedItemIds.length - 5)]), G(e, n);
			};
			q(a, (e) => {
				t.call.addedItemIds.length > 5 && e(o);
			});
			var s = B(a, 2);
			J(s, 16, () => H(f).slice(0, 5), (e) => e, (e, t) => {
				let n = /* @__PURE__ */ N(() => H(u).items.get(t));
				var r = Tv(), a = B(L(r), 2), o = B(L(a), 1, !0);
				j(a);
				var s = B(a, 2), c = z(s, !0);
				j(r), V((e, t) => {
					K(o, e), Y(s, "title", H(n)?.partial ? "Partial or missing estimate" : void 0), K(c, t);
				}, [() => h(t), () => H(n)?.tokens == null ? "Unknown" : Z(H(n).tokens)]), U("click", a, () => i()(t)), G(e, r);
			});
			var c = B(s, 2), p = (e) => {
				var n = wv(), r = z(n);
				V((e) => K(r, `${e ?? ""} more dropped`), [() => Q(t.call.droppedItemIds.length - 5)]), G(e, n);
			};
			q(c, (e) => {
				t.call.droppedItemIds.length > 5 && e(p);
			}), j(n), G(e, n);
		};
		q(re, (e) => {
			t.call.addedItemIds.length === 0 && t.call.droppedItemIds.length === 0 ? e(ie) : e(ae, -1);
		}), j(D);
		var oe = B(D, 2), se = B(L(oe), 2), ce = (e) => {
			G(e, Dv());
		}, le = (e) => {
			var t = kv(), n = R(t);
			J(n, 21, () => H(p), (e) => e.id, (e, t) => {
				var n = Ov(), r = L(n), a = z(r, !0), o = z(B(r, 2));
				j(n), V((e, n) => {
					K(a, H(t).label), K(o, `${e ?? ""}${n ?? ""}`);
				}, [() => Z(H(t).tokens), () => H(t).share === null ? "" : ` · ${Va(H(t).share)}`]), U("click", r, () => i()(H(t).id)), G(e, n);
			}), j(n), U("click", B(n, 2), function(...e) {
				o()?.apply(this, e);
			}), G(e, t);
		};
		q(se, (e) => {
			H(p).length === 0 ? e(ce) : e(le, -1);
		}), j(oe), j(T);
		var ue = B(T, 2), de = (e) => {
			var t = jv(), n = B(L(t), 2);
			J(n, 21, () => H(m), (e) => e.name, (e, t) => {
				var n = Av();
				let r;
				var i = z(n);
				V(() => {
					r = gi(n, 1, "tool-chip svelte-182syzp", null, r, { failed: H(t).failed }), K(i, `${H(t).name ?? ""}${H(t).count > 1 ? ` × ${H(t).count}` : ""}${H(t).failed ? " · failed" : ""}`);
				}), G(e, n);
			}), j(n), j(t), G(e, t);
		};
		q(ue, (e) => {
			H(m).length > 0 && e(de);
		}), V((e, n, i, a, o) => {
			K(y, `${t.call.index ?? ""} of ${e ?? ""}`), K(S, `${n ?? ""} `), K(w, i), E = gi(T, 1, "lists svelte-182syzp", null, E, { "two-columns": r() }), K(ne, `Context changes · ${a ?? ""} · ${o ?? ""}`);
		}, [
			() => Q(t.indexed.analysis.modelCalls.length),
			() => t.call.usage.placeholder ? "Unavailable" : Z(t.call.reportedPromptTokens),
			() => t.call.usage.placeholder ? "Unavailable" : Zl(t.call.costAssessment),
			() => g(t.call.addedItemIds.length, "added", H(l)),
			() => g(t.call.droppedItemIds.length, "dropped", H(u))
		]), G(e, n);
	};
	q(C, (e) => {
		t.call ? e(w, -1) : e(te);
	}), j(v), V(() => K(x, t.call ? n() ? "Latest call" : `Call ${t.call.index}` : "Latest call")), G(e, v), He();
}
kr(["click"]);
//#endregion
//#region src/lib/state/session-sections.ts
var Iv = [
	"summary",
	"call",
	"chart",
	"details",
	"lifespans"
], Lv = [
	"summary",
	"chart",
	"details",
	"lifespans"
], Rv = [
	"summary",
	"call",
	"chart",
	"details",
	"lifespans"
];
function zv(e, t = Lv) {
	let n = [];
	for (let r of e ?? t) Iv.includes(r) && !n.includes(r) && n.push(r);
	return t.forEach((e, r) => {
		if (n.includes(e)) return;
		let i = t.slice(0, r).reverse().find((e) => n.includes(e));
		n.splice(i === void 0 ? 0 : n.indexOf(i) + 1, 0, e);
	}), n;
}
var Bv = /* @__PURE__ */ new Set(["summary", "call"]);
function Vv(e) {
	let t = /* @__PURE__ */ new Map(), n = e.indexOf("details"), r = (e) => e !== void 0 && !Bv.has(e), i = n >= 0 && (r(e[n - 1]) || r(e[n + 1])), a = i ? e.filter((e) => e !== "details") : e;
	if (a.forEach((e, n) => t.set(e, {
		column: Bv.has(e) || e === "details" ? "1 / -1" : "1",
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
var Hv = /* @__PURE__ */ W("<div class=\"summary-section svelte-okw1rh\"><!></div>"), Uv = /* @__PURE__ */ W("<div class=\"call-section svelte-okw1rh\"><!></div>"), Wv = /* @__PURE__ */ W("<button type=\"button\" aria-label=\"Copy view link\"> </button>"), Gv = /* @__PURE__ */ W("<p class=\"river-pending svelte-okw1rh\" role=\"status\">Drawing the River…</p>"), Kv = /* @__PURE__ */ W("<div class=\"selection-location-note svelte-okw1rh\" role=\"status\"><span>The selected item has no presence in the current River view.</span> <button type=\"button\">Reveal in River</button> <button type=\"button\">Clear item</button></div>"), qv = /* @__PURE__ */ W("<div class=\"item-hover-position svelte-okw1rh\"><!></div>"), Jv = /* @__PURE__ */ W("<!> <div class=\"chart-area svelte-okw1rh\"><!> <!> <!></div>", 1), Yv = /* @__PURE__ */ W("<div class=\"no-model-calls svelte-okw1rh\"><h3 class=\"svelte-okw1rh\">No model calls</h3> <p class=\"svelte-okw1rh\">This session has no completed assistant model responses on its current branch.</p> <p class=\"svelte-okw1rh\">Terminal compaction summaries, if present, remain available in Context lifespans.</p></div>"), Xv = /* @__PURE__ */ W("<section class=\"panel river-panel svelte-okw1rh\"><div class=\"panel-head svelte-okw1rh\"><div class=\"svelte-okw1rh\"><h2 class=\"svelte-okw1rh\"> </h2> <!></div> <div class=\"panel-actions svelte-okw1rh\"><!> <a class=\"mobile-view-details svelte-okw1rh\" href=\"#selected-item-summary\" aria-label=\"View details\"> </a> <button type=\"button\"> </button></div></div> <div class=\"visualization-tabs svelte-okw1rh\" role=\"tablist\" aria-label=\"Context visualization\"><button id=\"river-tab\" type=\"button\" role=\"tab\" aria-controls=\"river-panel\" class=\"svelte-okw1rh\">River</button> <button id=\"composition-tab\" type=\"button\" role=\"tab\" aria-controls=\"composition-panel\" class=\"svelte-okw1rh\">Composition</button></div> <div id=\"river-panel\" class=\"visualization-panel svelte-okw1rh\" role=\"tabpanel\" aria-labelledby=\"river-tab\" tabindex=\"0\"><!></div> <div id=\"composition-panel\" class=\"visualization-panel svelte-okw1rh\" role=\"tabpanel\" aria-labelledby=\"composition-tab\" tabindex=\"0\"><!></div></section>"), Zv = /* @__PURE__ */ W("<aside id=\"inspector\" aria-label=\"Inspector\" tabindex=\"-1\"><!></aside>"), Qv = /* @__PURE__ */ W("<section class=\"panel lifespan-panel svelte-okw1rh\"><!></section>"), $v = /* @__PURE__ */ W("<div class=\"session-view\" role=\"presentation\"><div></div></div>"), ey = {
	hash: "svelte-okw1rh",
	code: ".panel.svelte-okw1rh {background:var(--surface);border:0;border-radius:var(--radius);padding:var(--panel-padding);margin-top:14px;min-width:0;}.panel-head.svelte-okw1rh {display:flex;justify-content:space-between;gap:16px;align-items:start;margin-bottom:10px;min-width:0;}.panel-head.svelte-okw1rh > :where(.svelte-okw1rh) {min-width:0;}.river-panel.svelte-okw1rh > .panel-head:where(.svelte-okw1rh) > div:where(.svelte-okw1rh):first-child {display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;}h2.svelte-okw1rh {font-size:var(--text-lg);margin:0;}.panel-actions.svelte-okw1rh {display:flex;align-items:center;gap:8px;flex-wrap:wrap;}.mobile-view-details.svelte-okw1rh {display:none;padding:var(--control-padding);border:1px solid var(--separator);border-radius:var(--control-radius);background:var(--surface);color:var(--text);text-decoration:none;white-space:nowrap;}.mobile-view-details.svelte-okw1rh:hover {background:var(--surface-raised);}#inspector.svelte-okw1rh {scroll-margin-top:16px;}.selected-item-summary {scroll-margin:16px;}\n  /* Sections follow their order in one column. A wide view with a selection places them with the\n     positions from wideSectionPlacement, which put the details in a second column. */.exploration-grid.svelte-okw1rh {display:grid;min-width:0;grid-template-columns:minmax(0, 1fr);align-items:start;gap:var(--panel-gap);}.exploration-grid.svelte-okw1rh > :where(.svelte-okw1rh) {grid-column:1;min-width:0;margin-top:0;}\n  @container highwater (min-width: 1051px) {.exploration-grid.occupied.svelte-okw1rh {grid-template-columns:minmax(0, 1fr) 320px;}.exploration-grid.occupied.svelte-okw1rh > :where(.svelte-okw1rh) {grid-column:var(--wide-column);grid-row:var(--wide-row);}.exploration-grid.occupied.svelte-okw1rh > .inspector-column.beside:where(.svelte-okw1rh) {position:sticky;top:16px;max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);overflow-y:auto;overscroll-behavior:contain;scrollbar-color:var(--control-border) var(--plot);scrollbar-width:thin;}\n  }.visualization-tabs.svelte-okw1rh {display:flex;gap:6px;margin:0 0 10px;border-bottom:1px solid var(--separator);}.visualization-tabs.svelte-okw1rh button:where(.svelte-okw1rh) {background:transparent;border:0;border-bottom:2px solid transparent;border-radius:0;}.visualization-tabs.svelte-okw1rh button[aria-selected='true']:where(.svelte-okw1rh) {border-color:var(--accent);background:transparent;color:var(--accent);}.visualization-panel.svelte-okw1rh {min-width:0;}.visualization-panel[hidden].svelte-okw1rh {display:none;}.no-model-calls.svelte-okw1rh {padding:12px;border:1px solid var(--separator);border-radius:var(--radius);background:var(--plot);}.no-model-calls.svelte-okw1rh h3:where(.svelte-okw1rh) {margin:0;color:var(--text-strong);font-size:14px;}.no-model-calls.svelte-okw1rh p:where(.svelte-okw1rh) {margin:4px 0 0;color:var(--secondary);font-size:var(--text-sm);}.inspector-column.svelte-okw1rh {display:grid;align-self:start;gap:var(--panel-gap);min-width:0;}.chart-area.svelte-okw1rh {position:relative;min-width:0;}.river-pending.svelte-okw1rh {min-height:360px;margin:0;padding:24px;color:var(--text);}.selection-location-note.svelte-okw1rh {display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px;color:var(--text);font-size:var(--text-sm);}.item-hover-position.svelte-okw1rh {position:fixed;z-index:5;pointer-events:none;}\n  @container highwater (max-width: 1050px) {.mobile-view-details.svelte-okw1rh {display:inline-flex;align-items:center;}\n  }\n  @container highwater (max-width: 850px) {.item-hover-position.svelte-okw1rh {display:none;}\n  }"
};
function ty(e, t) {
	Ve(t, !0), li(e, ey);
	let n = X(t, "sessions", 19, () => []), r = X(t, "sessionReference", 3, null), i = X(t, "presentation", 31, () => en(Gi())), a = X(t, "viewState", 15, null), o = X(t, "riverSessionId", 15, null), s = X(t, "onPreferencesChange", 3, () => {}), c = X(t, "copyDisabled", 3, !1), l = X(t, "keyboardScope", 3, "window"), u = X(t, "onPin", 3, () => {}), d = X(t, "sections", 3, Lv), f = X(t, "following", 3, !1), p = zv(yr(() => d())), m = Vv(p), h = /* @__PURE__ */ N(() => f() && p.includes("call"));
	function g(e) {
		let t = m.get(e);
		return `--wide-column:${t.column};--wide-row:${t.row}`;
	}
	let _ = /* @__PURE__ */ N(() => r() ?? t.indexed.analysis.session.id), v = /* @__PURE__ */ F(Hi()), y = /* @__PURE__ */ F(Hi()), b = null, x = null, S = /* @__PURE__ */ F(0), ee = /* @__PURE__ */ F(0), C = /* @__PURE__ */ F(null);
	function te(e) {
		i(e), s()(e);
	}
	let w = /* @__PURE__ */ F(Qi()), T, E = /* @__PURE__ */ F("river"), D = /* @__PURE__ */ F("cumulative"), O = /* @__PURE__ */ F(""), ne = /* @__PURE__ */ F(null), re = /* @__PURE__ */ F(null), ie = 0, ae = 0, oe = /* @__PURE__ */ F(null), se = 0, ce = () => ({
		ready: !1,
		isFitAll: !0,
		zoomFactor: 1,
		canZoomIn: !1,
		canZoomOut: !1,
		totalCallCount: 0,
		firstVisibleCallIndex: null,
		lastVisibleCallIndex: null,
		hasOverflow: !1
	}), le = /* @__PURE__ */ F(ce()), ue = /* @__PURE__ */ F(null), de = /* @__PURE__ */ F(null), fe = /* @__PURE__ */ F(null), pe = /* @__PURE__ */ F(null), me = /* @__PURE__ */ F(!1), he = /* @__PURE__ */ F(!1);
	function ge(e) {
		let t = e > 0 && (H(me) ? e <= 540 : e <= 520);
		t !== H(me) && I(me, t, !0);
		let n = e > 0 && (H(he) ? e <= 780 : e <= 760);
		n !== H(he) && I(he, n, !0);
	}
	function _e(e) {
		e !== o() && requestAnimationFrame(() => setTimeout(() => {
			(r() ?? t.indexed.analysis.session.id) !== e || Ce || o(e);
		}));
	}
	let ve = /* @__PURE__ */ N(() => H(w).pinnedCallIndex === null ? null : t.indexed?.callByIndex.get(H(w).pinnedCallIndex) ?? null), k = /* @__PURE__ */ N(() => H(w).selectedItemId ? t.indexed?.itemById.get(H(w).selectedItemId) ?? null : null), ye = /* @__PURE__ */ N(() => H(k) !== null && H(k).presence.length > 0 && H(de)?.itemId === H(k).id && !H(de).visible), A = /* @__PURE__ */ N(() => H(w).hoveredItemId ? t.indexed?.itemById.get(H(w).hoveredItemId) ?? null : null), be = /* @__PURE__ */ N(() => t.indexed?.analysis.modelCalls.map((e) => e.index) ?? []), xe = /* @__PURE__ */ N(() => H(E) === "river" ? "Context River" : "Composition");
	Tn(() => {
		let e = t.indexed, n = H(_);
		yr(() => {
			let t = x;
			if (t === e) {
				_e(n);
				return;
			}
			if (t && t.analysis.session.id === e.analysis.session.id) {
				let n = H(w).pinnedCallIndex;
				I(w, ta(H(w), t, e)), n !== null && H(w).pinnedCallIndex === null && H(D) === "cumulative" && I(O, "The pinned call is no longer available; cumulative scope now covers the whole session."), H(oe) && !e.itemById.has(H(oe).itemId) && I(oe, null), H(ne)?.kind === "reveal-item" && (!e.itemById.has(H(ne).itemId) || H(w).selectedItemId !== H(ne).itemId ? I(ne, null) : I(ne, {
					...H(ne),
					referenceCallIndex: H(w).pinnedCallIndex
				}));
			} else t && (I(w, Qi()), I(v, Hi()), I(y, Hi()), I(E, "river"), I(D, "cumulative"), I(O, ""), I(ne, null), I(oe, null), I(de, null), Ae(), I(C, null), I(S, 0), I(ee, 0));
			x = e, _e(n);
		});
	}), Tn(() => {
		a({
			linkedView: {
				session: H(_),
				view: H(E),
				display: i().river.display,
				scope: H(D),
				pin: H(w).pinnedCallIndex,
				item: H(w).selectedItemId,
				range: H(C) ? H(C).range : ua(H(le), H(be))
			},
			navigationRevision: H(ee),
			riverReady: o() === H(_),
			settled: H(E) === "composition" || H(be).length === 0 || H(le).ready && (!H(ne) || H(S) === H(ne).id)
		});
	}), Tn(() => {
		t.indexed?.analysis.modelCalls.length === 0 && (H(ne) !== null || H(le).ready || !H(le).isFitAll || H(le).totalCallCount !== 0) && (I(ne, null), Ae());
	}), Tn(() => {
		H(w), H(E), t.indexed, H(ve), H(k), o(), b = Vi(T).activeElement;
	}), Cn(() => {
		H(w), H(E), t.indexed, H(ve), H(k), o(), yr(Se);
	});
	function Se() {
		b && !b.isConnected && (Vi(T).activeElement === document.body || Vi(T).activeElement === null || !Vi(T).activeElement?.isConnected) && (Vi(T).getElementById("selected-item-summary") ?? Vi(T).getElementById("pinned-call-summary") ?? Vi(T).getElementById(H(E) === "river" ? "river-tab" : "composition-tab"))?.focus({ preventScroll: !0 });
	}
	Cn(() => {
		H(ue), H(A), H(fe), yr(Ke);
	});
	let Ce = !1;
	zi(() => {
		l() === "window" && window.addEventListener("keydown", Ze);
		let e = typeof ResizeObserver > "u" ? null : new ResizeObserver(([e]) => {
			let t = e.contentRect.width;
			requestAnimationFrame(() => {
				Ce || ge(t);
			});
		});
		return e?.observe(T), () => {
			Ce = !0, e?.disconnect(), l() === "window" && window.removeEventListener("keydown", Ze);
		};
	});
	function we(e) {
		return e.session !== H(_) || o() !== H(_) ? !1 : (I(w, {
			...Qi(),
			selectedItemId: e.item,
			pinnedCallIndex: e.pin
		}), I(E, e.view, !0), i({
			...i(),
			river: {
				...i().river,
				display: e.display
			}
		}), I(D, e.scope, !0), I(O, ""), I(C, { range: e.range }), I(ne, t.indexed.analysis.modelCalls.length ? e.range ? {
			id: ++ie,
			kind: "range",
			startCallIndex: e.range[0],
			endCallIndex: e.range[1]
		} : {
			id: ++ie,
			kind: "fit"
		} : null), H(ne) || I(C, null), !0);
	}
	function Te() {
		let e = H(be)[H(be).length - 1];
		if (e !== void 0 && p.includes("call")) {
			I(w, {
				...H(w),
				pinnedCallIndex: e
			}), I(O, ""), I(ee, H(ee) + 1), I(ne, {
				id: ++ie,
				kind: "recent",
				minCallSpacing: 4
			});
			return;
		}
		Be("latest");
	}
	function Ee() {
		u()(), I(w, {
			...H(w),
			pinnedCallIndex: null
		});
	}
	function De() {
		gr().then(() => {
			let e = Vi(T).getElementById("pinned-call-summary");
			e?.scrollIntoView({ block: "start" }), e?.focus({ preventScroll: !0 });
		});
	}
	function Oe() {
		I(E, "composition"), I(D, "atCall"), gr().then(() => {
			let e = Vi(T).getElementById("composition-tab");
			e?.scrollIntoView({ block: "start" }), e?.focus({ preventScroll: !0 });
		});
	}
	function ke(e) {
		I(S, e, !0), e === H(ne)?.id && I(C, null);
	}
	function Ae() {
		I(le, ce());
	}
	function je(e) {
		H(w).hoveredCallIndex !== e && I(w, {
			...H(w),
			hoveredCallIndex: e
		});
	}
	function Me(e) {
		u()(), I(w, {
			...H(w),
			pinnedCallIndex: e
		}), I(O, "");
	}
	function Ne(e) {
		I(D, e, !0);
	}
	function Pe(e) {
		H(E) === "river" && I(le, e);
	}
	function Fe(e) {
		(e?.itemId !== H(de)?.itemId || e?.visible !== H(de)?.visible) && I(de, e);
	}
	function Ie(e) {
		t.indexed?.itemById.has(e) && H(be).length !== 0 && (I(ee, H(ee) + 1), I(E, "river"), I(ne, {
			id: ++ie,
			kind: "reveal-item",
			itemId: e,
			referenceCallIndex: H(w).pinnedCallIndex
		}));
	}
	function M(e) {
		t.indexed?.itemById.has(e) && I(oe, {
			requestId: ++se,
			itemId: e
		});
	}
	function Le() {
		let e = H(_), n = H(k)?.id ?? null, r = ++ae;
		if (n === null) {
			let e = Vi(T).getElementById("inspector");
			if (!e) return;
			e.scrollIntoView({ block: "start" }), e.focus({ preventScroll: !0 });
			return;
		}
		gr().then(() => {
			if (r !== ae || e !== H(_) || H(w).selectedItemId !== n || !t.indexed?.itemById.has(n)) return;
			let i = Vi(T).getElementById("inspector"), a = Vi(T).getElementById("selected-item-summary");
			if (i && a) {
				if (getComputedStyle(i).overflowY !== "visible" && i.scrollHeight > i.clientHeight) {
					let e = i.getBoundingClientRect(), t = a.getBoundingClientRect();
					t.top < e.top + 12 ? i.scrollTop -= e.top + 12 - t.top : t.bottom > e.bottom - 12 && (i.scrollTop += t.bottom - (e.bottom - 12)), a.focus({ preventScroll: !0 });
				} else a.scrollIntoView({ block: "start" }), a.focus({ preventScroll: !0 });
			}
		});
	}
	function Re(e) {
		if (!t.indexed?.callByIndex.has(e)) return;
		let n = H(_), r = t.indexed.callByIndex.get(e)?.sourceRecordId, i = H(w).selectedItemId, a = ++ae;
		Me(e), gr().then(() => {
			if (a !== ae || n !== H(_) || H(w).selectedItemId !== i || H(ve)?.sourceRecordId !== r) return;
			let e = Vi(T).getElementById("pinned-call-summary");
			e?.scrollIntoView({ block: "nearest" }), e?.focus({ preventScroll: !0 });
		});
	}
	function ze() {
		if (H(h)) {
			qe(null);
			return;
		}
		u()(), I(w, Qi()), I(O, ""), I(ne, null);
	}
	function Be(e) {
		(e === "fit" || e === "latest") && I(ee, H(ee) + 1), I(ne, {
			id: ++ie,
			kind: e
		});
	}
	function Ue(e) {
		Me(e), I(ne, {
			id: ++ie,
			kind: "ensure-call",
			callIndex: e
		});
	}
	function We(e) {
		let t;
		if (e.key === "Home") t = "river";
		else if (e.key === "End") t = "composition";
		else if (e.key === "ArrowLeft" || e.key === "ArrowRight") t = H(E) === "river" ? "composition" : "river";
		else return;
		e.preventDefault(), I(E, t, !0);
		let n = t === "river" ? "river-tab" : "composition-tab";
		Vi(T).getElementById(n)?.focus();
	}
	function Ge(e, t) {
		e === null ? (I(ue, null), I(pe, null)) : t && I(ue, {
			x: t.clientX,
			y: t.clientY
		}), H(w).hoveredItemId !== e && I(w, {
			...H(w),
			hoveredItemId: e
		});
	}
	function Ke() {
		if (!H(fe) || !H(ue)) return;
		let e = H(fe).getBoundingClientRect();
		if (e.width === 0 || e.height === 0) return;
		let { x: t, y: n } = H(ue), r = t + 14, i = n + 14, a = r + e.width <= window.innerWidth - 12 ? r : t - 14 - e.width, o = i + e.height <= window.innerHeight - 12 ? i : n - 14 - e.height, s = {
			left: Math.round(Math.min(Math.max(12, a), Math.max(12, window.innerWidth - e.width - 12))),
			top: Math.round(Math.min(Math.max(12, o), Math.max(12, window.innerHeight - e.height - 12)))
		};
		(s.left !== H(pe)?.left || s.top !== H(pe)?.top) && I(pe, s);
	}
	function qe(e) {
		H(ne)?.kind === "reveal-item" && H(ne).itemId !== e && I(ne, null), H(oe) && H(oe).itemId !== e && I(oe, null), I(w, {
			...H(w),
			selectedItemId: e
		});
	}
	function Je(e, t) {
		qe(e), t !== void 0 && Me(t);
	}
	function Ye(e) {
		H(ne)?.kind === "reveal-item" && I(ne, null), u()(), I(w, {
			...H(w),
			pinnedCallIndex: e
		});
	}
	function Xe() {
		let e = Vi(T).activeElement?.closest("details[open]") ?? Vi(T).querySelector(".view-options[open]");
		if (e instanceof HTMLDetailsElement) return e.open = !1, e.querySelector("summary")?.focus(), !0;
		if (H(re)?.dismissEconomics()) return !0;
		if (H(w).selectedItemId !== null || H(w).pinnedCallIndex !== null && !H(h)) {
			let e = H(w).pinnedCallIndex;
			return I(w, $i(H(w))), H(w).pinnedCallIndex !== e && u()(), H(ne)?.kind === "reveal-item" && H(w).selectedItemId !== H(ne).itemId && I(ne, null), !0;
		}
		return !H(le).isFitAll && (Be("fit"), !0);
	}
	function Ze(e) {
		if (e.key === "Escape" && !e.defaultPrevented) {
			(Xe() || l() === "window") && e.preventDefault();
			return;
		}
		if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || H(E) !== "river") return;
		let n = e.key === "ArrowLeft" || e.key === "h" ? -1 : e.key === "ArrowRight" || e.key === "l" ? 1 : null;
		if (n === null) return;
		let r = e.target;
		if (!(r instanceof Element)) return;
		let i = l() === "window" && r === document.body && document.querySelectorAll("main").length === 1, a = t.keyboardOwner ?? T;
		if (!i && !a?.contains(r) || (e.key === "h" || e.key === "l") && i || r.closest("input, textarea, select, [contenteditable]:not([contenteditable=\"false\"]), [role=\"tab\"], [role=\"slider\"], [role=\"spinbutton\"], [role=\"combobox\"], [role=\"listbox\"], [role=\"menu\"], [role=\"radio\"]")) return;
		let o = l() === "root" ? r.closest("[data-call-index]")?.getAttribute("data-call-index") : null, s = na(H(be), o ? Number(o) : H(w).pinnedCallIndex, H(le), n);
		e.preventDefault(), s !== null && (i && T.querySelector(".river-scroll")?.focus({ preventScroll: !0 }), Ue(s), l() === "root" && r.closest(".call-target") && gr().then(() => T.querySelector(`.call-target[aria-label="Pin model call ${s}"]`)?.focus({ preventScroll: !0 })));
	}
	var Qe = {
		restoreView: we,
		followLatest: Te
	}, $e = $v();
	Or("resize", rn, Ke);
	var et = L($e);
	let tt;
	return J(et, 20, () => p, (e) => e, (e, r) => {
		var a = Br(), s = R(a), u = (e) => {
			var i = Hv();
			Qr(L(i), () => H(_), (e) => {
				xp(e, {
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
						return H(he);
					}
				});
			}), j(i), V((e) => vi(i, e), [() => g(r)]), G(e, i);
		}, d = (e) => {
			var n = Uv(), i = L(n);
			{
				let e = /* @__PURE__ */ N(() => !H(he));
				Fv(i, {
					get indexed() {
						return t.indexed;
					},
					get call() {
						return H(ve);
					},
					get following() {
						return f();
					},
					get twoColumns() {
						return H(e);
					},
					onSelectItem: (e) => {
						qe(e), Le();
					},
					onViewDetails: De,
					onShowComposition: Oe
				});
			}
			j(n), V((e) => vi(n, e), [() => g(r)]), G(e, n);
		}, p = (e) => {
			var n = Xv(), a = L(n), s = L(a), u = L(s), d = z(u, !0), f = B(u, 2), p = (e) => {
				{
					let n = /* @__PURE__ */ N(() => H(E) === "river");
					Tp(e, {
						get isVisible() {
							return H(n);
						},
						get source() {
							return t.indexed.analysis.session.source;
						},
						get compact() {
							return H(me);
						}
					});
				}
			};
			q(f, (e) => {
				H(E) === "river" && e(p);
			}), j(s);
			var m = B(s, 2), v = L(m), y = (e) => {
				var n = Wv(), r = z(n, !0);
				V(() => {
					n.disabled = c(), K(r, H(me) ? "Copy link" : "Copy view link");
				}), U("click", n, function(...e) {
					t.onCopyViewLink?.apply(this, e);
				}), G(e, n);
			};
			q(v, (e) => {
				t.onCopyViewLink && e(y);
			});
			var b = B(v, 2), x = z(b, !0), S = B(b, 2), ee = z(S, !0);
			j(m), j(a);
			var C = B(a, 2), T = L(C), ie = B(T, 2);
			j(C);
			var ae = B(C, 2), oe = L(ae), se = (e) => {
				var n = Jv(), r = R(n);
				Qr(r, () => H(_), (e) => {
					{
						let t = /* @__PURE__ */ N(() => H(E) === "river");
						$s(e, {
							get compact() {
								return H(me);
							},
							get isVisible() {
								return H(t);
							},
							get viewport() {
								return H(le);
							},
							get callIndices() {
								return H(be);
							},
							get pinnedCallIndex() {
								return H(w).pinnedCallIndex;
							},
							onSelectCall: Ue,
							onLatest: () => Be("latest"),
							onFitAll: () => Be("fit"),
							onZoomIn: () => Be("zoom-in"),
							onZoomOut: () => Be("zoom-out")
						});
					}
				});
				var a = B(r, 2), s = L(a), c = (e) => {
					G(e, Gv());
				}, u = (e) => {
					var n = Br();
					Qr(R(n), () => H(_), (e) => {
						{
							let n = /* @__PURE__ */ N(() => H(E) === "river"), r = /* @__PURE__ */ N(() => l() === "window");
							Li(vv(e, {
								get indexed() {
									return t.indexed;
								},
								get preferences() {
									return i();
								},
								onPreferencesChange: te,
								get pinnedCallIndex() {
									return H(w).pinnedCallIndex;
								},
								get hoveredCallIndex() {
									return H(w).hoveredCallIndex;
								},
								get selectedItemId() {
									return H(w).selectedItemId;
								},
								get hoveredItemId() {
									return H(w).hoveredItemId;
								},
								get navigationCommand() {
									return H(ne);
								},
								get isVisible() {
									return H(n);
								},
								onViewportChange: Pe,
								onNavigationSettled: ke,
								onSelectionVisibility: Fe,
								onHoverCall: je,
								onPinCall: Me,
								onHoverItem: Ge,
								onSelectItem: qe,
								onEmptyClick: Ye,
								onEscape: Xe,
								get consumeUnhandledEscape() {
									return H(r);
								},
								get compact() {
									return H(me);
								}
							}), (e) => I(re, e, !0), () => H(re));
						}
					}), G(e, n);
				};
				q(s, (e) => {
					o() === H(_) ? e(u, -1) : e(c);
				});
				var d = B(s, 2), f = (e) => {
					var t = Kv(), n = B(L(t), 2), r = B(n, 2);
					j(t), U("click", n, () => Ie(H(k).id)), U("click", r, () => qe(null)), G(e, t);
				};
				q(d, (e) => {
					H(ye) && H(k) && e(f);
				});
				var p = B(d, 2), m = (e) => {
					var n = qv();
					Jf(L(n), {
						get item() {
							return H(A);
						},
						get indexed() {
							return t.indexed;
						}
					}), j(n), Li(n, (e) => I(fe, e), () => H(fe)), V(() => vi(n, `left:${H(pe)?.left ?? 12}px;top:${H(pe)?.top ?? 12}px`)), G(e, n);
				};
				q(p, (e) => {
					H(A) && H(w).selectedItemId !== H(w).hoveredItemId && e(m);
				}), j(a), G(e, n);
			}, ce = (e) => {
				G(e, Yv());
			};
			q(oe, (e) => {
				t.indexed.analysis.modelCalls.length > 0 ? e(se) : e(ce, -1);
			}), j(ae);
			var ue = B(ae, 2);
			Qr(L(ue), () => H(_), (e) => {
				{
					let n = /* @__PURE__ */ N(() => H(E) === "composition");
					Ls(e, {
						get indexed() {
							return t.indexed;
						},
						get pinnedCallIndex() {
							return H(w).pinnedCallIndex;
						},
						get selectedItemId() {
							return H(w).selectedItemId;
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
						onScopeChange: Ne,
						onPinCall: Me,
						onUnpinCall: Ee,
						onSelectItem: qe,
						onRevealInRiver: Ie,
						onViewDetails: Le,
						onFindInLifespans: M,
						get compact() {
							return H(me);
						}
					});
				}
			}), j(ue), j(n), V((e) => {
				vi(n, e), K(d, H(xe)), K(x, H(me) ? "Details" : "View details"), Y(S, "aria-label", H(h) ? "Clear selected item" : "Clear selected item and pinned call"), Y(S, "title", H(h) ? "Clears the selected item. The latest call stays pinned while following." : "Clears the selected item and pinned call"), S.disabled = H(w).selectedItemId === null && (H(h) || H(w).pinnedCallIndex === null), K(ee, H(me) ? "Clear" : "Clear selection"), Y(T, "aria-selected", H(E) === "river"), Y(T, "tabindex", H(E) === "river" ? 0 : -1), Y(ie, "aria-selected", H(E) === "composition"), Y(ie, "tabindex", H(E) === "composition" ? 0 : -1), Y(ae, "hidden", H(E) !== "river"), Y(ue, "hidden", H(E) !== "composition");
			}, [() => g(r)]), U("click", b, (e) => {
				e.preventDefault(), Le();
			}), U("click", S, ze), U("click", T, () => I(E, "river")), U("keydown", T, We), U("click", ie, () => I(E, "composition")), U("keydown", ie, We), G(e, n);
		}, b = (e) => {
			var i = Zv();
			let a;
			var o = L(i);
			{
				let e = /* @__PURE__ */ N(() => H(be).length > 0);
				Hf(o, {
					get indexed() {
						return t.indexed;
					},
					get sessions() {
						return n();
					},
					get pinnedCall() {
						return H(ve);
					},
					get selectedItem() {
						return H(k);
					},
					get callSections() {
						return H(y);
					},
					get itemSections() {
						return H(v);
					},
					get pinnedCallIndex() {
						return H(w).pinnedCallIndex;
					},
					get hoveredCallIndex() {
						return H(w).hoveredCallIndex;
					},
					get hasCalls() {
						return H(e);
					},
					onClosePinnedCall: Ee,
					onCloseItem: () => qe(null),
					onSelectItem: qe,
					onPinCall: Me,
					onInspectCall: Re,
					onRevealInRiver: Ie
				});
			}
			j(i), V((e, t) => {
				a = gi(i, 1, "inspector-column svelte-okw1rh", null, a, {
					beside: e,
					empty: !H(ve) && !H(k)
				}), vi(i, t);
			}, [() => m.get("details")?.column === "2", () => g(r)]), G(e, i);
		}, x = (e) => {
			var n = Qv();
			Qr(L(n), () => H(_), (e) => {
				qc(e, {
					get indexed() {
						return t.indexed;
					},
					get selectedItemId() {
						return H(w).selectedItemId;
					},
					get pinnedCallIndex() {
						return H(w).pinnedCallIndex;
					},
					onSelectItem: Je,
					onHoverItem: Ge,
					get findRequest() {
						return H(oe);
					},
					get compact() {
						return H(me);
					}
				});
			}), j(n), V((e) => vi(n, e), [() => g(r)]), G(e, n);
		};
		q(s, (e) => {
			r === "summary" ? e(u) : r === "call" ? e(d, 1) : r === "chart" ? e(p, 2) : r === "details" ? e(b, 3) : r === "lifespans" && e(x, 4);
		}), G(e, a);
	}), j(et), j($e), Li($e, (e) => T = e, () => T), V(() => tt = gi(et, 1, "exploration-grid svelte-okw1rh", null, tt, { occupied: H(k) !== null || H(ve) !== null })), U("keydown", $e, function(...e) {
		(l() === "root" ? Ze : void 0)?.apply(this, e);
	}), G(e, $e), He(Qe);
}
kr(["keydown", "click"]);
//#endregion
//#region src/lib/economics-validation.ts
var ny = /* @__PURE__ */ new Set([
	"piModelRates",
	"sourceModelRates",
	"providerReported",
	"unknown"
]), ry = /* @__PURE__ */ new Set([
	"complete",
	"partial",
	"missing",
	"unsupported"
]), iy = /* @__PURE__ */ new Set([
	"reported",
	"notReported",
	"notRetainedByPi",
	"unsupported"
]), ay = .25, oy = .5, sy = "adjacent-cache-read-share-v1", cy = 1e3;
function ly(e, t) {
	if (e !== null && (!Number.isFinite(e) || e < 0 || e > 1)) throw new $(`${t} is outside 0..1`);
}
function uy(e, t, n, r) {
	if (n === 0) {
		if (e !== null || t !== 0) throw new $(`${r} has an invalid zero denominator`);
		return;
	}
	let i = t / n;
	if (e === null || Math.abs(e - i) > Math.max(1e-12, i * 1e-9)) throw new $(`${r} disagrees with its reported token buckets`);
}
function dy(e) {
	let t = e.economics;
	if (!t || typeof t != "object") throw new $(`Call ${e.index} has no economics record`);
	if (!ry.has(t.usageCompleteness) || !ry.has(t.costCompleteness) || !iy.has(t.cacheWriteStatus)) throw new $(`Call ${e.index} has an unsupported economics status`);
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
	]) ly(r, `Call ${e.index} economics ${n}`);
	if (fy(e), t.piPromptCost !== null && (!Number.isFinite(t.piPromptCost) || t.piPromptCost < 0)) throw new $(`Call ${e.index} has an invalid calculated prompt cost`);
	let i = t.policyId === null ? null : _u[t.policyId];
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
	if (uy(t.cacheReadRatio, o, t.promptTokens, `Call ${e.index} cacheReadRatio`), i.hasWriteRatio) uy(t.cacheWriteRatio, s, t.promptTokens, `Call ${e.index} cacheWriteRatio`);
	else if (t.cacheWriteRatio !== null) throw new $(`Call ${e.index} has an unsupported cache-write ratio`);
	if (i.hasFreshRatio) uy(t.freshRatio, a, t.promptTokens, `Call ${e.index} freshRatio`);
	else if (t.freshRatio !== null) throw new $(`Call ${e.index} has an unsupported fresh-input ratio`);
	if (t.costCompleteness === "complete" && t.usageCompleteness === "complete" && i.hasFreshRatio && t.piPromptCost === null) throw new $(`Call ${e.index} is missing a complete prompt cost`);
}
function fy(e) {
	let t = e.economics.cacheRatioDiscontinuity;
	if (t === null) return;
	if (!t || typeof t != "object" || !Number.isSafeInteger(t.previousCallIndex) || t.previousCallIndex < 0 || !["drop", "rise"].includes(t.direction) || !["notable", "large"].includes(t.magnitude) || t.method !== sy || !Number.isFinite(t.previousRatio) || !Number.isFinite(t.currentRatio) || !Number.isFinite(t.delta) || t.delta < ay || t.delta > 1 || t.compactionBefore !== null && typeof t.compactionBefore != "string") throw new $(`Call ${e.index} has invalid cache-ratio change data`);
	Sl(t.previousPromptTokens, `Call ${e.index} previous prompt tokens`), Sl(t.currentPromptTokens, `Call ${e.index} current prompt tokens`), ly(t.previousRatio, `Call ${e.index} previous cache-read ratio`), ly(t.currentRatio, `Call ${e.index} current cache-read ratio`);
	let n = Math.abs(t.currentRatio - t.previousRatio);
	if (Math.abs(n - t.delta) > Math.max(1e-12, n * 1e-9) || t.direction !== (t.currentRatio < t.previousRatio ? "drop" : "rise") || t.magnitude !== (t.delta >= oy ? "large" : "notable") || t.compactionBefore !== e.compactionBefore) throw new $(`Call ${e.index} has inconsistent cache-ratio change data`);
}
function py(e) {
	let t = [...e].sort((e, t) => e.index - t.index);
	for (let e = 0; e < t.length; e += 1) {
		let n = t[e], r = n.economics.cacheRatioDiscontinuity;
		if (r === null) continue;
		let i = t[e - 1];
		if (!i || i.index + 1 !== n.index || r.previousCallIndex !== i.index || r.previousPromptTokens !== i.economics.promptTokens || r.currentPromptTokens !== n.economics.promptTokens || i.economics.usageCompleteness !== "complete" || n.economics.usageCompleteness !== "complete" || i.economics.policyId === null || i.economics.policyId !== n.economics.policyId || i.provider !== n.provider || i.model !== n.model || i.api !== n.api || i.economics.cacheReadRatio !== r.previousRatio || n.economics.cacheReadRatio !== r.currentRatio || (i.economics.promptTokens ?? 0) < cy || (n.economics.promptTokens ?? 0) < cy) throw new $(`Call ${n.index} has an ineligible cache-ratio change`);
	}
}
function my(e, t) {
	if (!e || !ny.has(e.costBasis)) throw new $("Analysis has an unsupported economics cost basis");
	if (!Array.isArray(e.supportedPolicyIds)) throw new $("Analysis has invalid supported economics policies");
	xl(e.supportedPolicyIds, "economics policy ID");
	for (let t of e.supportedPolicyIds) if (typeof t != "string" || !Object.prototype.hasOwnProperty.call(_u, t)) throw new $(`Analysis has an unsupported economics policy ${String(t)}`);
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
	if (Sl(e.cacheReadPromptTokens, "Analysis cache-read prompt token total"), Sl(e.cacheReadTokens, "Analysis cache-read token total"), ly(e.cacheReadRatio, "Analysis cache-read ratio"), !Array.isArray(e.explanationCodes) || e.explanationCodes.some((e) => typeof e != "string")) throw new $("Analysis has invalid economics explanations");
	for (let n of t) if (dy(n), n.economics.policyId !== null && !e.supportedPolicyIds.includes(n.economics.policyId)) throw new $(`Call ${n.index} economics policy is missing from the summary`);
	if (py(t), e.cacheReadPromptTokens === null != (e.cacheReadTokens === null)) throw new $("Analysis has incomplete cache-read token totals");
	if (e.cacheReadPromptTokens !== null && e.cacheReadTokens !== null) {
		if (e.cacheReadRatio === null && e.cacheReadPromptTokens > 0) throw new $("Analysis is missing a cache-read ratio for covered tokens");
		uy(e.cacheReadRatio, e.cacheReadTokens, e.cacheReadPromptTokens, "Analysis cache-read ratio");
	} else if (e.cacheReadRatio !== null) throw new $("Analysis has a cache-read ratio without covered tokens");
}
//#endregion
//#region src/lib/timing-validation.ts
var hy = /* @__PURE__ */ new Set([
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
function gy(e, t) {
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
	(!Number.isSafeInteger(a) || a <= 0 || s !== "pi-message-timestamps" || !n || !hy.has(e.api ?? "") || ![
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
var _y = /* @__PURE__ */ new Set([
	"recorded",
	"estimated",
	"apiEquivalent",
	"free",
	"unknown"
]), vy = /* @__PURE__ */ new Set([
	"recordedCost",
	"billingModeTable",
	"opencodeZeroWithListedPrice",
	"perTokenDefault",
	"failedAttempt",
	"missingTime",
	"noPrice",
	"missingUsage"
]), yy = /* @__PURE__ */ new Set([
	"documented",
	"firstObserved",
	"modelsDevCommit"
]), by = (e) => typeof e == "number" && Number.isFinite(e) && e >= 0, xy = (e) => typeof e == "number" && Number.isSafeInteger(e) && e >= 0;
function Sy(e) {
	let t = e.costAssessment, n = (t) => {
		throw new $(`Model call ${e.index} cost ${t}`);
	};
	(!t || !_y.has(t.kind)) && n("has an unknown kind"), vy.has(t.classificationRule) || n("has an unknown classification rule"), t.amount !== null && !by(t.amount) && n("has an invalid amount"), t.kind === "unknown" != (t.amount === null) && n("amount disagrees with its kind"), t.amountHigh !== null && (!by(t.amountHigh) || t.amount === null || t.amountHigh < t.amount) && n("has an invalid range"), t.recordedByHarness !== null && !by(t.recordedByHarness) && n("has an invalid recorded value"), t.billingMode !== null && !["perToken", "subscription"].includes(t.billingMode) && n("has an unknown billing mode"), t.kind === "apiEquivalent" != (t.billingMode === "subscription" && t.amount !== null) && n("is API-equivalent without a subscription, or the reverse");
	let r = t.rate;
	r !== null && ((typeof r.provider != "string" || typeof r.model != "string" || typeof r.labEquivalent != "boolean" || typeof r.source != "string" || !yy.has(r.startBasis) || r.validFrom !== null && Number.isNaN(Date.parse(r.validFrom))) && n("has an invalid rate"), r.labEquivalent && t.kind !== "apiEquivalent" && n("uses a lab rate outside a subscription")), (t.kind === "estimated" || t.kind === "apiEquivalent") && r === null && n("is calculated without a rate");
}
function Cy(e, t) {
	let n = () => {
		throw new $(`Session ${t} cost subtotal is inconsistent`);
	};
	(!e || !xy(e.calls)) && n();
	let { low: r, high: i, calls: a } = e;
	if (a === 0) {
		(r !== null || i !== null) && n();
		return;
	}
	(r !== null || i !== null) && (!by(r) || !by(i) || i < r) && n();
}
function wy(e) {
	if (!e) throw new $("Session has no cost summary");
	if (Cy(e.billed, "billed"), Cy(e.apiEquivalent, "API-equivalent"), !xy(e.unknownCalls) || !xy(e.failedAttemptCalls)) throw new $("Session cost summary has invalid call counts");
	let t = e.priceData;
	if (!t || typeof t.modelsDevCommit != "string" || typeof t.modelsDevCommittedAt != "string" || t.amendmentsImportedFrom !== null && typeof t.amendmentsImportedFrom != "string") throw new $("Session cost summary has no price data source");
}
function Ty(e) {
	if (e !== null && (!e || !by(e.totalUsd) || e.sinceMs !== null && !(Number.isSafeInteger(e.sinceMs) && e.sinceMs >= 0))) throw new $("Session has an invalid harness session cost");
}
//#endregion
//#region src/lib/analysis-ordering.ts
function Ey(e) {
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
		let n = Dy(t.sourceItemIds.flatMap((e) => c.get(e) ?? []), l), r = Dy(e.contextItems.filter((e) => e.firstModelCall === t.beforeModelCall), l);
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
function Dy(e, t) {
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
function Oy(e, t, n) {
	let r = e.get(t);
	r ? r.push(n) : e.set(t, [n]);
}
function ky(e) {
	xl(e.contextItems.map((e) => e.id), "context item ID");
	let t = e.modelCalls.map((e) => e.index);
	if (new Set(t).size !== t.length) throw new $("Duplicate model-call index");
	let n = new Map(e.contextItems.map((e) => [e.id, e])), r = new Map(e.modelCalls.map((e) => [e.index, e])), i = new Map(e.modelCalls.map((e) => [e.index, new Set(e.contextItemIds)])), a = /* @__PURE__ */ new Map();
	for (let t of e.contextItems) a.set(t.id, new Map(t.tokenEstimates.map((e) => [e.profileId, e])));
	let { orderedItemIds: o, takesPlaceOf: s } = Ey(e), c = new Map(o.map((e, t) => [e, t])), l = new Map(e.modelCalls.map((e) => [e.index, [...e.contextItemIds].sort((e, t) => (c.get(e) ?? 0) - (c.get(t) ?? 0))])), u = e.modelCalls[0]?.index ?? 0, d = e.modelCalls[e.modelCalls.length - 1]?.index ?? 0, f = d + 1, p = new Set(e.compactions.map((e) => e.summaryItemId)), m = new Set(e.compactions.filter((e) => e.beforeModelCall === f).map((e) => e.summaryItemId)), h = /* @__PURE__ */ new Map();
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
	let g = new Set(e.modelCalls.map((e) => e.index)), _ = /* @__PURE__ */ new Map(), v = /* @__PURE__ */ new Map(), y = /* @__PURE__ */ new Map(), b = /* @__PURE__ */ new Map(), x = /* @__PURE__ */ new Map();
	for (let t of e.compactions) {
		if (_.has(t.id)) throw new $(`Duplicate compaction ID ${t.id}`);
		if (!Number.isInteger(t.beforeModelCall) || t.beforeModelCall < (u || 1) || t.beforeModelCall > f) throw new $(`Compaction ${t.id} has an invalid call boundary`);
		if (!n.has(t.summaryItemId)) throw new $(`Compaction ${t.id} references a missing summary`);
		Rd(t, g);
		for (let e of [...t.sourceItemIds, ...t.retainedItemIds]) if (!n.has(e)) throw new $(`Compaction ${t.id} references unknown item ${e}`);
		_.set(t.id, t), v.set(t.summaryItemId, t), Oy(y, t.summaryItemId, t);
		for (let e of t.sourceItemIds) Oy(b, e, t);
		for (let e of t.retainedItemIds) Oy(x, e, t);
	}
	let S = /* @__PURE__ */ new Map(), ee = /* @__PURE__ */ new Map();
	for (let t of e.lineage) {
		if (!n.has(t.from) || !n.has(t.to)) throw new $(`Lineage references missing item ${t.from} → ${t.to}`);
		if (t.kind !== "frameworkCompaction") throw new $(`Unsupported lineage kind ${String(t.kind)}`);
		Oy(S, t.from, t), Oy(ee, t.to, t);
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
		itemColorSlotById: Da(e.contextItems, o, l, s),
		versionByItemId: mc(e.contextItems)
	};
}
//#endregion
//#region src/lib/analysis.ts
var Ay = /* @__PURE__ */ new Set([
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
function jy(e) {
	return Ay.has(e) ? e : "other";
}
function My(e) {
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
function Ny(e) {
	if (e.displayWeightUnit !== e.tokenAnalysis.chartUnit) throw new $("Chart unit disagrees with token-analysis metadata");
	if (![
		"calculatedTokens",
		"estimatedTokens",
		"unavailable"
	].includes(e.displayWeightUnit)) throw new $(`Unsupported chart unit ${String(e.displayWeightUnit)}`);
	Tl(e);
	for (let t of e.modelCalls) if (typeof t.tokenAnalysis.metricsIncludePartialEstimates != "boolean") throw new $(`Model call ${t.index} does not say whether its metrics include partial estimates`);
	if (my(e.economics, e.modelCalls), e.modelCalls.forEach((t) => gy(t, e.session.source)), e.modelCalls.forEach(Sy), wy(e.session.costSummary), Ty(e.session.harnessSessionCost), e.session.reportedCostTotal !== null && (!Number.isFinite(e.session.reportedCostTotal) || e.session.reportedCostTotal < 0)) throw new $("Analysis has an invalid calculated session cost total");
	if (Py(e.session.reportedCostCoverage, "Session cost"), Py(e.session.reportedUsageCoverage, "Session usage"), e.session.reportedCostCoverage.recordedCalls === 0 && e.session.reportedCostTotal !== null) throw new $("Session cost subtotal has no recorded calls");
	if (e.session.reportedUsageCoverage.recordedCalls === 0 && e.session.reportedPromptTokens !== null) throw new $("Session prompt subtotal has no recorded calls");
}
function Py(e, t) {
	let n = e ? [
		e.recordedCalls,
		e.failedAttemptCalls,
		e.missingCalls
	] : [];
	if (n.length !== 3 || !n.every((e) => Number.isSafeInteger(e) && e >= 0)) throw new $(`${t} coverage is not a set of call counts`);
}
function Fy(e) {
	return {
		...e,
		modelCalls: [...e.modelCalls].sort((e, t) => e.index - t.index),
		contextItems: e.contextItems.map((e) => ({
			...e,
			kind: jy(e.kind),
			presence: [...e.presence],
			metadata: { ...e.metadata }
		})),
		compactions: [...e.compactions].sort((e, t) => e.beforeModelCall - t.beforeModelCall || e.id.localeCompare(t.id)),
		lineage: [...e.lineage].sort((e, t) => e.to.localeCompare(t.to) || e.from.localeCompare(t.from) || e.kind.localeCompare(t.kind))
	};
}
function Iy(e) {
	if (e.schemaVersion !== 1) throw new $(`Unsupported analysis schema ${String(e.schemaVersion)}`);
	let t = My(e);
	return Ny(t), ky(Fy(t));
}
//#endregion
//#region src/lib/embed/analysis-controller.ts
function Ly(e) {
	let t = {
		indexed: null,
		loading: !1,
		error: "",
		revision: 0,
		kind: null
	}, n = nt(t), r = null, i = null, a = !1;
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
				let e = Iy(i.analysis);
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
		...rt(n),
		refresh: s,
		dispose: c
	};
}
//#endregion
//#region src/lib/embed/EmbeddedSession.svelte
var Ry = /* @__PURE__ */ W("<button type=\"button\">Retry</button>"), zy = /* @__PURE__ */ W("<p role=\"alert\" class=\"svelte-11525tj\"> <!></p>"), By = /* @__PURE__ */ W("<p>Analysing session…</p>"), Vy = /* @__PURE__ */ W("<div class=\"embedded-session svelte-11525tj\"><header class=\"svelte-11525tj\"><button type=\"button\" class=\"follow svelte-11525tj\">Follow latest</button> <span role=\"status\" class=\"svelte-11525tj\"> </span> <!></header> <!> <!></div>"), Hy = {
	hash: "svelte-11525tj",
	code: ".embedded-session.svelte-11525tj {min-width:0;padding:12px;}header.svelte-11525tj {display:flex;align-items:center;flex-wrap:wrap;gap:8px;}.follow[aria-pressed='true'].svelte-11525tj {border-color:var(--accent);background-color:var(--action);color:var(--active-text);}header.svelte-11525tj span:where(.svelte-11525tj) {color:var(--secondary);font-size:var(--text-sm);}p[role='alert'].svelte-11525tj {color:var(--error);}"
};
function Uy(e, t) {
	Ve(t, !0), li(e, Hy);
	let n = () => st(o, "$controller", r), [r, i] = ct(), a = X(t, "defaultVerticalScale", 3, "session"), o = Ly((e, n) => yr(() => t.loadAnalysis(e, n))), s = /* @__PURE__ */ F(yr(() => {
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
	var _ = { refresh: g }, v = Vy(), y = L(v), b = L(y), x = B(b, 2), S = z(x, !0), ee = B(x, 2), C = (e) => {
		var t = Ry();
		U("click", t, () => o.refresh()), G(e, t);
	};
	q(ee, (e) => {
		n().error && e(C);
	}), j(y);
	var te = B(y, 2), w = (e) => {
		var t = zy(), r = L(t, !0), i = B(r), a = (e) => {
			G(e, zr("Showing the previous analysis."));
		};
		q(i, (e) => {
			n().indexed && e(a);
		}), j(t), V(() => K(r, n().error)), G(e, t);
	};
	q(te, (e) => {
		n().error && e(w);
	});
	var T = B(te, 2), E = (e) => {
		Li(ty(e, {
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
		G(e, By());
	};
	q(T, (e) => {
		n().indexed ? e(E) : n().loading && e(D, 1);
	}), j(v), V(() => {
		Y(b, "aria-pressed", H(c)), Y(b, "title", H(c) ? "Following new calls. Select to stop following." : "Select to follow new calls."), K(S, n().loading ? "Updating…" : n().error ? "Update failed" : "Live");
	}), U("click", b, () => H(c) ? m() : h()), G(e, v);
	var O = He(_);
	return i(), O;
}
kr(["click"]);
//#endregion
//#region scripts/theme-html.ts
function Wy(e) {
	let t = Object.entries(e.tokens).map(([e, t]) => `--${e}:${t};`), n = Object.entries(e.itemTypes).map(([e, t]) => `--item-type-${e}:${t};`), r = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5l5 5 5-5' fill='none' stroke='${e.tokens.secondary.replace("#", "%23")}' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;
	return `color-scheme:${e.colorScheme};${t.join("")}${n.join("")}--chevron:${r};`;
}
function Gy(e = Object.values(va), t = "html") {
	let n = t === "html" ? ":root" : ":host", r = t === "html" ? "html{background:var(--page)}" : "", i = (e) => t === "html" ? `html[data-theme="${e}"]` : `:host([data-theme="${e}"])`;
	return `${n}{${Wy(va.dark)}}${r}${e.map((e) => `${i(e.id)}{${Wy(e)}}`).join("")}`;
}
//#endregion
//#region src/lib/styles/workspace.css?inline
var Ky = ":root,:host{--text-xs:11px;--text-sm:12px;--text-md:13px;--text-lg:15px;--radius:8px;--control-radius:6px;--radius-small:2px;--space-1:4px;--space-2:8px;--space-3:12px;--space-4:16px;--space-5:24px;--space-6:32px;--control-padding:7px 9px;--control-size:32px;--toggle-height:30px;--toggle-padding:4px 9px;--panel-padding:15px;--panel-gap:14px}*{box-sizing:border-box}button,select{background-color:var(--surface);border:1px solid var(--control-border);color:var(--text);border-radius:var(--control-radius);padding:var(--control-padding)}button{cursor:pointer}button:hover{background-color:var(--surface-raised)}:focus-visible{outline:2px solid var(--accent);outline-offset:3px}summary:focus-visible{border-radius:var(--radius-small)}.sr-only{clip:rect(0, 0, 0, 0);white-space:nowrap;border:0;width:1px;height:1px;margin:-1px;padding:0;position:absolute;overflow:hidden}.toggle-group{flex-wrap:wrap;align-items:center;gap:5px;display:flex}.toggle-label{color:var(--text);margin-right:3px;font-weight:650}.toggle-group>button{min-height:var(--toggle-height);padding:var(--toggle-padding);border:1px solid var(--separator);background-color:var(--surface);color:var(--text);font:inherit}.toggle-group>button[aria-pressed=true]{border-color:var(--accent);background-color:var(--action);color:var(--active-text)}input{color:var(--text);background:var(--plot);border:1px solid var(--control-border)}summary{cursor:pointer}.disclosure{width:fit-content;color:var(--secondary);cursor:pointer;align-items:center;gap:7px;font-size:13px;list-style:none;display:inline-flex}.disclosure::-webkit-details-marker{display:none}.disclosure:before{content:\"\";border-top:4px solid #0000;border-bottom:4px solid #0000;border-left:6px solid;transition:transform .12s}details[open]>.disclosure:before,.disclosure[aria-expanded=true]:before{transform:rotate(90deg)}select{appearance:none;background-image:var(--chevron);background-position:right 12px center;background-repeat:no-repeat;background-size:12px 8px}@media (prefers-reduced-motion:reduce){*,:before,:after{scroll-behavior:auto!important}}", qy = {
	standard: Lv,
	panel: Rv
}, Jy = /* @__PURE__ */ new WeakMap();
function Yy(e) {
	let { target: t } = e, n = Jy.get(t) ?? t.attachShadow({ mode: "open" });
	if (n.hasChildNodes()) throw Error("Highwater is already mounted in this target");
	Jy.set(t, n);
	let r = t.getAttribute("data-theme"), i = document.createElement("style");
	i.textContent = Gy(void 0, ":host") + Ky + "\n    :host { display:block; background:var(--page); color:var(--text);\n      font:14px/1.45 Inter,ui-sans-serif,system-ui,sans-serif; }\n    .highwater-embed-root { container-type:inline-size; container-name:highwater; min-width:0; }\n    .highwater-embed-root.compact { font-size:13px; --control-padding:4px 8px; --control-size:24px;\n      --toggle-height:24px; --toggle-padding:3px 8px; --panel-padding:12px; --panel-gap:10px; }\n    .highwater-embed-root.compact :is(button:not(.step-call), select, input, summary) { font-size:12px; }\n  ";
	let a = document.createElement("div");
	a.className = e.density === "compact" ? "highwater-embed-root compact" : "highwater-embed-root", n.append(i, a);
	let o = !1;
	function s(e) {
		o || (t.dataset.theme = e, ja.setPalette(e));
	}
	s(e.theme);
	let c;
	try {
		c = Gr(Uy, {
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
export { Yy as mountHighwater, qy as sectionPresets };
