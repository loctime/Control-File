// components/drive/CompleteMigration.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { OptimizedFileExplorer } from './OptimizedFileExplorer';
import { FileExplorer } from './FileExplorer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, ArrowRight, Zap, Database, Table, FormInput } from 'lucide-react';

export function CompleteMigration() {
  const [migrationStep, setMigrationStep] = useState(0);
  const [showOldVersion, setShowOldVersion] = useState(false);

  const migrationSteps = [
    {
      title: 'TanStack Query',
      description: 'Cache inteligente, invalidación automática, optimistic updates',
      icon: <Database className="h-6 w-6" />,
      features: ['Cache automático', 'Invalidación inteligente', 'Optimistic updates', 'Retry automático']
    },
    {
      title: 'TanStack Table',
      description: 'Tablas avanzadas con sorting, filtering y pagination',
      icon: <Table className="h-6 w-6" />,
      features: ['Sorting avanzado', 'Filtros dinámicos', 'Pagination', 'Row selection']
    },
    {
      title: 'TanStack Form',
      description: 'Formularios robustos con validación y error handling',
      icon: <FormInput className="h-6 w-6" />,
      features: ['Validación en tiempo real', 'Error handling', 'Type safety', 'Performance optimizada']
    }
  ];

  const handleCompleteMigration = () => {
    setMigrationStep(3);
    setShowOldVersion(false);
    // Redirigir a la aplicación principal
    window.location.href = '/';
  };

  const handleShowOldVersion = () => {
    setShowOldVersion(true);
  };

  if (showOldVersion) {
    return (
      <div className="h-screen">
        <div className="bg-yellow-50 border-b border-yellow-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                Versión Anterior
              </Badge>
              <span className="text-sm text-yellow-700">
                Mostrando la versión original del FileExplorer
              </span>
            </div>
            <Button 
              onClick={() => setShowOldVersion(false)}
              variant="outline"
              size="sm"
            >
              Volver a TanStack
            </Button>
          </div>
        </div>
        <FileExplorer />
      </div>
    );
  }

  if (migrationStep < 3) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <Zap className="h-12 w-12 text-blue-600" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Migración a TanStack Completada
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Tu aplicación ahora está potenciada con el ecosistema TanStack completo
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {migrationSteps.map((step, index) => (
              <Card key={index} className={`transition-all duration-300 ${
                index <= migrationStep ? 'shadow-lg border-blue-200' : 'opacity-60'
              }`}>
                <CardHeader className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    {step.icon}
                  </div>
                  <CardTitle className="text-lg">{step.title}</CardTitle>
                  <CardDescription>{step.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {step.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-gray-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center">
            <Button 
              onClick={handleCompleteMigration}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
            >
              <ArrowRight className="h-5 w-5 mr-2" />
              Completar Migración
            </Button>
            
            <div className="mt-4">
              <Button 
                onClick={handleShowOldVersion}
                variant="outline"
                size="sm"
              >
                Ver Versión Anterior
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <OptimizedFileExplorer />;
}
