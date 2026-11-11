// Persistent client-side synchronization for serverless, multi-instance, and Vercel environments
export const localSync = {
  // --- DEPARTMENTS ---
  getDepartments: () => {
    try {
      return JSON.parse(localStorage.getItem('hcm_custom_departments') || '[]');
    } catch {
      return [];
    }
  },
  saveDepartment: (dept) => {
    if (!dept || !dept.name) return;
    try {
      const list = localSync.getDepartments();
      const updated = [
        ...list.filter(d => String(d.id) !== String(dept.id) && d.name.toLowerCase() !== dept.name.toLowerCase()),
        dept
      ];
      localStorage.setItem('hcm_custom_departments', JSON.stringify(updated));
      // Remove from deleted list if re-added
      const deleted = JSON.parse(localStorage.getItem('hcm_deleted_departments') || '[]');
      localStorage.setItem(
        'hcm_deleted_departments',
        JSON.stringify(deleted.filter(id => String(id) !== String(dept.id)))
      );
    } catch (e) {
      console.warn('Failed to save department to localStorage:', e);
    }
  },
  deleteDepartment: (id) => {
    try {
      const list = localSync.getDepartments();
      localStorage.setItem('hcm_custom_departments', JSON.stringify(list.filter(d => String(d.id) !== String(id))));
      const deleted = JSON.parse(localStorage.getItem('hcm_deleted_departments') || '[]');
      if (!deleted.includes(String(id))) {
        deleted.push(String(id));
        localStorage.setItem('hcm_deleted_departments', JSON.stringify(deleted));
      }
    } catch (e) {
      console.warn('Failed to delete department from localStorage:', e);
    }
  },
  mergeDepartments: (serverDepts = []) => {
    const deleted = new Set(JSON.parse(localStorage.getItem('hcm_deleted_departments') || '[]'));
    const local = localSync.getDepartments().filter(d => !deleted.has(String(d.id)));
    const map = new Map();

    if (Array.isArray(serverDepts)) {
      serverDepts
        .filter(d => d && !deleted.has(String(d.id)))
        .forEach(d => {
          if (d && d.name) map.set(d.name.toLowerCase().trim(), d);
        });
    }

    local.forEach(d => {
      if (d && d.name) {
        const key = d.name.toLowerCase().trim();
        if (!map.has(key)) {
          map.set(key, d);
        }
      }
    });

    return Array.from(map.values());
  },

  // --- DESIGNATIONS ---
  getDesignations: () => {
    try {
      return JSON.parse(localStorage.getItem('hcm_custom_designations') || '[]');
    } catch {
      return [];
    }
  },
  saveDesignation: (des) => {
    if (!des || !des.title) return;
    try {
      const list = localSync.getDesignations();
      const updated = [
        ...list.filter(d => String(d.id) !== String(des.id) && d.title.toLowerCase() !== des.title.toLowerCase()),
        des
      ];
      localStorage.setItem('hcm_custom_designations', JSON.stringify(updated));
      const deleted = JSON.parse(localStorage.getItem('hcm_deleted_designations') || '[]');
      localStorage.setItem(
        'hcm_deleted_designations',
        JSON.stringify(deleted.filter(id => String(id) !== String(des.id)))
      );
    } catch (e) {
      console.warn('Failed to save designation to localStorage:', e);
    }
  },
  deleteDesignation: (id) => {
    try {
      const list = localSync.getDesignations();
      localStorage.setItem('hcm_custom_designations', JSON.stringify(list.filter(d => String(d.id) !== String(id))));
      const deleted = JSON.parse(localStorage.getItem('hcm_deleted_designations') || '[]');
      if (!deleted.includes(String(id))) {
        deleted.push(String(id));
        localStorage.setItem('hcm_deleted_designations', JSON.stringify(deleted));
      }
    } catch (e) {
      console.warn('Failed to delete designation from localStorage:', e);
    }
  },
  mergeDesignations: (serverDesigs = []) => {
    const deleted = new Set(JSON.parse(localStorage.getItem('hcm_deleted_designations') || '[]'));
    const local = localSync.getDesignations().filter(d => !deleted.has(String(d.id)));
    const map = new Map();

    const depts = localSync.getDepartments();
    const deptMap = new Map(depts.map(d => [String(d.id), d.name]));

    const enrich = (des) => {
      const copy = { ...des };
      if (!copy.department_name && copy.department_id && deptMap.has(String(copy.department_id))) {
        copy.department_name = deptMap.get(String(copy.department_id));
      }
      return copy;
    };

    if (Array.isArray(serverDesigs)) {
      serverDesigs
        .filter(d => d && !deleted.has(String(d.id)))
        .forEach(d => {
          if (d && d.title) {
            const key = `${d.title.toLowerCase().trim()}_${d.department_id || ''}`;
            map.set(key, enrich(d));
          }
        });
    }

    local.forEach(d => {
      if (d && d.title) {
        const key = `${d.title.toLowerCase().trim()}_${d.department_id || ''}`;
        if (!map.has(key)) {
          map.set(key, enrich(d));
        }
      }
    });

    return Array.from(map.values());
  },

  // --- EMPLOYEES ---
  getEmployees: () => {
    try {
      return JSON.parse(localStorage.getItem('hcm_custom_employees') || '[]');
    } catch {
      return [];
    }
  },
  saveEmployee: (emp) => {
    if (!emp || !emp.email) return;
    try {
      const list = localSync.getEmployees();
      const updated = [
        emp,
        ...list.filter(e => String(e.id) !== String(emp.id) && e.email.toLowerCase() !== emp.email.toLowerCase())
      ];
      localStorage.setItem('hcm_custom_employees', JSON.stringify(updated));
      const deleted = JSON.parse(localStorage.getItem('hcm_deleted_employees') || '[]');
      localStorage.setItem(
        'hcm_deleted_employees',
        JSON.stringify(deleted.filter(id => String(id) !== String(emp.id)))
      );
    } catch (e) {
      console.warn('Failed to save employee to localStorage:', e);
    }
  },
  deleteEmployee: (id) => {
    try {
      const list = localSync.getEmployees();
      localStorage.setItem('hcm_custom_employees', JSON.stringify(list.filter(e => String(e.id) !== String(id))));
      const deleted = JSON.parse(localStorage.getItem('hcm_deleted_employees') || '[]');
      if (!deleted.includes(String(id))) {
        deleted.push(String(id));
        localStorage.setItem('hcm_deleted_employees', JSON.stringify(deleted));
      }
    } catch (e) {
      console.warn('Failed to delete employee from localStorage:', e);
    }
  },
  mergeEmployees: (serverEmps = []) => {
    const deleted = new Set(JSON.parse(localStorage.getItem('hcm_deleted_employees') || '[]'));
    const local = localSync.getEmployees().filter(e => !deleted.has(String(e.id)));
    const map = new Map();

    const depts = localSync.getDepartments();
    const desigs = localSync.getDesignations();
    const deptMap = new Map(depts.map(d => [String(d.id), d.name]));
    const desigMap = new Map(desigs.map(d => [String(d.id), d.title]));

    const enrich = (emp) => {
      const copy = { ...emp };
      if (!copy.department_name && copy.department_id && deptMap.has(String(copy.department_id))) {
        copy.department_name = deptMap.get(String(copy.department_id));
      }
      if (!copy.designation_title && copy.designation_id && desigMap.has(String(copy.designation_id))) {
        copy.designation_title = desigMap.get(String(copy.designation_id));
      }
      return copy;
    };

    if (Array.isArray(serverEmps)) {
      serverEmps
        .filter(e => e && !deleted.has(String(e.id)))
        .forEach(e => {
          if (e && e.email) map.set(e.email.toLowerCase().trim(), enrich(e));
        });
    }

    local.forEach(e => {
      if (e && e.email) {
        const key = e.email.toLowerCase().trim();
        if (!map.has(key)) {
          map.set(key, enrich(e));
        }
      }
    });

    return Array.from(map.values());
  }
};
