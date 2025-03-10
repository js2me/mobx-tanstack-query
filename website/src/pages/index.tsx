import type { ReactNode } from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import Logo from '@theme/Logo';

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title}`}
      description={`${siteConfig.tagline}`}
      noFooter
    >
      <header className={'hero hero--primary flex-1 !bg-[transparent] !text-black dark:!text-ifm-secondary'}>
        <div className="container">
          <div className='flex flex-row gap-7 flex-wrap items-start'>
            <Logo imageClassName='w-28 mt-1' titleClassName='hidden'/> 
            <div className='flex flex-col gap-0 justify-center flex-wrap'>
              <Heading as="h1" className="hero__title">
                {siteConfig.title}
              </Heading>
              <p className="hero__subtitle">{siteConfig.tagline}</p>
              <div className={'flex flex-row gap-2 mr-auto'}>
                <Link
                  className="button button--primary button--lg"
                  to="/getting-started">
                  Getting Started
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>
    </Layout>
  );
}
