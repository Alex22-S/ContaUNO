// JS/payroll-calculator.js

/**
 * MOTOR DE CÁLCULO DE NÓMINA COLOMBIANA - VERSIÓN DINÁMICA
 * Este archivo contiene la lógica pura para calcular una nómina.
 * No interactúa con el DOM y no contiene valores fijos.
 * Recibe los datos del empleado, las novedades Y los valores legales como parámetros.
 */

const ARL_RISK_LEVELS = {
    1: 0.00522, 2: 0.01044, 3: 0.02436, 4: 0.04350, 5: 0.06960,
};

/**
 * Calcula la retención en la fuente para un empleado según el Art. 383 E.T.
 * @param {number} totalIngresosSalariales - Total de ingresos salariales del mes (sin aux transporte).
 * @param {object} legalValues - Objeto con los valores legales (UVT, porcentajes).
 * @returns {number} El valor a retener en el mes.
 */
function calculateRetencionFuente(totalIngresosSalariales, legalValues) {
    if (!legalValues || !legalValues.UVT) return 0; // Salvaguarda

    // 1. Deducir aportes obligatorios a salud y pensión
    const aportesObligatorios = totalIngresosSalariales * (legalValues.SALUD_EMPLEADO + legalValues.PENSION_EMPLEADO);
    let baseGravable = totalIngresosSalariales - aportesObligatorios;

    // 2. Deducir renta exenta del 25% (Límite 790 UVT anuales para 2025, aprox 65.8 UVT mensual)
    // Se usa un límite más realista basado en la depuración de la base. Para simplificar, usamos un límite mensual genérico.
    const MAX_RENTA_EXENTA_MENSUAL_UVT = 240; // Valor genérico, se puede ajustar
    const rentaExenta = baseGravable * 0.25;
    const limiteExentoMensualCOP = MAX_RENTA_EXENTA_MENSUAL_UVT * legalValues.UVT;
    const rentaExentaAplicable = Math.min(rentaExenta, limiteExentoMensualCOP);
    baseGravable -= rentaExentaAplicable;

    // 3. Convertir base gravable a UVT
    if (baseGravable <= 0) return 0;
    const baseEnUVT = baseGravable / legalValues.UVT;

    // 4. Aplicar tabla del Art. 383 E.T. (rangos simplificados)
    let impuestoEnUVT = 0;
    if (baseEnUVT > 3900) {
        impuestoEnUVT = (baseEnUVT - 3900) * 0.39 + 770;
    } else if (baseEnUVT > 2300) {
        impuestoEnUVT = (baseEnUVT - 2300) * 0.37 + 268;
    } else if (baseEnUVT > 1700) {
        impuestoEnUVT = (baseEnUVT - 1700) * 0.35 + 115;
    } else if (baseEnUVT > 1090) {
        impuestoEnUVT = (baseEnUVT - 1090) * 0.33 + 69;
    } else if (baseEnUVT > 640) {
        impuestoEnUVT = (baseEnUVT - 640) * 0.28 + 19;
    } else if (baseEnUVT > 360) {
        impuestoEnUVT = (baseEnUVT - 360) * 0.19;
    }
    // El rango inferior a 360 UVT no genera impuesto en esta tabla simplificada.
    
    return impuestoEnUVT > 0 ? impuestoEnUVT * legalValues.UVT : 0;
}


