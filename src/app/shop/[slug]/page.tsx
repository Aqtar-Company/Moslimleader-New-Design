import { products, getProductBySlug } from '@/lib/products';
import { notFound } from 'next/navigation';
import ProductDetailClient from './ProductDetailClient';

export function generateStaticParams() {
  return products.map(p => ({ slug: p.slug }));
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();
  return <ProductDetailClient product={product} />;
}
