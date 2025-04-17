import React from 'react';
import logo from './logo.svg';
import './App.css';
import Dashboard from './Dashboard';

function App() {
  return (
    <span>
        <div className="header" style={{ display: 'flex', alignItems: 'center', padding: '10px' }} >
      <img
        src="\Logo TTQL KTX&DTDH.png" // hoặc đường dẫn logo bạn có
        alt="Logo"
        style={{ height: '80px', marginRight: '0px' }}
      />
      <h1 style={{ color: 'red', fontWeight: 'bold', textAlign: 'center', flex: 1 }}>
        TRUNG TÂM QUẢN LÝ KÝ TÚC XÁ VÀ KHU ĐÔ THỊ ĐHQG-HCM – HỆ THỐNG GIÁM SÁT WEBSITE 24/7
      </h1>
    </div>
    <Dashboard />
    </span>
  );
}

export default App;