function calculatePayroll(employeeData, novelties, legalValues) {
    if (!legalValues || !legalValues.SMLMV) {
        throw new Error("Los valores legales (legalValues) son requeridos para el cálculo.");
    }
    
    const { sueldo, arlLevel, recibeAuxTransporte } = employeeData;
    const diasLicenciaNoRemunerada = novelties.diasLicenciaNoRemunerada || 0;
    const diasIncapacidad = novelties.diasIncapacidad || 0;
    const diasLiquidar = 30 - diasLicenciaNoRemunerada; // Días base para liquidar nómina
    const diasTrabajados = diasLiquidar - diasIncapacidad; // Días efectivamente laborados
    
    const valorHoraOrdinaria = sueldo / 240; // 240 horas laborales en un mes

    // 1. CÁLCULO DE DEVENGADOS
    const sueldoPeriodo = (sueldo / 30) * diasTrabajados;
    
    const aplicaAuxTransporte = recibeAuxTransporte === 'yes' || (recibeAuxTransporte === 'auto' && sueldo <= legalValues.SMLMV * 2);
    const auxTransportePeriodo = aplicaAuxTransporte ? (legalValues.AUX_TRANSPORTE / 30) * diasTrabajados : 0;
    
    const valorExtrasDiurnas = (novelties.horasExtraDiurnas || 0) * valorHoraOrdinaria * legalValues.FACTOR_EXTRA_DIURNA;
    const valorExtrasNocturnas = (novelties.horasExtraNocturnas || 0) * valorHoraOrdinaria * legalValues.FACTOR_EXTRA_NOCTURNA;
    const valorRecargosFestivos = (novelties.horasRecargoFestivo || 0) * valorHoraOrdinaria * legalValues.FACTOR_RECARGO_DOMINICAL_FESTIVO;
    const totalHorasExtrasYRecargos = valorExtrasDiurnas + valorExtrasNocturnas + valorRecargosFestivos;

    // Pago de incapacidades (simplificado: 2/3 del sueldo base, sin exceder 1 SMLMV)
    const pagoIncapacidad = (sueldo / 30) * diasIncapacidad * (2/3);

    const comisiones = novelties.comisiones || 0;
    const otrosIngresosSalariales = comisiones;
    const ingresosNoSalariales = novelties.ingresosNoSalariales || 0;

    const totalDevengado = sueldoPeriodo + auxTransportePeriodo + totalHorasExtrasYRecargos + otrosIngresosSalariales + ingresosNoSalariales + pagoIncapacidad;

    // 2. CÁLCULO DEL INGRESO BASE DE COTIZACIÓN (IBC)
    let baseCotizacion = sueldoPeriodo + totalHorasExtrasYRecargos + otrosIngresosSalariales;
    
    if (diasLicenciaNoRemunerada > 0) {
        baseCotizacion += (legalValues.SMLMV / 30) * diasLicenciaNoRemunerada;
    }
    const ibcMinimo = (legalValues.SMLMV / 30) * diasLiquidar;
    const ibc = Math.max(baseCotizacion, ibcMinimo);

    // 3. CÁLCULO DE DEDUCCIONES (Empleado)
    const aporteSalud = ibc * legalValues.SALUD_EMPLEADO;
    const aportePension = ibc * legalValues.PENSION_EMPLEADO;

    let fsp = 0;
    if (ibc >= legalValues.SMLMV * 4) {
        fsp = ibc * 0.01; // Primer rango FSP
        if (ibc >= legalValues.SMLMV * 16 && ibc < legalValues.SMLMV * 17) fsp += ibc * 0.002;
        if (ibc >= legalValues.SMLMV * 17 && ibc < legalValues.SMLMV * 18) fsp += ibc * 0.004;
        if (ibc >= legalValues.SMLMV * 18 && ibc < legalValues.SMLMV * 19) fsp += ibc * 0.006;
        if (ibc >= legalValues.SMLMV * 19 && ibc < legalValues.SMLMV * 20) fsp += ibc * 0.008;
        if (ibc >= legalValues.SMLMV * 20) fsp += ibc * 0.01;
    }

    const ingresosSalarialesParaRetencion = sueldoPeriodo + totalHorasExtrasYRecargos + otrosIngresosSalariales;
    const retencionFuente = calculateRetencionFuente(ingresosSalarialesParaRetencion, legalValues);

    const otrasDeducciones = novelties.otrasDeducciones || 0;
    const totalDeducciones = aporteSalud + aportePension + fsp + retencionFuente + otrasDeducciones;

    // 4. NETO A PAGAR
    const netoAPagar = totalDevengado - totalDeducciones;

    // 5. APORTES Y PROVISIONES (Empleador)
    const aplicaExoneracion = sueldo < (legalValues.SMLMV * 10);
    const saludEmpresa = aplicaExoneracion ? 0 : ibc * legalValues.SALUD_EMPRESA;
    const pensionEmpresa = ibc * legalValues.PENSION_EMPRESA;
    const arl = ibc * ARL_RISK_LEVELS[arlLevel];
    const cajaCompensacion = ibc * legalValues.CAJA_COMPENSACION;
    const icbf = aplicaExoneracion ? 0 : ibc * legalValues.ICBF;
    const sena = aplicaExoneracion ? 0 : ibc * legalValues.SENA;

    const totalSeguridadSocialYParafiscales = saludEmpresa + pensionEmpresa + arl + cajaCompensacion + icbf + sena;

    const basePrestaciones = sueldoPeriodo + totalHorasExtrasYRecargos + otrosIngresosSalariales + auxTransportePeriodo;
    const provisionCesantias = basePrestaciones * legalValues.CESANTIAS;
    const provisionInteresesCesantias = provisionCesantias * (legalValues.INTERESES_CESANTIAS / 12);
    const provisionPrima = basePrestaciones * legalValues.PRIMA;

    const baseVacaciones = sueldoPeriodo + totalHorasExtrasYRecargos + otrosIngresosSalariales;
    const provisionVacaciones = baseVacaciones * legalValues.VACACIONES;
    
    const totalProvisiones = provisionCesantias + provisionInteresesCesantias + provisionPrima + provisionVacaciones;
    
    const costoTotalEmpresa = totalDevengado + totalSeguridadSocialYParafiscales;
    
    return {
        netoAPagar,
        totalDevengado,
        totalDeducciones,
        costoTotalEmpresa,
        desglose: {
            devengados: { sueldoPeriodo, auxTransportePeriodo, valorExtrasDiurnas, valorExtrasNocturnas, valorRecargosFestivos, comisiones, pagoIncapacidad, ingresosNoSalariales },
            deducciones: { aporteSalud, aportePension, fsp, retencionFuente, otrasDeducciones },
            provisiones: { provisionCesantias, provisionInteresesCesantias, provisionPrima, provisionVacaciones, total: totalProvisiones },
            costosEmpleador: { saludEmpresa, pensionEmpresa, arl, cajaCompensacion, icbf, sena, total: totalSeguridadSocialYParafiscales },
            bases: { ibc, basePrestaciones, baseVacaciones, diasLiquidar, diasTrabajados, diasIncapacidad, diasLicenciaNoRemunerada }
        }
    };
}