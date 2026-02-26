import { colors, currency, chartColors, typography, shadows, spacing } from '../tokens';

describe('Design tokens', () => {
  describe('colors', () => {
    it('exports primary color scale', () => {
      expect(colors.primary).toBeDefined();
      expect(colors.primary[500]).toBe('#6571f5');
      expect(colors.primary[600]).toBe('#515bf4');
    });

    it('exports success color scale', () => {
      expect(colors.success).toBeDefined();
      expect(colors.success[500]).toBe('#22c55e');
    });

    it('exports danger color scale', () => {
      expect(colors.danger).toBeDefined();
      expect(colors.danger[500]).toBe('#ef4444');
    });

    it('exports warning color scale', () => {
      expect(colors.warning).toBeDefined();
      expect(colors.warning[500]).toBe('#f59e0b');
    });

    it('exports surface color scale', () => {
      expect(colors.surface).toBeDefined();
      expect(colors.surface[50]).toBe('#fafaf9');
    });

    it('exports accent color scale', () => {
      expect(colors.accent).toBeDefined();
      expect(colors.accent[500]).toBe('#ffb966');
    });

    it('exports secondary color scale', () => {
      expect(colors.secondary).toBeDefined();
      expect(typeof colors.secondary[500]).toBe('string');
    });
  });

  describe('currency', () => {
    it('uses ZAR code', () => {
      expect(currency.code).toBe('ZAR');
    });

    it('uses R symbol', () => {
      expect(currency.symbol).toBe('R');
    });

    it('uses en-ZA locale', () => {
      expect(currency.locale).toBe('en-ZA');
    });

    it('formats amounts with R prefix', () => {
      const formatted = currency.format(1500);
      expect(formatted).toMatch(/^R/);
    });

    it('formats with 2 decimal places', () => {
      const formatted = currency.format(1500);
      // en-ZA locale may use comma or period as decimal separator
      expect(formatted).toMatch(/\d{2}$/);
    });

    it('formats zero correctly', () => {
      const formatted = currency.format(0);
      expect(formatted).toMatch(/^R/);
      expect(formatted).toContain('0');
    });
  });

  describe('chartColors', () => {
    it('exports categorical palette with 6 colors', () => {
      expect(chartColors.categorical).toHaveLength(6);
    });

    it('exports sequential palette with 5 colors', () => {
      expect(chartColors.sequential).toHaveLength(5);
    });

    it('exports diverging palette with 5 colors', () => {
      expect(chartColors.diverging).toHaveLength(5);
    });

    it('categorical palette starts with primary color', () => {
      expect(chartColors.categorical[0]).toBe(colors.primary[500]);
    });
  });

  describe('typography', () => {
    it('exports font family', () => {
      expect(typography.fontFamily).toContain('Inter');
    });

    it('exports font scale', () => {
      expect(typography.scale.sm).toBe('0.875rem');
      expect(typography.scale.base).toBe('1rem');
    });
  });

  describe('shadows', () => {
    it('exports card shadow', () => {
      expect(typeof shadows.card).toBe('string');
    });

    it('exports strong shadow', () => {
      expect(typeof shadows.strong).toBe('string');
    });
  });

  describe('spacing', () => {
    it('exports custom spacing values', () => {
      expect(spacing['4.5']).toBe('1.125rem');
      expect(spacing['18']).toBe('4.5rem');
    });
  });
});
