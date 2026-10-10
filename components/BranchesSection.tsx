import React from 'react';
import { motion } from 'motion/react';
import type { StoreBranch } from '../types';
import { ArrowLeftIcon } from './Icons';

const BranchesSection: React.FC<{ branches: StoreBranch[] }> = ({ branches }) => {
    if (!branches || branches.length === 0) return null;

    return (
        <section className="py-20 bg-surface border-t border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-serif font-bold mb-6 text-on-surface cyber-text">Nuestras Sedes</h2>
                    <p className="text-gray-500 max-w-2xl mx-auto text-lg italic">
                        Visítanos y vive la experiencia Bombon Store en cualquiera de nuestros puntos físicos.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                    {branches.map((branch) => (
                        <motion.div 
                            key={branch.docId}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="bg-white rounded-3xl overflow-hidden shadow-2xl hover:shadow-primary/10 transition-all border border-gray-100 group"
                        >
                            <div className="relative aspect-[3/4] overflow-hidden">
                                <img 
                                    src={branch.imageUrl || 'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?q=80&w=800'} 
                                    alt={branch.name} 
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                    referrerPolicy="no-referrer"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
                                    <h3 className="text-white text-2xl font-bold font-serif">{branch.name}</h3>
                                </div>
                            </div>
                            <div className="p-8 space-y-4">
                                <div className="flex items-start gap-4">
                                    <div className="p-2 bg-primary/10 rounded-lg">
                                        <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-on-surface uppercase tracking-wider mb-1">Dirección</p>
                                        <p className="text-gray-600">{branch.address}, {branch.city}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="p-2 bg-secondary/10 rounded-lg">
                                        <svg className="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-on-surface uppercase tracking-wider mb-1">Horario</p>
                                        <p className="text-gray-600 whitespace-pre-line">{branch.schedule}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="p-2 bg-accent/10 rounded-lg">
                                        <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-on-surface uppercase tracking-wider mb-1">Contacto</p>
                                        <p className="text-gray-600">{branch.phone}</p>
                                    </div>
                                </div>
                                
                                {branch.mapLink && (
                                    <a 
                                        href={branch.mapLink} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 text-primary font-bold pt-4 hover:underline"
                                    >
                                        <span>Ver en Google Maps</span>
                                        <ArrowLeftIcon className="w-4 h-4 rotate-180" />
                                    </a>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};


export default BranchesSection;
