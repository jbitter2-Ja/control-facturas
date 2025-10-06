import React, { useState, useEffect, useMemo } from 'react';
import { auth, db } from './firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore';
import { Plus, Search, TrendingUp, DollarSign, AlertCircle, CheckCircle, Clock, X, LogOut, Trash2, Edit, Download } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [formData, setFormData] = useState({
    number: '',
    issueDate: '',
    client: '',
    description: '',
    amount: '',
    dueDate: '',
    paidAmount: '',
    paymentDate: '',
    paymentMethod: ''
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const q = query(collection(db, 'invoices'), where('userId', '==', user.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const invoicesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setInvoices(invoicesData);
      });
      return () => unsubscribe();
    }
  }, [user]);

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      setEmail('');
      setPassword('');
    } catch (error) {
      alert(error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const invoiceData = {
        ...formData,
        amount: parseFloat(formData.amount),
        paidAmount: parseFloat(formData.paidAmount) || 0,
        userId: user.uid,
        createdAt: serverTimestamp()
      };

      if (editingInvoice) {
        await updateDoc(doc(db, 'invoices', editingInvoice.id), invoiceData);
        setEditingInvoice(null);
      } else {
        await addDoc(collection(db, 'invoices'), invoiceData);
      }

      setFormData({
        number: '',
        issueDate: '',
        client: '',
        description: '',
        amount: '',
        dueDate: '',
        paidAmount: '',
        paymentDate: '',
        paymentMethod: ''
      });
      setShowForm(false);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleEdit = (invoice) => {
    setEditingInvoice(invoice);
    setFormData({
      number: invoice.number,
      issueDate: invoice.issueDate,
      client: invoice.client,
      description: invoice.description,
      amount: invoice.amount.toString(),
      dueDate: invoice.dueDate,
      paidAmount: invoice.paidAmount.toString(),
      paymentDate: invoice.paymentDate || '',
      paymentMethod: invoice.paymentMethod || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de eliminar esta factura?')) {
      try {
        await deleteDoc(doc(db, 'invoices', id));
      } catch (error) {
        alert(error.message);
      }
    }
  };

  const getInvoiceStatus = (invoice) => {
    const today = new Date();
    const dueDate = new Date(invoice.dueDate);
    
    if (invoice.paidAmount >= invoice.amount) return 'paid';
    if (dueDate < today) return 'overdue';
    if (invoice.paidAmount > 0) return 'partial';
    return 'pending';
  };

  const getOverdueDays = (invoice) => {
    const status = getInvoiceStatus(invoice);
    if (status !== 'overdue') return 0;
    
    const today = new Date();
    const dueDate = new Date(invoice.dueDate);
    const diff = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const formatCurrency = (amount) => {
    return '$' + amount.toLocaleString('es-CL');
  };

  const getBalance = (invoice) => {
    return invoice.amount - invoice.paidAmount;
  };
const exportToExcel = () => {
    // Preparar datos para exportar
    const dataToExport = filteredInvoices.map(inv => ({
      'N° Factura': inv.number,
      'Fecha Emisión': new Date(inv.issueDate).toLocaleDateString('es-CL'),
      'Cliente': inv.client,
      'Descripción': inv.description,
      'Monto': inv.amount,
      'Fecha Vencimiento': new Date(inv.dueDate).toLocaleDateString('es-CL'),
      'Estado': getInvoiceStatus(inv) === 'paid' ? 'Pagada' : 
                getInvoiceStatus(inv) === 'pending' ? 'Pendiente' :
                getInvoiceStatus(inv) === 'overdue' ? 'Vencida' : 'Parcial',
      'Monto Pagado': inv.paidAmount,
      'Saldo Pendiente': getBalance(inv),
      'Fecha Pago': inv.paymentDate ? new Date(inv.paymentDate).toLocaleDateString('es-CL') : '',
      'Método Pago': inv.paymentMethod || '',
      'Días Vencidos': getOverdueDays(inv) || ''
    }));

    // Crear CSV
    const headers = Object.keys(dataToExport[0] || {});
    const csvContent = [
      headers.join(','),
      ...dataToExport.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escapar valores con comas
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    // Descargar archivo
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `facturas_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const kpis = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const currentMonthInvoices = invoices.filter(inv => {
      const issueDate = new Date(inv.issueDate);
      return issueDate.getMonth() === currentMonth && issueDate.getFullYear() === currentYear;
    });

    const totalBilled = currentMonthInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const totalCollected = currentMonthInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
    const totalPending = invoices.reduce((sum, inv) => sum + getBalance(inv), 0);
    const overdueInvoices = invoices.filter(inv => getInvoiceStatus(inv) === 'overdue');
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + getBalance(inv), 0);

    return {
      totalBilled,
      totalCollected,
      totalPending,
      overdueCount: overdueInvoices.length,
      overdueAmount
    };
  }, [invoices]);

  const statusData = useMemo(() => {
    const statuses = {
      paid: { name: 'Pagadas', count: 0, color: '#10b981' },
      pending: { name: 'Pendientes', count: 0, color: '#f59e0b' },
      overdue: { name: 'Vencidas', count: 0, color: '#ef4444' },
      partial: { name: 'Parciales', count: 0, color: '#3b82f6' }
    };

    invoices.forEach(inv => {
      const status = getInvoiceStatus(inv);
      statuses[status].count++;
    });

    return Object.values(statuses).filter(s => s.count > 0);
  }, [invoices]);

  const monthlyData = useMemo(() => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const data = months.map((month) => ({
      month,
      facturado: 0,
      cobrado: 0
    }));

    invoices.forEach(inv => {
      const issueMonth = new Date(inv.issueDate).getMonth();
      data[issueMonth].facturado += inv.amount;
      
      if (inv.paymentDate) {
        const paymentMonth = new Date(inv.paymentDate).getMonth();
        data[paymentMonth].cobrado += inv.paidAmount;
      }
    });

    return data;
  }, [invoices]);

  const yearlyData = useMemo(() => {
    const years = {};
    
    invoices.forEach(inv => {
      const year = new Date(inv.issueDate).getFullYear();
      if (!years[year]) {
        years[year] = { year: year.toString(), facturado: 0, cobrado: 0 };
      }
      years[year].facturado += inv.amount;
      years[year].cobrado += inv.paidAmount;
    });

    return Object.values(years).sort((a, b) => a.year - b.year);
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchesSearch = inv.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           inv.number.toLowerCase().includes(searchTerm.toLowerCase());
      const status = getInvoiceStatus(inv);
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [invoices, searchTerm, statusFilter]);

  const getStatusBadge = (invoice) => {
    const status = getInvoiceStatus(invoice);
    const badges = {
      paid: { text: 'Pagada', class: 'bg-green-100 text-green-800', icon: CheckCircle },
      pending: { text: 'Pendiente', class: 'bg-yellow-100 text-yellow-800', icon: Clock },
      overdue: { text: 'Vencida', class: 'bg-red-100 text-red-800', icon: AlertCircle },
      partial: { text: 'Parcial', class: 'bg-blue-100 text-blue-800', icon: Clock }
    };
    
    const badge = badges[status];
    const Icon = badge.icon;
    
    return (
      <span className={'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ' + badge.class}>
        <Icon size={12} />
        {badge.text}
      </span>
    );
  };

  const clientSummary = useMemo(() => {
    return Object.values(
      invoices.reduce((acc, inv) => {
        if (!acc[inv.client]) {
          acc[inv.client] = {
            client: inv.client,
            count: 0,
            totalBilled: 0,
            totalPaid: 0
          };
        }
        acc[inv.client].count++;
        acc[inv.client].totalBilled += inv.amount;
        acc[inv.client].totalPaid += inv.paidAmount;
        return acc;
      }, {})
    );
  }, [invoices]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">Control de Facturas</h1>
          <p className="text-gray-600 mb-6 text-center">Sistema de gestión profesional</p>
          
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="tu@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              {isLogin ? 'Iniciar Sesión' : 'Registrarse'}
            </button>
          </form>

          <button
            onClick={() => setIsLogin(!isLogin)}
            className="w-full mt-4 text-blue-600 hover:text-blue-700 text-sm"
          >
            {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img src="/logo.jpg" alt="IApatagonia SpA" className="h-16 w-auto" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Control de Facturas</h1>
              <p className="text-gray-600">IApatagonia SpA</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <LogOut size={20} />
            Cerrar Sesión
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Facturado (Mes)</h3>
              <TrendingUp className="text-blue-500" size={20} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(kpis.totalBilled)}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Cobrado (Mes)</h3>
              <DollarSign className="text-green-500" size={20} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(kpis.totalCollected)}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Saldo Pendiente</h3>
              <Clock className="text-orange-500" size={20} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(kpis.totalPending)}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Facturas Vencidas</h3>
              <AlertCircle className="text-red-500" size={20} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{kpis.overdueCount}</p>
            <p className="text-sm text-red-600 mt-1">{formatCurrency(kpis.overdueAmount)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Estado de Facturas</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, count }) => name + ': ' + count}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={'cell-' + index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Facturación vs Cobranza Mensual</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="facturado" fill="#3b82f6" name="Facturado" />
                <Bar dataKey="cobrado" fill="#10b981" name="Cobrado" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Evolución Anual</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={yearlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Line type="monotone" dataKey="facturado" stroke="#3b82f6" name="Facturado" strokeWidth={2} />
              <Line type="monotone" dataKey="cobrado" stroke="#10b981" name="Cobrado" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex-1 w-full md:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Buscar por cliente o N° factura..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todos los estados</option>
                <option value="paid">Pagadas</option>
                <option value="pending">Pendientes</option>
                <option value="overdue">Vencidas</option>
                <option value="partial">Parciales</option>
              </select>
           <button
                onClick={exportToExcel}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                title="Exportar a Excel"
              >
                <Download size={20} />
                Exportar
              </button>   
              <button
                onClick={() => {
                  setShowForm(!showForm);
                  if (showForm) {
                    setEditingInvoice(null);
                    setFormData({
                      number: '',
                      issueDate: '',
                      client: '',
                      description: '',
                      amount: '',
                      dueDate: '',
                      paidAmount: '',
                      paymentDate: '',
                      paymentMethod: ''
                    });
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {showForm ? <X size={20} /> : <Plus size={20} />}
                {showForm ? 'Cancelar' : 'Nueva Factura'}
              </button>
            </div>
          </div>
        </div>

        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingInvoice ? 'Editar Factura' : 'Nueva Factura'}
            </h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">N° Factura</label>
                <input
                  type="text"
                  required
                  value={formData.number}
                  onChange={(e) => setFormData({...formData, number: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="F-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Emisión</label>
                <input
                  type="date"
                  required
                  value={formData.issueDate}
                  onChange={(e) => setFormData({...formData, issueDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                <input
                  type="text"
                  required
                  value={formData.client}
                  onChange={(e) => setFormData({...formData, client: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Nombre del cliente"
                />
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <input
                  type="text"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Concepto o servicio"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto Total</label>
                <input
                  type="number"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Vencimiento</label>
                <input
                  type="date"
                  required
                  value={formData.dueDate}
                  onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto Pagado</label>
                <input
                  type="number"
                  value={formData.paidAmount}
                  onChange={(e) => setFormData({...formData, paidAmount: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Pago</label>
                <input
                  type="date"
                  value={formData.paymentDate}
                  onChange={(e) => setFormData({...formData, paymentDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar...</option>
                  <option value="Transferencia bancaria">Transferencia bancaria</option>
                </select>
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <button
                  type="submit"
                  className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingInvoice ? 'Actualizar Factura' : 'Guardar Factura'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">N° Factura</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha Emisión</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vencimiento</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Saldo</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Días Vencidos</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInvoices.map((invoice) => {
                  const status = getInvoiceStatus(invoice);
                  const overdueDays = getOverdueDays(invoice);
                  const balance = getBalance(invoice);
                  
                  return (
                    <tr key={invoice.id} className={'hover:bg-gray-50 ' + (status === 'overdue' ? 'bg-red-50' : status === 'paid' ? 'bg-green-50' : '')}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{invoice.number}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{new Date(invoice.issueDate).toLocaleDateString('es-CL')}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{invoice.client}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{invoice.description}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">{formatCurrency(invoice.amount)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{new Date(invoice.dueDate).toLocaleDateString('es-CL')}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">{getStatusBadge(invoice)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">{formatCurrency(balance)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                        {overdueDays > 0 ? (
                          <span className="text-red-600 font-semibold">{overdueDays} días</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(invoice)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Editar"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(invoice.id)}
                            className="text-red-600 hover:text-red-800"
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {filteredInvoices.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No se encontraron facturas</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen por Cliente</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Facturas</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Facturado</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Cobrado</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Saldo Pendiente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {clientSummary.map((summary, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{summary.client}</td>
                    <td className="px-4 py-3 text-sm text-center text-gray-600">{summary.count}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(summary.totalBilled)}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(summary.totalPaid)}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{formatCurrency(summary.totalBilled - summary.totalPaid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {clientSummary.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">No hay datos para mostrar</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
