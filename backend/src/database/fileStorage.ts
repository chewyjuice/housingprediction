import fs from 'fs/promises';
import path from 'path';

export class FileStorage {
  private dataDir: string;

  constructor(dataDir: string = './data') {
    this.dataDir = dataDir;
    this.ensureDataDir();
  }

  private async ensureDataDir(): Promise<void> {
    try {
      await fs.access(this.dataDir);
    } catch {
      await fs.mkdir(this.dataDir, { recursive: true });
    }
  }

  async readData<T>(filename: string): Promise<T[]> {
    try {
      const filePath = path.join(this.dataDir, `${filename}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      // Return empty array if file doesn't exist
      return [];
    }
  }

  async writeData<T>(filename: string, data: T[]): Promise<void> {
    await this.ensureDataDir();
    const filePath = path.join(this.dataDir, `${filename}.json`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  async appendData<T>(filename: string, item: T): Promise<void> {
    const existingData = await this.readData<T>(filename);
    existingData.push(item);
    await this.writeData(filename, existingData);
  }

  async findById<T extends { id: string }>(filename: string, id: string): Promise<T | null> {
    const data = await this.readData<T>(filename);
    return data.find(item => item.id === id) || null;
  }

  async updateById<T extends { id: string }>(filename: string, id: string, updates: Partial<T>): Promise<T | null> {
    const data = await this.readData<T>(filename);
    const index = data.findIndex(item => item.id === id);
    
    if (index === -1) return null;
    
    data[index] = { ...data[index], ...updates };
    await this.writeData(filename, data);
    return data[index];
  }

  async deleteById<T extends { id: string }>(filename: string, id: string): Promise<boolean> {
    const data = await this.readData<T>(filename);
    const initialLength = data.length;
    const filteredData = data.filter(item => item.id !== id);
    
    if (filteredData.length === initialLength) return false;
    
    await this.writeData(filename, filteredData);
    return true;
  }
}

export const fileStorage = new FileStorage();