import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './src/designs/Home';
import Design1 from './src/designs/Design1';
import Design2 from './src/designs/Design2';
import Design3 from './src/designs/Design3';
import Design4 from './src/designs/Design4';
import Design5 from './src/designs/Design5';

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/1" element={<Design1 />} />
            <Route path="/2" element={<Design2 />} />
            <Route path="/3" element={<Design3 />} />
            <Route path="/4" element={<Design4 />} />
            <Route path="/5" element={<Design5 />} />
        </Routes>
    );
}