import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import {
  Leaf,
  Clock,
  IndianRupee,
  Plus,
  X,
  Search,
  Sparkles,
  Flame,
  Coffee,
  Activity,
  CheckCircle2,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'

interface Therapy {
  id: string
  name: string
  category?: string // 'pradhana_karma' | 'poorva_karma' | 'paschat_karma' | 'upakarma'
  dosha_target?: string
  indications?: string
  description?: string
  default_duration_minutes: number
  suggested_price?: number
  required_facilities?: string
  is_active: boolean
}

const CATEGORIES = [
  { id: 'all', label: 'All Procedures', icon: Leaf },
  { id: 'pradhana_karma', label: 'The 5 Pradhana Karmas', icon: Flame, desc: 'Vamana, Virechana, Basti, Nasya, Raktamokshana' },
  { id: 'poorva_karma', label: 'Poorva Karma (Preparatory)', icon: Sparkles, desc: 'Snehana, Swedana, Snehapana, Bashpa Sweda, Kizhi' },
  { id: 'paschat_karma', label: 'Paschat Karma (Post-Care)', icon: Coffee, desc: 'Samsarjana Krama, Dhumapana, Rasayana' },
  { id: 'upakarma', label: 'Upakarma & Specialties', icon: Activity, desc: 'Kati Basti, Janu Basti, Shirodhara, Netra Tarpana, Pizhichil' },
]

export default function Therapies() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    name: '',
    category: 'upakarma',
    dosha_target: '',
    indications: '',
    description: '',
    default_duration_minutes: 60,
    suggested_price: 1500,
    required_facilities: '',
  })
  const [error, setError] = useState('')

  const { data: therapies = [], isLoading } = useQuery<Therapy[]>({
    queryKey: ['therapies'],
    queryFn: async () => {
      const res = await api.get('/therapies/')
      return res.data
    },
  })

  const addMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const res = await api.post('/therapies/', payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['therapies'] })
      setModalOpen(false)
      setForm({
        name: '',
        category: 'upakarma',
        dosha_target: '',
        indications: '',
        description: '',
        default_duration_minutes: 60,
        suggested_price: 1500,
        required_facilities: '',
      })
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to add therapy')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    addMutation.mutate(form)
  }

  const canAdd = user?.role === 'admin' || user?.role === 'doctor'

  // Filter therapies
  const filteredTherapies = therapies.filter((t) => {
    const matchesCat =
      selectedCategory === 'all' ||
      t.category === selectedCategory ||
      (!t.category && selectedCategory === 'upakarma')

    const term = searchTerm.toLowerCase()
    const matchesSearch =
      !term ||
      t.name.toLowerCase().includes(term) ||
      (t.dosha_target && t.dosha_target.toLowerCase().includes(term)) ||
      (t.indications && t.indications.toLowerCase().includes(term)) ||
      (t.description && t.description.toLowerCase().includes(term)) ||
      (t.required_facilities && t.required_facilities.toLowerCase().includes(term))

    return matchesCat && matchesSearch
  })

  const getCategoryBadge = (cat?: string) => {
    switch (cat) {
      case 'pradhana_karma':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          label: 'Pradhana Karma (Core Detox)',
        }
      case 'poorva_karma':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          label: 'Poorva Karma (Preparatory)',
        }
      case 'paschat_karma':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          label: 'Paschat Karma (Post-Care)',
        }
      case 'upakarma':
      default:
        return {
          bg: 'bg-purple-50 text-purple-700 border-purple-200',
          label: 'Classical Upakarma',
        }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Leaf className="text-[var(--color-brand)]" size={24} />
            <h1 className="text-2xl font-bold text-gray-900">Classical Panchakarma & Therapy Catalogue</h1>
          </div>
          <p className="text-sm text-gray-500">
            Comprehensive repository of the 5 Core Panchakarmas, Poorva Karmas (Preparation), Paschat Karmas (Restoration), and Upakarma therapies.
          </p>
        </div>
        {canAdd && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-xs transition"
          >
            <Plus size={16} />
            Add New Procedure
          </button>
        )}
      </div>

      {/* Classical Ayurveda Trividha Karma Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 text-white rounded-3xl p-6 shadow-md border border-emerald-800/40 relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full">
              Authentic Ayurveda • Trividha Karma System
            </span>
            <h2 className="text-xl font-bold mt-2 text-white">
              The Classical Panchakarma Protocol Suite
            </h2>
            <p className="text-xs text-emerald-100/80 max-w-2xl mt-1 leading-relaxed">
              True Panchakarma is not just a single massage—it is a 3-stage cellular bio-purification science: 
              <strong className="text-white"> Poorva Karma</strong> (Deepana-Pachana, Snehana & Swedana) mobilizes deep toxins, 
              followed by the <strong className="text-white">5 Pradhana Karmas</strong> (Vamana, Virechana, Basti, Nasya, Raktamokshana) to expel morbidity, 
              concluding with <strong className="text-white">Paschat Karma</strong> (Samsarjana Krama & Rasayana) to restore metabolic Agni.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center min-w-20">
              <span className="block text-xl font-black text-emerald-300">{therapies.length}</span>
              <span className="text-[10px] text-emerald-100 uppercase font-medium">Procedures</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center min-w-20">
              <span className="block text-xl font-black text-amber-300">5</span>
              <span className="text-[10px] text-amber-100 uppercase font-medium">Karmas</span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon
          const count =
            cat.id === 'all'
              ? therapies.length
              : therapies.filter(
                  (t) => t.category === cat.id || (!t.category && cat.id === 'upakarma')
                ).length
          const active = selectedCategory === cat.id

          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
                active
                  ? 'bg-[var(--color-brand)] text-white shadow-xs'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon size={14} />
              <span>{cat.label}</span>
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                  active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={17} />
          <input
            type="text"
            placeholder="Search by procedure name (e.g. Vamana, Basti, Shirodhara), target dosha, or clinical indications..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
          />
        </div>
        <span className="text-xs text-gray-500 whitespace-nowrap">
          Showing <strong>{filteredTherapies.length}</strong> procedures
        </span>
      </div>

      {/* Procedures Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-gray-400">Loading Panchakarma procedures...</div>
      ) : filteredTherapies.length === 0 ? (
        <div className="p-12 text-center text-gray-400 bg-white rounded-2xl border border-gray-200">
          No procedures match your filter criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTherapies.map((t) => {
            const badge = getCategoryBadge(t.category)
            return (
              <div
                key={t.id}
                className="bg-white rounded-3xl p-5 shadow-xs border border-gray-200/80 flex flex-col justify-between hover:shadow-md transition group"
              >
                <div>
                  {/* Category & Status Badges */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border capitalize ${badge.bg}`}
                    >
                      {badge.label}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                      <CheckCircle2 size={10} /> Active
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-base font-bold text-gray-900 mb-1 group-hover:text-[var(--color-brand)] transition">
                    {t.name}
                  </h3>
                  <p className="text-xs text-gray-500 line-clamp-3 mb-3 leading-relaxed">
                    {t.description || 'Classical Ayurvedic clinical procedure.'}
                  </p>

                  {/* Dosha Target */}
                  {t.dosha_target && (
                    <div className="mb-2 p-2 bg-amber-50/70 border border-amber-200/60 rounded-xl text-xs flex items-center gap-1.5">
                      <Flame size={13} className="text-amber-700 shrink-0" />
                      <span className="text-amber-900 font-semibold text-[11px]">
                        Target Dosha: <strong className="text-amber-950 font-bold">{t.dosha_target}</strong>
                      </span>
                    </div>
                  )}

                  {/* Clinical Indications */}
                  {t.indications && (
                    <div className="mb-3 text-[11px] text-gray-600 bg-gray-50/80 p-2.5 rounded-xl border border-gray-100">
                      <span className="font-semibold text-gray-700 block mb-1">Clinical Indications:</span>
                      <p className="line-clamp-2 text-gray-500">{t.indications}</p>
                    </div>
                  )}
                </div>

                {/* Bottom Specifications */}
                <div className="space-y-2 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <Clock size={13} className="text-gray-400" />
                      Standard Duration
                    </span>
                    <span className="font-bold text-gray-900">{t.default_duration_minutes} mins</span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <IndianRupee size={13} className="text-gray-400" />
                      Suggested Price
                    </span>
                    <span className="font-bold text-emerald-700">₹{t.suggested_price || 0}</span>
                  </div>

                  {t.required_facilities && (
                    <div className="pt-1.5 text-xs">
                      <span className="text-[10px] text-gray-400 font-semibold block mb-1 uppercase tracking-wider">
                        Required Facilities & Tools:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {t.required_facilities.split(',').map((f) => (
                          <span
                            key={f.trim()}
                            className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md text-[10px] font-medium"
                          >
                            {f.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ADD NEW THERAPY MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute right-5 top-5 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-2 mb-1 text-[var(--color-brand)]">
              <Leaf size={20} />
              <h2 className="text-lg font-bold text-gray-900">Add Panchakarma Procedure</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Register a new classical therapy or specialized clinical procedure into the clinic catalogue.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Procedure Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  placeholder="e.g. Takradhara, Vamana Karma, Kati Basti"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Panchakarma Stage / Category *</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  >
                    <option value="pradhana_karma">🔥 Pradhana Karma (5 Core Detox)</option>
                    <option value="poorva_karma">🌿 Poorva Karma (Preparatory)</option>
                    <option value="paschat_karma">🍵 Paschat Karma (Post-Care / Diet)</option>
                    <option value="upakarma">✨ Classical Upakarma (Specialized)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Target Dosha / Dhatu</label>
                  <input
                    type="text"
                    value={form.dosha_target}
                    onChange={(e) => setForm({ ...form, dosha_target: e.target.value })}
                    placeholder="e.g. Vata Dosha, Pitta-Rakta"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Clinical Indications</label>
                <input
                  type="text"
                  value={form.indications}
                  onChange={(e) => setForm({ ...form, indications: e.target.value })}
                  placeholder="e.g. Lumbar Spondylosis, Sciatica, Chronic Arthritis"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Description & Classical Technique</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Details of procedure, oil application, and therapeutic mechanism..."
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Duration (minutes) *</label>
                  <input
                    type="number"
                    required
                    value={form.default_duration_minutes}
                    onChange={(e) => setForm({ ...form, default_duration_minutes: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Suggested Price (₹)</label>
                  <input
                    type="number"
                    value={form.suggested_price}
                    onChange={(e) => setForm({ ...form, suggested_price: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Required Facilities & Equipment</label>
                <input
                  type="text"
                  value={form.required_facilities}
                  onChange={(e) => setForm({ ...form, required_facilities: e.target.value })}
                  placeholder="comma separated: table, oil, dough_ring, steam_chamber"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addMutation.isPending}
                  className="px-4 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white rounded-xl text-xs font-semibold shadow-xs transition disabled:opacity-60"
                >
                  {addMutation.isPending ? 'Saving...' : 'Create Procedure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
